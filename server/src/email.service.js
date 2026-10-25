
const nodemailer = require("nodemailer");

const smtpPort = Number(process.env.SMTP_PORT || 587);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendOtpEmail(email, otp) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error("SMTP credentials are not configured.");
  }

  return transporter.sendMail({
    from: `"TrustVault" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "Your TrustVault login verification code",
    text: [
      `Your TrustVault verification code is: ${otp}`,
      "",
      "This code expires in 5 minutes.",
      "If you did not request this code, you can ignore this email.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
        <h2>TrustVault Login Verification</h2>
        <p>Use this code to complete your login:</p>
        <p style="font-size:30px;font-weight:bold;letter-spacing:8px">
          ${otp}
        </p>
        <p>This code expires in 5 minutes.</p>
        <p>If you did not request this code, ignore this email.</p>
      </div>
    `,
  });
}
async function sendPasswordResetEmail(email, resetUrl) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error("SMTP credentials are not configured.");
  }

  return transporter.sendMail({
    from: `"TrustVault" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "Reset your TrustVault password",
    text: [
      "We received a request to reset your TrustVault password.",
      "",
      `Reset your password using this link: ${resetUrl}`,
      "",
      "This link expires in 15 minutes and can only be used once.",
      "If you did not request this, you can ignore this email.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
        <h2>Reset Your TrustVault Password</h2>
        <p>We received a request to reset your password.</p>
        <p>
          <a href="${resetUrl}"
             style="display:inline-block;padding:12px 20px;
                    background:#166534;color:#fff;
                    text-decoration:none;border-radius:6px">
            Reset Password
          </a>
        </p>
        <p>This link expires in 15 minutes and can only be used once.</p>
        <p>If you did not request this, you can ignore this email.</p>
      </div>
    `,
  });
}

module.exports = {
  sendOtpEmail,
  sendPasswordResetEmail,
};