

const express = require("express");

const bcrypt = require("bcrypt");

const jwt = require("jsonwebtoken");

const crypto = require("crypto");

const pool = require("./db");

const {

  sendOtpEmail,

  sendPasswordResetEmail,

} = require("./email.service");



const router = express.Router();

const SALT_ROUNDS = 12;

const RESET_TOKEN_MINUTES = 15;



// REGISTER

router.post("/register", async (req, res) => {

  try {

    const { email, password } = req.body || {};



    if (

      typeof email !== "string" ||

      typeof password !== "string" ||

      !email.trim() ||

      password.length < 8 ||

      password.length > 72

    ) {

      return res.status(400).json({

        error: "Provide a valid email and a password of 8–72 characters.",

      });

    }



    const normalizedEmail = email.trim().toLowerCase();



    if (

      normalizedEmail.length > 254 ||

      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)

    ) {

      return res.status(400).json({ error: "Invalid email address." });

    }



    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);



    const result = await pool.query(

      `INSERT INTO users (email, password_hash, role)

       VALUES ($1, $2, 'viewer')

       RETURNING id, email, role, created_at`,

      [normalizedEmail, passwordHash]

    );



    return res.status(201).json({ user: result.rows[0] });

  } catch (error) {

    if (error.code === "23505") {

      return res.status(409).json({ error: "Email already registered." });

    }



    console.error("Registration failed:", error.message);

    return res.status(500).json({ error: "Registration failed." });

  }

});



// LOGIN: validate password and send OTP

router.post("/login", async (req, res) => {

  try {

    const { email, password } = req.body || {};



    if (

      typeof email !== "string" ||

      typeof password !== "string" ||

      !email.trim() ||

      !password ||

      password.length > 72

    ) {

      return res.status(400).json({

        error: "Invalid email or password.",

      });

    }



    const result = await pool.query(

      `SELECT id, email, password_hash, role

       FROM users

       WHERE email = $1 AND is_active = TRUE`,

      [email.trim().toLowerCase()]

    );



    const user = result.rows[0];



    if (!user || !(await bcrypt.compare(password, user.password_hash))) {

      return res.status(401).json({

        error: "Invalid email or password.",

      });

    }



    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {

      return res.status(500).json({

        error: "Authentication is not configured.",

      });

    }



    const recentOtp = await pool.query(

      `SELECT id

       FROM login_otp_challenges

       WHERE user_id = $1

         AND created_at > NOW() - INTERVAL '60 seconds'

       LIMIT 1`,

      [user.id]

    );



    if (recentOtp.rows.length > 0) {

      return res.status(429).json({

        error: "Please wait 60 seconds before requesting another code.",

      });

    }



    const otp = crypto.randomInt(0, 1000000)

      .toString()

      .padStart(6, "0");



    const otpHash = crypto

      .createHash("sha256")

      .update(otp)

      .digest("hex");



    const client = await pool.connect();



    try {

      await client.query("BEGIN");



      await client.query(

        `UPDATE login_otp_challenges

         SET consumed_at = NOW()

         WHERE user_id = $1 AND consumed_at IS NULL`,

        [user.id]

      );



      await client.query(

        `INSERT INTO login_otp_challenges

           (user_id, otp_hash, expires_at, attempts)

         VALUES ($1, $2, NOW() + INTERVAL '5 minutes', 0)`,

        [user.id, otpHash]

      );



      await client.query("COMMIT");

    } catch (error) {

      try {

        await client.query("ROLLBACK");

      } catch {}

      throw error;

    } finally {

      client.release();

    }



    try {

      await sendOtpEmail(user.email, otp);

    } catch (error) {

      await pool.query(

        `UPDATE login_otp_challenges

         SET consumed_at = NOW()

         WHERE user_id = $1 AND otp_hash = $2

           AND consumed_at IS NULL`,

        [user.id, otpHash]

      );



      console.error("OTP email delivery failed:", error.message);

      return res.status(502).json({

        error: "Unable to send verification email. Please try again.",

      });

    }



    return res.status(200).json({

      message: "Verification code sent to your email.",

      requiresOtp: true,

      email: user.email,

    });

  } catch (error) {

    console.error("Login OTP request failed:", error.message);

    return res.status(500).json({

      error: "Unable to start login verification.",

    });

  }

});



