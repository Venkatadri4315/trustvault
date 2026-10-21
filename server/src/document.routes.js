
const express = require("express");
const pool = require("./db");
const { requireAuth } = require("./auth.middleware");
const { checkDocumentAccess } = require("./document-access");
const { writeAuditLog } = require("./audit");

const router = express.Router();

// All document routes require authentication.
router.use(requireAuth);

// GET /documents
// List documents owned by the current user or actively shared with them.
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT
         d.id,
         d.title,
         d.description,
         d.category,
         d.original_filename,
         d.mime_type,
         d.size_bytes,
         d.owner_id,
         d.created_at,
         d.updated_at,
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

    return res.status(200).json({
      documents: result.rows,
    });
  } catch (error) {
    console.error("Document listing failed:", error.message);

    return res.status(500).json({
      error: "Could not list documents.",
    });
  }
});

// GET /documents/:id
// Retrieve document metadata only when the user has read access.
router.get("/:id", async (req, res) => {
  const documentId = req.params.id;

  // Validate a positive integer ID.
  if (!/^[1-9]\d*$/.test(documentId)) {
    return res.status(400).json({
      error: "Invalid document ID.",
    });
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
          reason: access.exists
            ? "Access denied"
            : "Document not found",
        },
      });

      // Use the same response for missing and inaccessible documents.
      return res.status(404).json({
        error: "Document not found.",
      });
    }

    // Recheck existence and deletion status in the metadata query.
    const result = await pool.query(
      `SELECT
         d.id,
         d.owner_id,
         d.title,
         d.description,
         d.category,
         d.original_filename,
         d.mime_type,
         d.size_bytes,
         d.sha256,
         d.created_at,
         d.updated_at
       FROM documents AS d
       WHERE d.id = $1
         AND d.deleted_at IS NULL`,
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

      return res.status(404).json({
        error: "Document not found.",
      });
    }

    await writeAuditLog({
      actorUserId: req.user.id,
      action: "DOCUMENT_READ",
      documentId,
      outcome: "success",
    });

    return res.status(200).json({
      document: result.rows[0],
    });
  } catch (error) {
    console.error("Document retrieval failed:", error.message);

    return res.status(500).json({
      error: "Could not retrieve document.",
    });
  }
});

module.exports = router;
