
const express = require("express");

const authRoutes = require("./auth.routes");
const documentRoutes = require("./document.routes");

const app = express();

app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/protected", require("./auth.middleware").requireAuth, (req, res) => {
  res.json({ message: "Authenticated access granted", user: req.user });
});

app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);

module.exports = app;
