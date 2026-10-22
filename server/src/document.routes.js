
const express = require("express");
const pool = require("./db");
const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");

const { requireAuth } = require("./auth.middleware");
const { checkDocumentAccess } = require("./document-access");
const { writeAuditLog } = require("./audit");
const { upload } = require("./upload.middleware");

const router = express.Router();
const UPLOAD_DIR = path.resolve(__dirname, "..", "uploads");

router.use(requireAuth);

// POST /api/documents
// Upload a document and save its metadata.
router.post("/", (req, res) => {
  upload.single("file")(req, res, async (uploadError) => {
    if (uploadError) {
      const tooLarge = uploadError.code === "LIMIT_FILE_SIZE";

      try {
        await writeAuditLog({
          actorUserId: req.user.id,
          action: "DOCUMENT_UPLOAD",
          outcome: "failure",
          details: {
            reason: tooLarge ? "File size limit exceeded" : "Upload rejected",
          },
        });
      } catch (error) {
        console.error("Upload audit logging failed:", error.message);
      }

      return res.status(tooLarge ? 413 : 400).json({
        error: tooLarge
          ? "File exceeds the 5 MB limit."
          : uploadError.message || "Upload failed.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: 'Select a file using the "file" field.',
      });
    }

    let fileSaved = false;

    try {
      const title =
        typeof req.body.title === "string" ? req.body.title.trim() : "";
      const description =
        typeof req.body.description === "string"
          ? req.body.description.trim()
          : "";
      const category =
        typeof req.body.category === "string"
          ? req.body.category.trim()
          : "";

      if (!title || title.length > 255) {
        return res.status(400).json({
          error: "Title is required and must not exceed 255 characters.",
        });
      }

      if (description.length > 2000 || category.length > 100) {
        return res.status(400).json({
          error: "Description or category exceeds the allowed length.",
        });
      }

      const fileBuffer = await fs.readFile(req.file.path);
      const mimeType = req.file.mimetype;
      let validFile = false;

      if (mimeType === "application/pdf") {
        validFile = fileBuffer.subarray(0, 5).toString("ascii") === "%PDF-";
      } else if (mimeType === "image/png") {
        validFile =
          fileBuffer.length >= 8 &&
          fileBuffer.subarray(0, 8).equals(
            Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
          );
      } else if (mimeType === "image/jpeg") {
        validFile =
          fileBuffer.length >= 3 &&
          fileBuffer[0] === 0xff &&
          fileBuffer[1] === 0xd8 &&
          fileBuffer[2] === 0xff;
      } else if (mimeType === "text/plain") {
        try {
          new TextDecoder("utf-8", { fatal: true }).decode(fileBuffer);
          validFile = !fileBuffer.includes(0);
        } catch {
          validFile = false;
        }
      }

      if (!validFile || fileBuffer.length === 0) {
        await writeAuditLog({
          actorUserId: req.user.id,
          action: "DOCUMENT_UPLOAD",
          outcome: "denied",
          details: { reason: "File content validation failed" },
        });

        return res.status(400).json({
          error: "File content does not match a supported file type.",
        });
      }

      const sha256 = crypto
        .createHash("sha256")
        .update(fileBuffer)
        .digest("hex");

      const originalFilename = path
        .basename(String(req.file.originalname).replace(/\\/g, "/"))
        .slice(0, 255);

      const result = await pool.query(
        `INSERT INTO documents
          (
            owner_id, title, description, category, storage_key,
            original_filename, mime_type, size_bytes, sha256
          )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING
           id, owner_id, title, description, category,
           original_filename, mime_type, size_bytes, sha256, created_at`,
        [
          req.user.id,
          title,
          description || null,
          category || null,
          req.file.filename,
          originalFilename,
          mimeType,
          req.file.size,
          sha256,
        ]
      );

      fileSaved = true;

      try {
        await writeAuditLog({
          actorUserId: req.user.id,
          action: "DOCUMENT_UPLOAD",
          documentId: result.rows[0].id,
          outcome: "success",
          details: { sizeBytes: req.file.size, mimeType, sha256 },
        });
      } catch (error) {
        console.error("Upload audit logging failed:", error.message);
      }

      return res.status(201).json({
        message: "Document uploaded successfully.",
        document: result.rows[0],
      });
    } catch (error) {
      console.error("Document upload failed:", error.message);

      try {
        await writeAuditLog({
          actorUserId: req.user.id,
          action: "DOCUMENT_UPLOAD",
          outcome: "failure",
          details: { reason: "Upload processing failed" },
        });
      } catch (auditError) {
        console.error("Upload audit logging failed:", auditError.message);
      }

      return res.status(500).json({
        error: "Could not upload document.",
      });
    } finally {
      if (!fileSaved) {
        try {
          await fs.unlink(req.file.path);
        } catch (error) {
          if (error.code !== "ENOENT") {
            console.error("Upload cleanup failed:", error.message);
          }
        }
      }
    }
  });
});

