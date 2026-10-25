
import { useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../services/api.js";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    setLoading(true);

    try {
      const result = await apiRequest("/auth/forgot-password", {
        method: "POST",
        body: { email: email.trim() },
      });

      setMessage(
        result?.message || "If an active account exists, a reset link will be sent."
      );
    } catch (err) {
      setError(err.message || "Unable to submit your request.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <h1>Forgot Password?</h1>
      <p>Enter your account email to request a password-reset link.</p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="reset-email">Email address</label>
        <input
          id="reset-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
          maxLength={254}
        />

        <button type="submit" disabled={loading}>
          {loading ? "Sending..." : "Send Reset Link"}
        </button>
      </form>

      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}

      <p>
        <Link to="/login">Back to sign in</Link>
      </p>
    </main>
  );
}
