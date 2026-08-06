const db = require('../config/db');
const { sendSignatureEmail } = require('../utils/emailManager');

const createWorkflow = async (req, res) => {
    try {
        const { documentId, signers, initiatorIsFirstSigner } = req.body;
        const initiatorId = req.user.userId;

        // Basic Validation
        if (!documentId || !signers || signers.length === 0) {
            return res.status(400).json({ error: 'Missing document ID or signers array.' });
        }

        // Verify the document belongs to the user and is still a draft
        const docCheck = await db.query(
            'SELECT * FROM documents WHERE id = $1 AND initiator_id = $2 AND status = $3',
            [documentId, initiatorId, 'draft']
        );

        if (docCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Draft document not found or unauthorized.' });
        }

        // START SQL TRANSACTION
        await db.query('BEGIN');

        // Document always starts as pending until the first signature is physically applied
        const documentNewStatus = 'pending'; 

        // Loop through the array and insert each signer
        for (let i = 0; i < signers.length; i++) {
            const signer = signers[i];
            const stepOrder = i + 1; 
            
            // BUG FIX: Everyone starts as 'pending'. No more auto-completing steps!
            const stepStatus = 'pending';

            const insertStepQuery = `
                INSERT INTO workflow_steps (document_id, signer_email, signer_name, step_order, status)
                VALUES ($1, $2, $3, $4, $5)
            `;
            await db.query(insertStepQuery, [
                documentId,
                signer.email,
                signer.name,
                stepOrder,
                stepStatus
            ]);
        }

        // Update the main document status
        await db.query(
            'UPDATE documents SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [documentNewStatus, documentId]
        );

        // 6. COMMIT TRANSACTION
        await db.query('COMMIT');

        // Fetch the generated steps (with their secure access tokens)
        const finalSteps = await db.query(
            'SELECT id, signer_name, signer_email, step_order, status, access_token FROM workflow_steps WHERE document_id = $1 ORDER BY step_order ASC',
            [documentId]
        );

        // EMAIL LOGIC
        // If the initiator is NOT first, we need to email the actual first signer
        if (!initiatorIsFirstSigner) {
            const firstSigner = finalSteps.rows.find(step => step.step_order === 1);
            if (firstSigner) {
                // Get the document name for the email subject
                const docQuery = await db.query('SELECT file_name FROM documents WHERE id = $1', [documentId]);
                const docName = docQuery.rows[0].file_name;
                
                // Fire the email asynchronously (don't await it, so the API responds faster)
                sendSignatureEmail(firstSigner.signer_email, firstSigner.signer_name, firstSigner.access_token, docName);
            }
        }

        // THE REDIRECT LOGIC: Isolate the token if the Initiator is signing first
        let redirectToken = null;
        if (initiatorIsFirstSigner) {
            // Grab the token from Level 1 so the frontend can route immediately
            redirectToken = finalSteps.rows[0].access_token; 
        }

        res.status(201).json({
            message: 'Workflow successfully created',
            documentStatus: documentNewStatus,
            redirectToken: redirectToken, // If present, the UI bypasses the dashboard
            steps: finalSteps.rows
        });

    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Workflow Creation Error:', error);
        res.status(500).json({ error: 'Failed to create workflow' });
    }
};

module.exports = {
    createWorkflow
};