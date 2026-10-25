
const express = require("express");
const cors = require("cors");

const authRoutes = require("./auth.routes");
const documentRoutes = require("./document.routes");

const app = express();

const allowedOrigins = [
  "https://trustvault-hazel.vercel.app",
  "https://trustvault-git-main-trust-vault12.vercel.app",
  "https://trustvault-nczlnxghr-trust-vault12.vercel.app",
];

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "TrustVault API" });
});

app.get(
  "/api/protected",
  require("./auth.middleware").requireAuth,
  (req, res) => {
    res.json({ message: "Authenticated access granted", user: req.user });
  }
);

app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);

module.exports = app;
