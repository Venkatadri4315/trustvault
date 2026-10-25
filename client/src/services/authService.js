
import { apiRequest } from "./api.js";

const TOKEN_KEY = "token";
const USER_KEY = "trustvault_user";

export const authService = {
  async register({ email, password }) {
    return apiRequest("/auth/register", {
      method: "POST",
      body: { email, password },
    });
  },

  async login({ email, password }) {
    return apiRequest("/auth/login", {
      method: "POST",
      body: { email, password },
    });
  },

  async verifyOtp({ email, otp }) {
    const response = await apiRequest("/auth/verify-otp", {
      method: "POST",
      body: { email, otp },
    });

    if (!response?.token) {
      throw new Error("Login succeeded without a token.");
    }

    localStorage.setItem(TOKEN_KEY, response.token);

    if (response.user) {
      localStorage.setItem(USER_KEY, JSON.stringify(response.user));
    }

    return response;
  },

  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },

  getUser() {
    const user = localStorage.getItem(USER_KEY);
    return user ? JSON.parse(user) : null;
  },

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};