// GET /api/documents
// List documents owned by the current user or actively shared with them.
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT
         d.id, d.title, d.description, d.category,
         d.original_filename, d.mime_type, d.size_bytes,
         d.owner_id, d.created_at, d.updated_at,
         CASE
           WHEN d.owner_id = $1 THEN 'owner'
           ELSE p.permission
         END AS access_level
       FROM documents AS d
       LEFT JOIN document_permissions AS p
         ON p.document_id = d.id
        AND p.user_id = $1
        AND p.revoked_at IS NULL
       WHERE d.deleted_at IS NULL
         AND (d.owner_id = $1 OR p.id IS NOT NULL)
       ORDER BY d.created_at DESC`,
      [req.user.id]
    );

    await writeAuditLog({
      actorUserId: req.user.id,
      action: "DOCUMENT_LIST",
      outcome: "success",
      details: { count: result.rows.length },
    });

    return res.status(200).json({ documents: result.rows });
  } catch (error) {
    console.error("Document listing failed:", error.message);
    return res.status(500).json({ error: "Could not list documents." });
  }
});

// GET /api/documents/:id/download
// Download only if the authenticated user has read permission.
router.get("/:id/download", async (req, res) => {
  const documentId = req.params.id;

  if (!/^[1-9]\d*$/.test(documentId)) {
    return res.status(400).json({ error: "Invalid document ID." });
  }

  try {
    const access = await checkDocumentAccess(
      req.user.id,
      documentId,
      "read"
    );

    if (!access.exists || !access.allowed) {
      await writeAuditLog({
        actorUserId: req.user.id,
        action: "DOCUMENT_DOWNLOAD",
        documentId: access.exists ? documentId : null,
        outcome: "denied",
        details: {
          reason: access.exists ? "Access denied" : "Document not found",
        },
      });

      return res.status(404).json({ error: "Document not found." });
    }

    const result = await pool.query(
      `SELECT storage_key, original_filename, mime_type
       FROM documents
       WHERE id = $1 AND deleted_at IS NULL`,
      [documentId]
    );

    if (result.rows.length === 0) {
      await writeAuditLog({
        actorUserId: req.user.id,
        action: "DOCUMENT_DOWNLOAD",
        documentId,
        outcome: "denied",
        details: { reason: "Document no longer available" },
      });

      return res.status(404).json({ error: "Document not found." });
    }

    const document = result.rows[0];
    const filePath = path.resolve(UPLOAD_DIR, document.storage_key);

    // Only allow files directly inside the uploads directory.
    if (path.dirname(filePath) !== UPLOAD_DIR) {
      await writeAuditLog({
        actorUserId: req.user.id,
        action: "DOCUMENT_DOWNLOAD",
        documentId,
        outcome: "failure",
        details: { reason: "Invalid storage path" },
      });

      return res.status(500).json({
        error: "Could not download document.",
      });
    }

    await fs.access(filePath);

    res.setHeader("X-Content-Type-Options", "nosniff");

    return res.download(
      filePath,
      document.original_filename,
      {
        headers: {
          "Content-Type": document.mime_type,
        },
      },
      async (error) => {
        try {
          await writeAuditLog({
            actorUserId: req.user.id,
            action: "DOCUMENT_DOWNLOAD",
            documentId,
            outcome: error ? "failure" : "success",
            details: error
              ? { reason: "File transfer failed" }
              : { reason: "File transfer completed" },
          });
        } catch (auditError) {
          console.error("Download audit logging failed:", auditError.message);
        }

        if (error) {
          console.error("Document download failed:", error.message);

          if (!res.headersSent) {
            res.status(500).json({
              error: "Could not download document.",
            });
          }
        }
      }
    );
  } catch (error) {
    console.error("Document download failed:", error.message);

    try {
      await writeAuditLog({
        actorUserId: req.user.id,
        action: "DOCUMENT_DOWNLOAD",
        documentId,
        outcome: error.code === "ENOENT" ? "failure" : "failure",
        details: {
          reason:
            error.code === "ENOENT"
              ? "Stored file is missing"
              : "Download processing failed",
        },
      });
    } catch (auditError) {
      console.error("Download audit logging failed:", auditError.message);
    }

    if (!res.headersSent) {
      return res.status(error.code === "ENOENT" ? 404 : 500).json({
        error:
          error.code === "ENOENT"
            ? "Document file not found."
            : "Could not download document.",
      });
    }
  }
});

// GET /api/documents/:id
// Return metadata only if the user has read access.
router.get("/:id", async (req, res) => {
  const documentId = req.params.id;

  if (!/^[1-9]\d*$/.test(documentId)) {
    return res.status(400).json({ error: "Invalid document ID." });
  }

  try {
    const access = await checkDocumentAccess(
      req.user.id,
      documentId,
      "read"
    );

    if (!access.exists || !access.allowed) {
      await writeAuditLog({
        actorUserId: req.user.id,
        action: "DOCUMENT_READ",
        documentId: access.exists ? documentId : null,
        outcome: "denied",
        details: {
          reason: access.exists ? "Access denied" : "Document not found",
        },
      });

      return res.status(404).json({ error: "Document not found." });
    }

    const result = await pool.query(
      `SELECT
         d.id, d.owner_id, d.title, d.description, d.category,
         d.original_filename, d.mime_type, d.size_bytes, d.sha256,
         d.created_at, d.updated_at
       FROM documents AS d
       WHERE d.id = $1 AND d.deleted_at IS NULL`,
      [documentId]
    );

    if (result.rows.length === 0) {
      await writeAuditLog({
        actorUserId: req.user.id,
        action: "DOCUMENT_READ",
        documentId,
        outcome: "denied",
        details: { reason: "Document no longer available" },
      });

      return res.status(404).json({ error: "Document not found." });
    }

    await writeAuditLog({
      actorUserId: req.user.id,
      action: "DOCUMENT_READ",
      documentId,
      outcome: "success",
    });

    return res.status(200).json({ document: result.rows[0] });
  } catch (error) {
    console.error("Document retrieval failed:", error.message);
    return res.status(500).json({ error: "Could not retrieve document." });
  }
});

module.exports = router;
