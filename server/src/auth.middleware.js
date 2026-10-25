
const jwt = require("jsonwebtoken");

const ALLOWED_ROLES = ["admin", "owner", "viewer"];

function requireAuth(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Authentication required.",
    });
  }

  const token = authorization.slice(7).trim();
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    console.error("JWT_SECRET is missing from the server environment.");
    return res.status(500).json({
      error: "Authentication configuration error.",
    });
  }

  try {
    const payload = jwt.verify(token, secret, {
      algorithms: ["HS256"],
      issuer: "trustvault",
      audience: "trustvault-client",
    });

    if (
      !payload.sub ||
      !ALLOWED_ROLES.includes(payload.role)
    ) {
      return res.status(401).json({
        error: "Invalid authentication token.",
      });
    }

    req.user = {
      id: payload.sub,
      role: payload.role,
    };

    return next();
  } catch (error) {
    // Log the reason, never the token itself.
    console.error("JWT verification failed:", error.name, error.message);

    return res.status(401).json({
      error: "Invalid or expired token.",
    });
  }
}

module.exports = { requireAuth };
