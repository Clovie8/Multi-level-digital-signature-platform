const db = require('../config/db');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// S3 / Cloudflare R2 Imports (Consolidated)
const { 
    uploadToR2, 
    getPresignedPdfUrl, 
    getFileBufferFromR2, 
    uploadBufferToR2 
} = require('../utils/s3Manager');

// Email Manager Imports
const { 
    sendSignatureEmail, 
    sendOTPEmail, 
    sendCompletionEmail 
} = require('../utils/emailManager'); 

// PDF Manager Imports (Added appendAuditTrail!)
const { 
    stampDocument, 
    appendAuditTrail 
} = require('../utils/pdfManager');




const uploadDocument = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No PDF file uploaded.' });
        }

        const initiatorId = req.user.userId; 
        const originalName = req.file.originalname;

        // Upload the buffer directly to Cloudflare R2
        const r2FileKey = await uploadToR2(req.file.buffer, originalName);

        const insertQuery = `
            INSERT INTO documents (initiator_id, file_name, original_file_path, status)
            VALUES ($1, $2, $3, 'draft')
            RETURNING id, file_name, status, created_at;
        `;
        
        // Save the R2 file key into the 'original_file_path' column
        const { rows } = await db.query(insertQuery, [
            initiatorId, 
            originalName, 
            r2FileKey 
        ]);

        res.status(201).json({
            message: 'Document uploaded securely to Cloud',
            document: rows[0]
        });

    } catch (error) {
        console.error('Upload Error:', error);
        res.status(500).json({ error: 'Failed to process document upload' });
    }
};

// The Dispatch Function 
const dispatchDocument = async (req, res) => {
    try {
        await db.query('BEGIN');
        
        const { id } = req.params;
        // Notice we are now receiving 'fields' from the frontend canvas too
        const { signers, fields } = req.body; 

        await db.query(`
            UPDATE documents 
            SET status = 'pending', updated_at = CURRENT_TIMESTAMP 
            WHERE id = $1
        `, [id]);

        let firstSignerToken = null;
        let firstSignerEmail = null;
        let firstSignerName = null;

        for (let i = 0; i < signers.length; i++) {
            const signer = signers[i];
            const stepOrder = i + 1; 

            // Filter the canvas fields that belong specifically to this signer
            const signerFields = fields ? fields.filter(f => f.signerId === signer.id) : [];
            // Convert to a JSON string so PostgreSQL can save it in the JSONB column
            const signatureUIData = JSON.stringify(signerFields);

            const stepResult = await db.query(`
                INSERT INTO workflow_steps (
                    document_id, signer_email, signer_name, step_order, status, signature_ui_data
                )
                VALUES ($1, $2, $3, $4, 'pending', $5)
                RETURNING access_token;
            `, [id, signer.email, signer.name, stepOrder, signatureUIData]);

            if (stepOrder === 1) {
                firstSignerToken = stepResult.rows[0].access_token;
                firstSignerEmail = signer.email;
                firstSignerName = signer.name;
            }
        }

        await db.query(`
            INSERT INTO audit_logs (document_id, action, actor_email, ip_address)
            VALUES ($1, 'DOCUMENT_DISPATCHED', $2, $3)
        `, [id, req.user.email, req.ip || req.connection.remoteAddress]);

        const docRes = await db.query('SELECT file_name FROM documents WHERE id = $1', [id]);
        const documentName = docRes.rows[0].file_name;

        await db.query('COMMIT');

        // --- PHASE 1: CONDITIONAL BRANCHING ---
        let isInitiatorFirst = false;

        // Check if Level 1 is the person currently logged in
        if (firstSignerEmail === req.user.email) {
            isInitiatorFirst = true;
            // Path A: Do NOT fire the email. We will redirect them instead.
            console.log(`Initiator is Level 1. Skipping email. Token: ${firstSignerToken}`);
        } else if (firstSignerEmail) {
            // Path B: It is a third party. Fire the email securely.
            await sendSignatureEmail(firstSignerEmail, firstSignerName, firstSignerToken, documentName);
        }

        // Return the token ONLY if the initiator is first, otherwise return null for security
        res.status(200).json({ 
            message: 'Document dispatched.',
            isInitiatorFirst: isInitiatorFirst,
            redirectToken: isInitiatorFirst ? firstSignerToken : null
        });

    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Dispatch Error:', error);
        res.status(500).json({ error: 'Failed to dispatch document workflow' });
    }
};


