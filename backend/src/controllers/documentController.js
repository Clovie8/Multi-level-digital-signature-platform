const db = require('../config/db');
const { uploadToR2 } = require('../utils/s3Manager');

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
            message: 'Document uploaded securely to Cloudflare R2',
            document: rows[0]
        });

    } catch (error) {
        console.error('Upload Error:', error);
        res.status(500).json({ error: 'Failed to process document upload' });
    }
};

module.exports = {
    uploadDocument
};