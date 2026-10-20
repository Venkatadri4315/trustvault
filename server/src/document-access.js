
const pool = require("./db");

/**
 * Check whether a user can perform an action on a document.
 * Owners can read and edit their own documents.
 * Shared users need an active read or edit permission.
 */
async function checkDocumentAccess(userId, documentId, action) {
  if (!["read", "edit"].includes(action)) {
    throw new Error("Unsupported document action.");
  }

  const result = await pool.query(
    `SELECT
       d.id,
       d.owner_id,
       CASE
         WHEN d.owner_id = $1 THEN TRUE
         WHEN $3 = 'read' AND EXISTS (
           SELECT 1
           FROM document_permissions p
           WHERE p.document_id = d.id
             AND p.user_id = $1
             AND p.revoked_at IS NULL
             AND p.permission IN ('read', 'edit')
         ) THEN TRUE
         WHEN $3 = 'edit' AND EXISTS (
           SELECT 1
           FROM document_permissions p
           WHERE p.document_id = d.id
             AND p.user_id = $1
             AND p.revoked_at IS NULL
             AND p.permission = 'edit'
         ) THEN TRUE
         ELSE FALSE
       END AS allowed
     FROM documents d
     WHERE d.id = $2
       AND d.deleted_at IS NULL`,
    [userId, documentId, action]
  );

  if (result.rows.length === 0) {
    return { exists: false, allowed: false };
  }

  return {
    exists: true,
    allowed: result.rows[0].allowed,
    ownerId: result.rows[0].owner_id,
  };
}

module.exports = { checkDocumentAccess };