// Helper: Zero-Trust Cryptographic Verification & Release
async function releaseDocumentForSigning(stepData) {
    const targetFileKey = stepData.signed_file_path || stepData.original_file_path;

    // Zero-Trust: If this is NOT the very first signature, verify the physical file in R2 matches the DB hash exactly
    if (stepData.step_order > 1) {
        const docRes = await db.query('SELECT current_hash FROM documents WHERE id = $1', [stepData.document_id]);
        const currentHash = docRes.rows[0].current_hash;

        const { getFileBufferFromR2 } = require('../utils/s3Manager');
        const fileBuffer = await getFileBufferFromR2(targetFileKey);
        const actualHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

        if (actualHash !== currentHash) {
            throw new Error('Document Integrity Compromised: The file has been tampered with since the last signature.');
        }
    }

    const securePdfUrl = await getPresignedPdfUrl(targetFileKey);
    const parsedFields = typeof stepData.signature_ui_data === 'string' 
        ? JSON.parse(stepData.signature_ui_data) 
        : stepData.signature_ui_data;

    return {
        pdfUrl: securePdfUrl,
        signer: {
            id: stepData.step_id,
            name: stepData.signer_name,
            email: stepData.signer_email
        },
        fields: parsedFields || []
    };
}

const getSigningView = async (req, res) => {
    try {
        const { token } = req.params;

        const query = `
            SELECT 
                ws.id AS step_id, ws.signer_name, ws.signer_email, ws.status AS step_status, ws.signature_ui_data, ws.step_order, ws.document_id,
                d.file_name, d.original_file_path, d.signed_file_path, d.status AS doc_status
            FROM workflow_steps ws
            JOIN documents d ON ws.document_id = d.id
            WHERE ws.access_token = $1
        `;
        
        const { rows } = await db.query(query, [token]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Invalid or expired signing link.' });
        }

        const stepData = rows[0];

        if (stepData.step_status !== 'pending') {
            return res.status(400).json({ error: 'This document has already been signed or voided by this user.' });
        }

        // Check if the requester is the logged in Initiator via HTTP-Only cookie
        const sessionToken = req.cookies?.token; 
        let loggedInEmail = null;
        if (sessionToken) {
            try {
                const decoded = jwt.verify(sessionToken, process.env.JWT_SECRET);
                const userRes = await db.query('SELECT email FROM users WHERE id = $1', [decoded.userId]);
                loggedInEmail = userRes.rows[0]?.email;
            } catch (err) { console.error('JWT Error in getSigningView:', err); }
        }

        const isInitiator = loggedInEmail && loggedInEmail === stepData.signer_email;

        // Path A: Initiator bypasses OTP
        if (isInitiator) {
            try {
                const releaseData = await releaseDocumentForSigning(stepData);
                return res.status(200).json(releaseData);
            } catch (hashError) {
                return res.status(400).json({ error: hashError.message });
            }
        }

        // Path B: Third Party requires OTP Authentication
        return res.status(200).json({
            requiresOtp: true,
            signer: {
                id: stepData.step_id,
                name: stepData.signer_name,
                email: stepData.signer_email
            }
        });

    } catch (error) {
        console.error('Fetch Signing View Error:', error);
        res.status(500).json({ error: 'Server error loading the signing space.' });
    }
};

const requestOTP = async (req, res) => {
    try {
        const { token } = req.params;
        const { rows } = await db.query('SELECT id, signer_email, signer_name FROM workflow_steps WHERE access_token = $1 AND status = $2', [token, 'pending']);
        if (rows.length === 0) return res.status(404).json({ error: 'Invalid request.' });
        
        const step = rows[0];
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        await db.query(`
            UPDATE workflow_steps 
            SET otp_code = $1, otp_expires_at = CURRENT_TIMESTAMP + INTERVAL '15 minutes'
            WHERE id = $2
        `, [otp, step.id]);

        await sendOTPEmail(step.signer_email, step.signer_name, otp);
        res.status(200).json({ message: 'OTP sent successfully.' });
    } catch (error) {
        console.error('OTP Request Error:', error);
        res.status(500).json({ error: 'Failed to send OTP.' });
    }
};

