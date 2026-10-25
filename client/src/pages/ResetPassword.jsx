
import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { apiRequest } from "../services/api.js";
export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!/^[a-f0-9]{64}$/.test(token)) {
      setError("This reset link is invalid. Request a new link.");
      return;
    }

    if (password.length < 8 || password.length > 72) {
      setError("Password must contain 8–72 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      await apiRequest("/auth/reset-password", {
        method: "POST",
        body: { token, password },
      });

      navigate("/login", {
        replace: true,
        state: { message: "Password reset successfully. Please sign in." },
      });
    } catch (err) {
      setError(err.message || "Unable to reset your password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <h1>Reset Password</h1>

      {!token ? (
        <>
          <p>Reset link is missing or invalid.</p>
          <Link to="/forgot-password">Request a new link</Link>
        </>
      ) : (
        <form onSubmit={handleSubmit}>
          <label htmlFor="new-password">New password</label>
          <input
            id="new-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            maxLength={72}
            required
          />

          <label htmlFor="confirm-password">Confirm new password</label>
          <input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            maxLength={72}
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? "Updating..." : "Reset Password"}
          </button>

          {error && <p role="alert">{error}</p>}
        </form>
      )}

      <p><Link to="/login">Back to sign in</Link></p>
    </main>
  );
}
