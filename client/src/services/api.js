
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "/api")
  .replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function getStoredToken() {
  const keys = ["token", "authToken", "accessToken", "access_token"];

  for (const storage of [localStorage, sessionStorage]) {
    for (const key of keys) {
      const value = storage.getItem(key);
      if (value) return value;
    }
  }

  return null;
}

export async function apiRequest(
  path,
  { method = "GET", token, body, headers = {} } = {}
) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const requestHeaders = new Headers(headers);
  const authToken = token || getStoredToken();

  if (authToken) {
    requestHeaders.set("Authorization", `Bearer ${authToken}`);
  }

  const isFormData =
    typeof FormData !== "undefined" && body instanceof FormData;

  if (body !== undefined && !isFormData) {
    requestHeaders.set("Content-Type", "application/json");
  }

  let response;

  try {
    response = await fetch(`${API_BASE_URL}${normalizedPath}`, {
      method,
      headers: requestHeaders,
      body:
        body === undefined
          ? undefined
          : isFormData
            ? body
            : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      "Unable to connect to TrustVault. Check that the backend is running.",
      0
    );
  }

  if (response.status === 204) return null;

  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    let data;

    try {
      data = await response.json();
    } catch {
      throw new ApiError(
        "The server returned an invalid response.",
        response.status
      );
    }

    if (!response.ok) {
      throw new ApiError(
        data.error || data.message || "The request failed.",
        response.status
      );
    }

    return data;
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new ApiError(
      text || `The request failed (${response.status}).`,
      response.status
    );
  }

  return response;
}
