import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpRequired, setOtpRequired] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);

    try {
      if (!otpRequired) {
        if (!email.trim() || !password) {
          throw new Error("Enter your email and password.");
        }

        const result = await login({
          email: email.trim(),
          password,
        });

        if (result?.requiresOtp) {
          setVerifiedEmail(result.email || email.trim());
          setOtpRequired(true);
          setMessage(result.message || "Enter the verification code sent to your email.");
          return;
        }

        navigate(location.state?.from?.pathname || "/", {
          replace: true,
        });
        return;
      }

      if (!/^\d{6}$/.test(otp)) {
        throw new Error("Enter the valid 6-digit OTP.");
      }

      await verifyOtp({
        email: verifiedEmail,
        otp,
      });

      navigate(location.state?.from?.pathname || "/", {
        replace: true,
      });
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function backToLogin() {
    setOtpRequired(false);
    setOtp("");
    setPassword("");
    setMessage("");
    setError("");
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-heading">
        <Link to="/" className="login-brand">
          TrustVault
        </Link>

        <h1 id="login-heading">
          {otpRequired ? "Verify your email" : "Welcome back"}
        </h1>

        <p>
          {otpRequired
            ? `Enter the 6-digit verification code sent to ${verifiedEmail}.`
            : "Sign in to securely access your documents."}
        </p>

        <form onSubmit={handleSubmit}>
          {!otpRequired ? (
            <>
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />

              <label htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />

              <p className="login-forgot-password">
                <Link to="/forgot-password">Forgot password?</Link>
              </p>
            </>
          ) : (
            <>
              <label htmlFor="otp">6-digit verification code</label>
              <input
                id="otp"
                name="otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={otp}
                onChange={(event) =>
                  setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="Enter OTP"
                required
                autoFocus
              />
            </>
          )}

          {message && <p role="status">{message}</p>}

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={submitting}>
            {submitting
              ? "Please wait..."
              : otpRequired
                ? "Verify OTP"
                : "Sign in"}
          </button>

          {otpRequired && (
            <button
              type="button"
              onClick={backToLogin}
              disabled={submitting}
            >
              Back to sign in
            </button>
          )}
        </form>

        {!otpRequired && (
          <p className="login-footer">
            New to TrustVault? <Link to="/register">Create an account</Link>
          </p>
        )}
      </section>
    </main>
  );
}
