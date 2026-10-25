
const { Resend } = require("resend");

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

async function sendEmail({ to, subject, html, text }) {
  if (!resend) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || "TrustVault <onboarding@resend.dev>",
    to: [to],
    subject,
    html,
    text,
  });

  if (error) {
    throw new Error(error.message || "Resend email delivery failed.");
  }

  return data;
}

async function sendOtpEmail(email, otp) {
  return sendEmail({
    to: email,
    subject: "Your TrustVault verification code",
    text: `Your TrustVault verification code is ${otp}. Do not share this code with anyone.`,
    html: `
      <h2>TrustVault Email Verification</h2>
      <p>Your verification code is:</p>
      <h1>${otp}</h1>
      <p>Do not share this code with anyone.</p>
    `,
  });
}

async function sendPasswordResetEmail(email, resetUrl) {
  return sendEmail({
    to: email,
    subject: "Reset your TrustVault password",
    text: `Use this link to reset your TrustVault password: ${resetUrl}`,
    html: `
      <h2>TrustVault Password Reset</h2>
      <p>Click the link below to reset your password:</p>
      <p><a href="${resetUrl}">Reset Password</a></p>
      <p>If you did not request this, you can ignore this email.</p>
    `,
  });
}

module.exports = {
  sendOtpEmail,
  sendPasswordResetEmail,
};
