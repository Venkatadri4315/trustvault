
const pool = require("./db");

const VALID_ACTIONS = ["read", "edit", "download"];

async function checkDocumentAccess(userId, documentId, action) {
  if (!VALID_ACTIONS.includes(action)) {
    throw new Error("Unsupported document action.");
  }

  const result = await pool.query(
    `SELECT
       d.id,
       d.owner_id,
       CASE
         WHEN d.owner_id = $1 THEN TRUE
         WHEN $3 = 'read' AND p.permission IN (
           'read_only',
           'read_download',
           'edit_only',
           'edit_download'
         ) THEN TRUE
         WHEN $3 = 'edit' AND p.permission IN (
           'edit_only',
           'edit_download'
         ) THEN TRUE
         WHEN $3 = 'download' AND p.permission IN (
           'read_download',
           'edit_download'
         ) THEN TRUE
         ELSE FALSE
       END AS allowed
     FROM documents d
     LEFT JOIN document_permissions p
       ON p.document_id = d.id
      AND p.user_id = $1
      AND p.revoked_at IS NULL
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