const verifyOTP = async (req, res) => {
    try {
        const { token } = req.params;
        const { otp } = req.body;

        const query = `
            SELECT 
                ws.id AS step_id, ws.signer_name, ws.signer_email, ws.status AS step_status, ws.signature_ui_data, ws.step_order, ws.document_id, ws.otp_code, ws.otp_expires_at,
                d.file_name, d.original_file_path, d.signed_file_path, d.status AS doc_status
            FROM workflow_steps ws
            JOIN documents d ON ws.document_id = d.id
            WHERE ws.access_token = $1
        `;
        
        const { rows } = await db.query(query, [token]);
        if (rows.length === 0) return res.status(404).json({ error: 'Invalid link.' });
        
        const stepData = rows[0];
        if (stepData.step_status !== 'pending') return res.status(400).json({ error: 'Document already signed.' });
        
        if (!stepData.otp_code || stepData.otp_code !== otp || new Date(stepData.otp_expires_at) < new Date()) {
            return res.status(400).json({ error: 'Invalid or expired OTP.' });
        }

        // Clear OTP upon success
        await db.query('UPDATE workflow_steps SET otp_code = NULL, otp_expires_at = NULL WHERE id = $1', [stepData.step_id]);

        // Release document
        const releaseData = await releaseDocumentForSigning(stepData);
        return res.status(200).json(releaseData);

    } catch (error) {
        if (error.message.includes('Document Integrity Compromised')) {
            return res.status(400).json({ error: error.message });
        }
        console.error('OTP Verify Error:', error);
        res.status(500).json({ error: 'Server error during verification.' });
    }
};


const completeSigning = async (req, res) => {
    try {
        const { token } = req.params;
        const { completedFields, updatedFields } = req.body;

        await db.query('BEGIN');

        // 1. Validate Token & Get Data 
        // -> [UPDATED] Added ws.step_order to the SELECT statement
        const stepRes = await db.query(`
            SELECT ws.id, ws.document_id, ws.signer_email, ws.signature_ui_data, ws.status, ws.step_order,
                   d.file_name, d.original_file_path, d.signed_file_path
            FROM workflow_steps ws
            JOIN documents d ON ws.document_id = d.id
            WHERE ws.access_token = $1
        `, [token]);

        if (stepRes.rows.length === 0) throw new Error('Invalid token');
        const stepData = stepRes.rows[0];

        if (stepData.status !== 'pending') {
            await db.query('ROLLBACK');
            return res.status(400).json({ error: 'Document already signed.' });
        }

        // 2. Fetch the current PDF from Cloudflare R2
        const targetFileKey = stepData.signed_file_path || stepData.original_file_path;
        const originalBuffer = await getFileBufferFromR2(targetFileKey);

        // 3. Parse Fields & Stamp the PDF
        const dbFields = typeof stepData.signature_ui_data === 'string' 
            ? JSON.parse(stepData.signature_ui_data) 
            : stepData.signature_ui_data;
            
        // Use updatedFields (from frontend) if available, as they contain resized widths and heights
        const fieldsToStamp = updatedFields && updatedFields.length > 0 ? updatedFields : dbFields;

        const stampedBuffer = await stampDocument(originalBuffer, fieldsToStamp, completedFields);

        // 4. Generate the Cryptographic Hash (SHA-256)
        const stepHash = crypto.createHash('sha256').update(stampedBuffer).digest('hex');

        // 5. Upload the new stamped PDF back to R2
        const newFileKey = await uploadBufferToR2(stampedBuffer, stepData.file_name);

        // 6. Update PostgreSQL State
        await db.query(`
            UPDATE workflow_steps 
            SET status = 'completed', signed_at = CURRENT_TIMESTAMP, step_hash = $1 
            WHERE access_token = $2
        `, [stepHash, token]);

        await db.query(`
            UPDATE documents 
            SET signed_file_path = $1, current_hash = $2, updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
        `, [newFileKey, stepHash, stepData.document_id]);

        // 7. Write the Audit Log
        await db.query(`
            INSERT INTO audit_logs (document_id, action, actor_email, ip_address, resulting_hash)
            VALUES ($1, 'SIGNED_DOCUMENT', $2, $3, $4)
        `, [stepData.document_id, stepData.signer_email, req.ip || req.connection.remoteAddress, stepHash]);

        await db.query('COMMIT');


        // =========================================================
        // --- PHASE 5: THE ROUTING ENGINE (THE HANDOFF) ---
        // =========================================================
        
        const nextStepOrder = stepData.step_order + 1;
        
        // Ask PostgreSQL if there is a next person in line
        const nextStepRes = await db.query(`
            SELECT access_token, signer_email, signer_name 
            FROM workflow_steps 
            WHERE document_id = $1 AND step_order = $2
        `, [stepData.document_id, nextStepOrder]);

        if (nextStepRes.rows.length > 0) {
            // Path A: There is a next signer (Bob). Hand the document off!
            const nextSigner = nextStepRes.rows[0];
            
            await sendSignatureEmail(
                nextSigner.signer_email, 
                nextSigner.signer_name, 
                nextSigner.access_token, 
                stepData.file_name
            );
            
            console.log(`[Workflow] Document handed off to Level ${nextStepOrder}: ${nextSigner.signer_email}`);
        } else {
            // Path B: The queue is empty. Everyone has signed!
            console.log(`[Workflow] All signatures collected for document ${stepData.document_id}. Triggering Finalization.`);
            
            // --- CHANGE IS HERE: UNCOMMENT THIS LINE ---
            await finalizeDocument(stepData.document_id); 
        }

        // Respond to the React Frontend
        res.status(200).json({ message: 'Document securely signed and sealed.' });

    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Signing Completion Error:', error);
        res.status(500).json({ error: 'Failed to process signature.' });
    }
};


