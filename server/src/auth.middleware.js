
const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Authentication required.",
    });
  }

  const token = authorization.slice(7).trim();

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: "trustvault",
      audience: "trustvault-client",
      algorithms: ["HS256"],
    });

    if (!payload.sub || !payload.role) {
      return res.status(401).json({
        error: "Invalid authentication token.",
      });
    }

    req.user = {
      id: payload.sub,
      role: payload.role,
    };

    return next();
  } catch {
    return res.status(401).json({
      error: "Invalid or expired token.",
    });
  }
}

module.exports = { requireAuth };
