
const express = require("express");
const helmet = require("helmet");

const app = express();

app.use(helmet());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "TrustVault API",
  });
});

module.exports = app;