const finalizeDocument = async (documentId) => {
    try {
        console.log(`[Workflow] Finalizing Document ${documentId}...`);
        
        // 1. Fetch Document Details
        const docRes = await db.query('SELECT * FROM documents WHERE id = $1', [documentId]);
        if (docRes.rows.length === 0) throw new Error('Document not found');
        const document = docRes.rows[0];

        // 2. Fetch the entire Audit History, ordered chronologically
        const auditRes = await db.query('SELECT * FROM audit_logs WHERE document_id = $1 ORDER BY created_at ASC', [documentId]);
        const auditLogs = auditRes.rows;

        // 3. Download the most recent (fully signed) PDF from R2
        const targetFileKey = document.signed_file_path || document.original_file_path;
        const signedBuffer = await getFileBufferFromR2(targetFileKey);

        // 4. Generate and attach the Certificate of Completion page
        const finalBuffer = await appendAuditTrail(signedBuffer, auditLogs, document.file_name);

        // 5. Generate the ultimate Master Hash
        const masterHash = crypto.createHash('sha256').update(finalBuffer).digest('hex');

        // 6. Upload the Final, Sealed PDF to Cloudflare R2
        const finalFileKey = await uploadBufferToR2(finalBuffer, `FINAL-${document.file_name}`);

        // 7. Update the Database Status to 'completed'
        await db.query(`
            UPDATE documents 
            SET status = 'completed', signed_file_path = $1, current_hash = $2, updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
        `, [finalFileKey, masterHash, documentId]);

        // 8. Log the final seal
        await db.query(`
            INSERT INTO audit_logs (document_id, action, actor_email, resulting_hash)
            VALUES ($1, 'DOCUMENT_COMPLETED_AND_SEALED', 'system@dsign.local', $2)
        `, [documentId, masterHash]);

        // 9. Fetch all unique emails involved (Initiator + All Signers) to distribute the final copy
        const emailsRes = await db.query(`
            SELECT DISTINCT signer_email FROM workflow_steps WHERE document_id = $1
            UNION
            SELECT email FROM users WHERE id = $2
        `, [documentId, document.initiator_id]);
        
        const participantEmails = emailsRes.rows.map(row => row.signer_email || row.email);

        // 10. Fire the final email
        const finalSecureLink = await getPresignedPdfUrl(finalFileKey);
        for (const email of participantEmails) {
            await sendCompletionEmail(email, document.file_name, finalSecureLink);
            console.log(`[Workflow] Final document emailed to: ${email}`);
        }

        console.log(`[Workflow] Document ${documentId} successfully sealed.`);

    } catch (error) {
        console.error('[Workflow] Finalization Error:', error);
        // We don't throw to an HTTP response here because this runs asynchronously after the final signer clicks "Finish"
    }
};


module.exports = {
    uploadDocument,
    dispatchDocument,
    getSigningView,
    requestOTP,
    verifyOTP,
    completeSigning,
    finalizeDocument
};