// VERIFY OTP AND ISSUE JWT

router.post("/verify-otp", async (req, res) => {

  const { email, otp } = req.body || {};



  if (

    typeof email !== "string" ||

    typeof otp !== "string" ||

    !/^\d{6}$/.test(otp)

  ) {

    return res.status(400).json({

      error: "Enter a valid six-digit verification code.",

    });

  }



  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {

    return res.status(500).json({

      error: "Authentication is not configured.",

    });

  }



  let client;



  try {

    client = await pool.connect();

    await client.query("BEGIN");



    const result = await client.query(

      `SELECT c.id AS challenge_id,

              c.user_id,

              c.otp_hash,

              c.expires_at,

              c.attempts,

              u.email,

              u.role

       FROM login_otp_challenges c

       JOIN users u ON u.id = c.user_id

       WHERE u.email = $1

         AND u.is_active = TRUE

         AND c.consumed_at IS NULL

       ORDER BY c.created_at DESC

       LIMIT 1

       FOR UPDATE OF c`,

      [email.trim().toLowerCase()]

    );



    const challenge = result.rows[0];



    if (!challenge) {

      await client.query("ROLLBACK");

      return res.status(401).json({

        error: "Invalid or expired verification code.",

      });

    }



    if (

      challenge.attempts >= 5 ||

      new Date(challenge.expires_at) <= new Date()

    ) {

      await client.query(

        `UPDATE login_otp_challenges

         SET consumed_at = NOW()

         WHERE id = $1`,

        [challenge.challenge_id]

      );



      await client.query("COMMIT");

      return res.status(401).json({

        error: "Invalid or expired verification code.",

      });

    }



    const expectedHash = Buffer.from(challenge.otp_hash, "hex");

    const submittedHash = crypto

      .createHash("sha256")

      .update(otp)

      .digest();



    const validOtp =

      expectedHash.length === submittedHash.length &&

      crypto.timingSafeEqual(expectedHash, submittedHash);



    if (!validOtp) {

      const attempts = challenge.attempts + 1;



      await client.query(

        `UPDATE login_otp_challenges

         SET attempts = $1,

             consumed_at = CASE

               WHEN $1 >= 5 THEN NOW()

               ELSE consumed_at

             END

         WHERE id = $2`,

        [attempts, challenge.challenge_id]

      );



      await client.query("COMMIT");

      return res.status(401).json({

        error: "Invalid or expired verification code.",

      });

    }



    await client.query(

      `UPDATE login_otp_challenges

       SET consumed_at = NOW()

       WHERE id = $1`,

      [challenge.challenge_id]

    );



    const token = jwt.sign(

      { role: challenge.role },

      process.env.JWT_SECRET,

      {

        subject: String(challenge.user_id),

        expiresIn: "15m",

        issuer: "trustvault",

        audience: "trustvault-client",

      }

    );



    await client.query("COMMIT");



    return res.status(200).json({

      token,

      tokenType: "Bearer",

      expiresIn: 900,

      user: {

        id: challenge.user_id,

        email: challenge.email,

        role: challenge.role,

      },

    });

  } catch (error) {

    if (client) {

      try {

        await client.query("ROLLBACK");

      } catch {}

    }



    console.error("OTP verification failed:", error.message);

    return res.status(500).json({

      error: "Unable to verify login code.",

    });

  } finally {

    if (client) client.release();

  }

});



// FORGOT PASSWORD: send a time-limited reset link

