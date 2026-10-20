
const express = require("express");
const pool = require("./db");
const { requireAuth } = require("./auth.middleware");
const { checkDocumentAccess } = require("./document-access");

const router = express.Router();

router.use(requireAuth);

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
       FROM documents d
       LEFT JOIN document_permissions p
         ON p.document_id = d.id
        AND p.user_id = $1
        AND p.revoked_at IS NULL
       WHERE d.deleted_at IS NULL
         AND (d.owner_id = $1 OR p.id IS NOT NULL)
       ORDER BY d.created_at DESC`,
      [req.user.id]
    );

    return res.json({ documents: result.rows });
  } catch (error) {
    console.error("Document listing failed:", error.message);
    return res.status(500).json({ error: "Could not list documents." });
  }
});

// Get document metadata only when the user has read access.
router.get("/:id", async (req, res) => {
  try {
    const documentId = req.params.id;

    if (!/^[1-9]\d*$/.test(documentId)) {
      return res.status(400).json({ error: "Invalid document ID." });
    }

    const access = await checkDocumentAccess(
      req.user.id,
      documentId,
      "read"
    );

    if (!access.exists || !access.allowed) {
      return res.status(404).json({ error: "Document not found." });
    }

    const result = await pool.query(
      `SELECT id, owner_id, title, description, category,
              original_filename, mime_type, size_bytes,
              sha256, created_at, updated_at
       FROM documents
       WHERE id = $1 AND deleted_at IS NULL`,
      [documentId]
    );

    return res.json({ document: result.rows[0] });
  } catch (error) {
    console.error("Document retrieval failed:", error.message);
    return res.status(500).json({ error: "Could not retrieve document." });
  }
});

module.exports = router;
