
const express = require("express");
const helmet = require("helmet");
const authRoutes = require("./auth.routes");
const documentRoutes = require("./document.routes");
const { requireAuth } = require("./auth.middleware");

const app = express();

app.use(helmet());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "TrustVault API",
  });
});

// Temporary endpoint for testing JWT authentication
app.get("/api/protected", requireAuth, (req, res) => {
  res.status(200).json({
    message: "Authentication successful.",
    user: req.user,
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);

module.exports = app;
