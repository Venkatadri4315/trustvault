
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { authService } from "../services/authService";

const AuthContext = createContext(null);

const TOKEN_KEY = "trustvault_token";
const USER_KEY = "trustvault_user";

function readStoredSession() {
  try {
    const token = sessionStorage.getItem(TOKEN_KEY);
    const userValue = sessionStorage.getItem(USER_KEY);

    if (!token || !userValue) {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);
      return null;
    }

    const user = JSON.parse(userValue);

    if (
      !user ||
      typeof user !== "object" ||
      Array.isArray(user) ||
      !user.id ||
      !user.role
    ) {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);
      return null;
    }

    return { token, user };
  } catch {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    return null;
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => readStoredSession());

  const logout = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    setSession(null);
  }, []);

  // Stage 1: Validate credentials and request an OTP.
  const login = useCallback(async ({ email, password }) => {
    const result = await authService.login({ email, password });

    if (result?.requiresOtp === true) {
      return {
        requiresOtp: true,
        email: result.email || email.trim().toLowerCase(),
        message: result.message || "Verification code sent to your email.",
      };
    }

    // Do not create a session unless the server actually returns one.
    if (!result?.token || !result?.user) {
      throw new Error("The server did not return a valid login session.");
    }

    const newSession = {
      token: result.token,
      user: result.user,
    };

    sessionStorage.setItem(TOKEN_KEY, newSession.token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(newSession.user));
    setSession(newSession);

    return result;
  }, []);

  // Stage 2: Verify the OTP and create the authenticated session.
  const verifyOtp = useCallback(async ({ email, otp }) => {
    const result = await authService.verifyOtp({ email, otp });

    if (!result?.token || !result?.user) {
      throw new Error(
        "OTP verification did not return a valid login session."
      );
    }

    const newSession = {
      token: result.token,
      user: result.user,
    };

    sessionStorage.setItem(TOKEN_KEY, newSession.token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(newSession.user));
    setSession(newSession);

    return result;
  }, []);

  const register = useCallback(async ({ email, password }) => {
    return authService.register({ email, password });
  }, []);

  useEffect(() => {
    if (!session?.token) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      logout();
    }, 15 * 60 * 1000);

    return () => window.clearTimeout(timeoutId);
  }, [session, logout]);

  const value = {
    session,
    token: session?.token ?? null,
    user: session?.user ?? null,
    isAuthenticated: Boolean(session?.token && session?.user),
    login,
    verifyOtp,
    register,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider.");
  }

  return context;
}
