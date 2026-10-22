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



// POST /api/documents — Upload a document

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

            reason: tooLarge

              ? "File size limit exceeded"

              : "Upload rejected",

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

        validFile =

          fileBuffer.subarray(0, 5).toString("ascii") === "%PDF-";

      } else if (mimeType === "image/png") {

        validFile =

          fileBuffer.length >= 8 &&

          fileBuffer

            .subarray(0, 8)

            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));

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

          details: {

            reason: "File content validation failed",

          },

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

            owner_id,

            title,

            description,

            category,

            storage_key,

            original_filename,

            mime_type,

            size_bytes,

            sha256

          )

         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)

         RETURNING

           id,

           owner_id,

           title,

           description,

           category,

           original_filename,

           mime_type,

           size_bytes,

           sha256,

           created_at`,

        [

          req.user.id,

          title,

          description || null,

          category || null,

          path.basename(req.file.filename),

          originalFilename,

          mimeType,

          fileBuffer.length,

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

          details: {

            originalFilename,

            sizeBytes: fileBuffer.length,

            mimeType,

            sha256,

          },

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

          details: {

            reason: "Upload processing failed",

          },

        });

      } catch (auditError) {

        console.error(

          "Upload audit logging failed:",

          auditError.message

        );

      }



      return res.status(500).json({

        error: "Could not upload document.",

      });

    } finally {

      if (!fileSaved && req.file?.path) {

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



// GET /api/documents — List accessible documents

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

      details: {

        count: result.rows.length,

      },

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

// --------------------------------------------------

// POST /api/documents/:id/share — Share a document

// --------------------------------------------------

router.post("/:id/share", async (req, res) => {
  const documentId = req.params.id;

  const targetUserId = req.body?.userId;

  const permission = req.body?.permission;



  if (!/^[1-9]\d*$/.test(documentId)) {

    return res.status(400).json({

      error: "Invalid document ID.",

    });

  }



  if (

    !Number.isSafeInteger(targetUserId) ||

    targetUserId < 1 ||

    !["read", "edit"].includes(permission)

  ) {

    return res.status(400).json({

      error:

        "A valid numeric userId and permission (read or edit) are required.",

    });

  }



  let client;

  let transactionStarted = false;



  try {

    client = await pool.connect();



    await client.query("BEGIN");

    transactionStarted = true;



    const documentResult = await client.query(

      `SELECT id, owner_id

       FROM documents

       WHERE id = $1 AND deleted_at IS NULL

       FOR UPDATE`,

      [documentId]

    );



    if (documentResult.rows.length === 0) {

      await client.query("ROLLBACK");

      transactionStarted = false;



      await writeAuditLog({

        actorUserId: req.user.id,

        action: "DOCUMENT_SHARE",

        outcome: "denied",

        details: {

          reason: "Document not found",

        },

      });



      return res.status(404).json({

        error: "Document not found.",

      });

    }



    const document = documentResult.rows[0];



    if (String(document.owner_id) !== String(req.user.id)) {

      await client.query("ROLLBACK");

      transactionStarted = false;



      await writeAuditLog({

        actorUserId: req.user.id,

        action: "DOCUMENT_SHARE",

        documentId,

        targetUserId,

        outcome: "denied",

        details: {

          reason: "Only the owner can share a document",

        },

      });



      return res.status(403).json({

        error: "Only the document owner can manage sharing.",

      });

    }



    if (String(targetUserId) === String(document.owner_id)) {

      await client.query("ROLLBACK");

      transactionStarted = false;



      return res.status(400).json({

        error: "You cannot share a document with its owner.",

      });

    }



    const userResult = await client.query(

      `SELECT id

       FROM users

       WHERE id = $1 AND is_active = TRUE`,

      [targetUserId]

    );



    if (userResult.rows.length === 0) {

      await client.query("ROLLBACK");

      transactionStarted = false;



      return res.status(404).json({

        error: "Active target user not found.",

      });

    }



    const existingPermission = await client.query(

      `SELECT id

       FROM document_permissions

       WHERE document_id = $1

         AND user_id = $2

         AND revoked_at IS NULL

       FOR UPDATE`,

      [documentId, targetUserId]

    );



    let permissionResult;



    if (existingPermission.rows.length > 0) {

      permissionResult = await client.query(

        `UPDATE document_permissions

         SET permission = $1,

             granted_by = $2,

             granted_at = NOW()

         WHERE id = $3

         RETURNING id, document_id, user_id, permission, granted_at`,

        [

          permission,

          req.user.id,

          existingPermission.rows[0].id,

        ]

      );

    } else {

      permissionResult = await client.query(

        `INSERT INTO document_permissions

           (document_id, user_id, permission, granted_by)

         VALUES ($1, $2, $3, $4)

         RETURNING id, document_id, user_id, permission, granted_at`,

        [documentId, targetUserId, permission, req.user.id]

      );

    }



    // Write the audit entry in the same transaction.

    await writeAuditLog({

      actorUserId: req.user.id,

      action: "DOCUMENT_SHARE",

      documentId,

      targetUserId,

      outcome: "success",

      details: {

        permission,

      },

      db: client,

    });



    await client.query("COMMIT");

    transactionStarted = false;



    return res.status(200).json({

      message: "Document permission granted successfully.",

      permission: permissionResult.rows[0],

    });

  } catch (error) {

    if (client && transactionStarted) {

      try {

        await client.query("ROLLBACK");

        transactionStarted = false;

      } catch (rollbackError) {

        console.error(

          "Sharing rollback failed:",

          rollbackError.message

        );

      }

    }



    console.error("Document sharing failed:", error.message);



    try {

      await writeAuditLog({

        actorUserId: req.user.id,

        action: "DOCUMENT_SHARE",

        documentId,

        targetUserId,

        outcome: "failure",

        details: {

          reason: "Sharing operation failed",

        },

      });

    } catch (auditError) {

      console.error(

        "Sharing audit logging failed:",

        auditError.message

      );

    }



    return res.status(500).json({

      error: "Could not share document.",

    });

  } finally {

    if (client) {

      client.release();

    }

  }

});

// --------------------------------------------------

// DELETE /api/documents/:id/share/:userId — Revoke access

// --------------------------------------------------

router.delete("/:id/share/:userId", async (req, res) => {

  const {

    id: documentId,

    userId: targetUserId,

  } = req.params;



  if (

    !/^[1-9]\d*$/.test(documentId) ||

    !/^[1-9]\d*$/.test(targetUserId)

  ) {

    return res.status(400).json({

      error: "Invalid document ID or user ID.",

    });

  }



  let client;

  let transactionStarted = false;



  try {

    client = await pool.connect();



    await client.query("BEGIN");

    transactionStarted = true;



    const documentResult = await client.query(

      `SELECT owner_id

       FROM documents

       WHERE id = $1 AND deleted_at IS NULL

       FOR UPDATE`,

      [documentId]

    );



    if (documentResult.rows.length === 0) {

      await client.query("ROLLBACK");

      transactionStarted = false;



      await writeAuditLog({

        actorUserId: req.user.id,

        action: "DOCUMENT_SHARE_REVOKE",

        outcome: "denied",

        details: {

          reason: "Document not found",

        },

      });



      return res.status(404).json({

        error: "Document not found.",

      });

    }



    const document = documentResult.rows[0];



    if (String(document.owner_id) !== String(req.user.id)) {

      await client.query("ROLLBACK");

      transactionStarted = false;



      await writeAuditLog({

        actorUserId: req.user.id,

        action: "DOCUMENT_SHARE_REVOKE",

        documentId,

        targetUserId,

        outcome: "denied",

        details: {

          reason: "Only the owner can revoke access",

        },

      });



      return res.status(403).json({

        error: "Only the document owner can manage sharing.",

      });

    }



    const revokeResult = await client.query(

      `UPDATE document_permissions

       SET revoked_at = NOW()

       WHERE document_id = $1

         AND user_id = $2

         AND revoked_at IS NULL

       RETURNING id`,

      [documentId, targetUserId]

    );



    if (revokeResult.rows.length === 0) {

      await client.query("ROLLBACK");

      transactionStarted = false;



      await writeAuditLog({

        actorUserId: req.user.id,

        action: "DOCUMENT_SHARE_REVOKE",

        documentId,

        targetUserId,

        outcome: "denied",

        details: {

          reason: "No active permission found",

        },

      });



      return res.status(404).json({

        error: "No active permission found for this user.",

      });

    }



    await writeAuditLog({

      actorUserId: req.user.id,

      action: "DOCUMENT_SHARE_REVOKE",

      documentId,

      targetUserId,

      outcome: "success",

      db: client,

    });



    await client.query("COMMIT");

    transactionStarted = false;



    return res.status(200).json({

      message: "Document access revoked successfully.",

    });

  } catch (error) {

    if (client && transactionStarted) {

      try {

        await client.query("ROLLBACK");

        transactionStarted = false;

      } catch (rollbackError) {

        console.error(

          "Revocation rollback failed:",

          rollbackError.message

        );

      }

    }



    console.error("Permission revocation failed:", error.message);



    try {

      await writeAuditLog({

        actorUserId: req.user.id,

        action: "DOCUMENT_SHARE_REVOKE",

        documentId,

        targetUserId,

        outcome: "failure",

        details: {

          reason: "Revocation operation failed",

        },

      });

    } catch (auditError) {

      console.error(

        "Revocation audit logging failed:",

        auditError.message

      );

    }



    return res.status(500).json({

      error: "Could not revoke document access.",

    });

  } finally {

    if (client) {

      client.release();

    }

  }

});

// --------------------------------------------------

// --------------------------------------------------
// DELETE /api/documents/:id — Soft-delete a document
// Only the document owner may delete it.
// --------------------------------------------------
router.delete("/:id", async (req, res) => {
  const documentId = req.params.id;
  const actorUserId = req.user.id;

  if (!/^[1-9]\d*$/.test(documentId)) {
    return res.status(400).json({
      error: "Invalid document ID.",
    });
  }

  let client;
  let transactionStarted = false;

  try {
    client = await pool.connect();
    await client.query("BEGIN");
    transactionStarted = true;

    const result = await client.query(
      `SELECT id, owner_id
       FROM documents
       WHERE id = $1
         AND deleted_at IS NULL
       FOR UPDATE`,
      [documentId]
    );

    const document = result.rows[0];

    if (!document) {
      await writeAuditLog({
        actorUserId,
        action: "DOCUMENT_DELETE",
        documentId,
        outcome: "denied",
        details: { reason: "Document not found" },
        db: client,
      });

      await client.query("COMMIT");
      transactionStarted = false;

      return res.status(404).json({
        error: "Document not found.",
      });
    }

    if (String(document.owner_id) !== String(actorUserId)) {
      await writeAuditLog({
        actorUserId,
        action: "DOCUMENT_DELETE",
        documentId,
        outcome: "denied",
        details: { reason: "Only the document owner can delete it" },
        db: client,
      });

      await client.query("COMMIT");
      transactionStarted = false;

      // Return 404 to avoid disclosing whether another user's document exists.
      return res.status(404).json({
        error: "Document not found.",
      });
    }

    await client.query(
      `UPDATE documents
       SET deleted_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
         AND owner_id = $2
         AND deleted_at IS NULL`,
      [documentId, actorUserId]
    );

    await writeAuditLog({
      actorUserId,
      action: "DOCUMENT_DELETE",
      documentId,
      outcome: "success",
      details: { deletion_type: "soft_delete" },
      db: client,
    });

    await client.query("COMMIT");
    transactionStarted = false;

    return res.status(200).json({
      message: "Document deleted successfully.",
      documentId,
    });
  } catch (error) {
    if (client && transactionStarted) {
      await client.query("ROLLBACK").catch(() => {});
    }

    console.error("Document deletion failed:", error.message);

    return res.status(500).json({
      error: "Unable to delete document.",
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// GET /api/documents/:id/download — Download a document

// --------------------------------------------------

router.get("/:id/download", async (req, res) => {

  const documentId = req.params.id;



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

        action: "DOCUMENT_DOWNLOAD",

        documentId: access.exists ? documentId : null,

        outcome: "denied",

        details: {

          reason: access.exists

            ? "Access denied"

            : "Document not found",

        },

      });



      return res.status(404).json({

        error: "Document not found.",

      });

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

        details: {

          reason: "Document no longer available",

        },

      });



      return res.status(404).json({

        error: "Document not found.",

      });

    }



    const document = result.rows[0];

    const storageKey = document.storage_key;



    // Accept only a filename, not a path.

    if (

      typeof storageKey !== "string" ||

      !storageKey ||

      path.basename(storageKey) !== storageKey ||

      storageKey === "." ||

      storageKey === ".."

    ) {

      await writeAuditLog({

        actorUserId: req.user.id,

        action: "DOCUMENT_DOWNLOAD",

        documentId,

        outcome: "failure",

        details: {

          reason: "Invalid storage path",

        },

      });



      return res.status(500).json({

        error: "Could not download document.",

      });

    }



    const filePath = path.resolve(UPLOAD_DIR, storageKey);



    if (path.dirname(filePath) !== UPLOAD_DIR) {

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

            details: {

              reason: error

                ? "File transfer failed"

                : "File transfer completed",

            },

          });

        } catch (auditError) {

          console.error(

            "Download audit logging failed:",

            auditError.message

          );

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

        outcome: "failure",

        details: {

          reason:

            error.code === "ENOENT"

              ? "Stored file is missing"

              : "Download processing failed",

        },

      });

    } catch (auditError) {

      console.error(

        "Download audit logging failed:",

        auditError.message

      );

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

// --------------------------------------------------

// GET /api/documents/:id — Get document metadata

// --------------------------------------------------

router.get("/:id", async (req, res) => {

  const documentId = req.params.id;



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



      return res.status(404).json({

        error: "Document not found.",

      });

    }



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

        details: {

          reason: "Document no longer available",

        },

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