router.post("/forgot-password", async (req, res) => {

  const genericMessage =

    "If an active account exists for that email, a reset link will be sent.";



  try {

    const { email } = req.body || {};



    if (

      typeof email !== "string" ||

      !email.trim() ||

      email.length > 254

    ) {

      return res.status(400).json({

        error: "Enter a valid email address.",

      });

    }



    const normalizedEmail = email.trim().toLowerCase();



    const result = await pool.query(

      `SELECT id, email

       FROM users

       WHERE email = $1 AND is_active = TRUE

       LIMIT 1`,

      [normalizedEmail]

    );



    const user = result.rows[0];



    if (!user) {

      return res.status(200).json({ message: genericMessage });

    }



    const rawToken = crypto.randomBytes(32).toString("hex");

    const tokenHash = crypto

      .createHash("sha256")

      .update(rawToken)

      .digest("hex");



    await pool.query(

      `UPDATE password_reset_tokens

       SET used_at = NOW()

       WHERE user_id = $1 AND used_at IS NULL`,

      [user.id]

    );



    await pool.query(

      `INSERT INTO password_reset_tokens

         (user_id, token_hash, expires_at)

       VALUES ($1, $2, NOW() + ($3 * INTERVAL '1 minute'))`,

      [user.id, tokenHash, RESET_TOKEN_MINUTES]

    );



    if (!process.env.CLIENT_URL) {

      throw new Error("CLIENT_URL is not configured.");

    }



    const resetUrl = new URL("/reset-password", process.env.CLIENT_URL);

    resetUrl.searchParams.set("token", rawToken);



    try {

      await sendPasswordResetEmail(user.email, resetUrl.toString());

    } catch (mailError) {

      await pool.query(

        `UPDATE password_reset_tokens

         SET used_at = NOW()

         WHERE token_hash = $1 AND used_at IS NULL`,

        [tokenHash]

      );

      throw mailError;

    }



    return res.status(200).json({ message: genericMessage });

  } catch (error) {

    console.error("Forgot-password request failed:", error.message);

    return res.status(500).json({

      error: "Unable to process the request right now.",

    });

  }

});



// RESET PASSWORD: accept a valid token only once

router.post("/reset-password", async (req, res) => {

  const { token, password } = req.body || {};



  if (

    typeof token !== "string" ||

    !/^[a-f0-9]{64}$/.test(token) ||

    typeof password !== "string" ||

    password.length < 8 ||

    password.length > 72

  ) {

    return res.status(400).json({

      error: "Provide a valid reset link and a password of 8–72 characters.",

    });

  }



  const tokenHash = crypto

    .createHash("sha256")

    .update(token)

    .digest("hex");



  let client;



  try {

    client = await pool.connect();

    await client.query("BEGIN");



    const result = await client.query(

      `SELECT id, user_id

       FROM password_reset_tokens

       WHERE token_hash = $1

         AND used_at IS NULL

         AND expires_at > NOW()

       FOR UPDATE`,

      [tokenHash]

    );



    const reset = result.rows[0];



    if (!reset) {

      await client.query("ROLLBACK");

      return res.status(400).json({

        error: "This reset link is invalid or expired. Request a new one.",

      });

    }



    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);



    const updated = await client.query(

      `UPDATE users

       SET password_hash = $1

       WHERE id = $2 AND is_active = TRUE`,

      [passwordHash, reset.user_id]

    );



    if (updated.rowCount !== 1) {

      await client.query("ROLLBACK");

      return res.status(400).json({

        error: "This reset link is invalid or expired. Request a new one.",

      });

    }



    await client.query(

      `UPDATE password_reset_tokens

       SET used_at = NOW()

       WHERE user_id = $1 AND used_at IS NULL`,

      [reset.user_id]

    );



    await client.query(

      `UPDATE login_otp_challenges

       SET consumed_at = NOW()

       WHERE user_id = $1 AND consumed_at IS NULL`,

      [reset.user_id]

    );



    await client.query("COMMIT");



    return res.status(200).json({

      message: "Password reset successfully. You can now sign in.",

    });

  } catch (error) {

    if (client) {

      try {

        await client.query("ROLLBACK");

      } catch {}

    }



    console.error("Password reset failed:", error.message);

    return res.status(500).json({

      error: "Unable to reset your password right now.",

    });

  } finally {

    if (client) client.release();

  }

});



module.exports = router;
