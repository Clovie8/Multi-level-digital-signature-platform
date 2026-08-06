const db = require('../config/db');
const crypto = require('crypto');
const { applySignatureToPDF } = require('../utils/pdfManager'); 
const { sendSignatureEmail } = require('../utils/emailManager');

const submitSignature = async (req, res) => {
    try {
        const { token } = req.body;
        const signerIp = req.ip || req.connection.remoteAddress;

        if (!token) return res.status(400).json({ error: 'Access token is required.' });

        // Find the pending step AND join the documents table to get the file path
        const stepCheck = await db.query(`
            SELECT ws.*, d.original_file_path 
            FROM workflow_steps ws
            JOIN documents d ON ws.document_id = d.id
            WHERE ws.access_token = $1 AND ws.status = $2
        `, [token, 'pending']);

        if (stepCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Invalid token, or document already signed.' });
        }

        const currentStep = stepCheck.rows[0];
        const documentId = currentStep.document_id;
        const filePath = currentStep.original_file_path; 

        await db.query('BEGIN');

        // Generate the Cryptographic Hash
        const rawData = `${documentId}-${currentStep.signer_email}-${Date.now()}`;
        const stepHash = crypto.createHash('sha256').update(rawData).digest('hex');

        // PHYSICALLY STAMP THE PDF 
        // (If this fails, the catch block will trigger the database ROLLBACK)
        await applySignatureToPDF(
            filePath, 
            currentStep.signer_name, 
            currentStep.signature_ui_data, 
            stepHash
        );

        // Update workflow_steps
        await db.query(`
            UPDATE workflow_steps 
            SET status = 'completed', signed_at = CURRENT_TIMESTAMP, signer_ip = $1, step_hash = $2
            WHERE id = $3
        `, [signerIp, stepHash, currentStep.id]);

        // Write to Audit Log
        const logAction = `Signed by Level ${currentStep.step_order} (${currentStep.signer_name})`;
        await db.query(`
            INSERT INTO audit_logs (document_id, action, actor_email, ip_address, resulting_hash)
            VALUES ($1, $2, $3, $4, $5)
        `, [documentId, logAction, currentStep.signer_email, signerIp, stepHash]);

        // Check for next signer
        const nextStepCheck = await db.query(
            'SELECT * FROM workflow_steps WHERE document_id = $1 AND step_order = $2',
            [documentId, currentStep.step_order + 1]
        );

        let finalDocumentStatus = 'in_progress';
        let message = 'Signature applied. PDF stamped. Notifying next signer.';

        if (nextStepCheck.rows.length === 0) {
            finalDocumentStatus = 'completed';
            message = 'Document fully executed, stamped, and completed.';
            
            await db.query(
                'UPDATE documents SET status = $1, current_hash = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
                [finalDocumentStatus, stepHash, documentId]
            );
        } else {
            await db.query('UPDATE documents SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [documentId]);

            const nextSigner = nextStepCheck.rows[0];
            const docQuery = await db.query('SELECT file_name FROM documents WHERE id = $1', [documentId]);
            const docName = docQuery.rows[0].file_name;

            // Fire the email to the next person in line
            sendSignatureEmail(nextSigner.signer_email, nextSigner.signer_name, nextSigner.access_token, docName);
            
        }

        await db.query('COMMIT');

        res.status(200).json({
            message,
            documentStatus: finalDocumentStatus,
            hashGenerated: stepHash
        });

    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Signature Error:', error);
        res.status(500).json({ error: 'Failed to process signature' });
    }
};

module.exports = { submitSignature };