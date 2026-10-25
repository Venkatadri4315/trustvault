
require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
  override: true,
});

const app = require("./app");

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`TrustVault API running on port ${PORT}`);
  console.log(
    `CLIENT_URL: ${process.env.CLIENT_URL || "MISSING"}`
  );
});

server.on("error", (error) => {
  console.error("Server failed to start:", error.message);
});
