
require("dotenv").config();

const app = require("./app");

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`TrustVault API running on port ${PORT}`);
});

server.on("error", (error) => {
  console.error("Server failed to start:", error.message);
});
