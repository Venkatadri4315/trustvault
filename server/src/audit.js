
const pool = require("./db");

async function writeAuditLog({
  actorUserId = null,
  action,
  documentId = null,
  targetUserId = null,
  outcome,
  details = {},
  db = pool,
}) {
  const allowedOutcomes = ["success", "denied", "failure"];

  if (!action || !allowedOutcomes.includes(outcome)) {
    throw new Error("Invalid audit log action or outcome.");
  }

  await db.query(
    `INSERT INTO audit_logs
      (actor_user_id, action, document_id, target_user_id, outcome, details)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [
      actorUserId,
      action,
      documentId,
      targetUserId,
      outcome,
      JSON.stringify(details),
    ]
  );
}

module.exports = { writeAuditLog };
