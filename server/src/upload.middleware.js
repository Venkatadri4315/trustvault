
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");

const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const ALLOWED_TYPES = new Map([
  ["application/pdf", ".pdf"],
  ["text/plain", ".txt"],
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
]);

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, UPLOAD_DIR);
  },

  filename: (_req, _file, callback) => {
    // Use a random server-generated name, not the original filename.
    callback(null, crypto.randomUUID());
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
    fields: 10,
    parts: 11,
  },

  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_TYPES.has(file.mimetype)) {
      return callback(
        new Error("Unsupported file type. Allowed: PDF, TXT, JPG, PNG.")
      );
    }

    callback(null, true);
  },
});

module.exports = {
  upload,
  ALLOWED_TYPES,
  MAX_FILE_SIZE,
};
