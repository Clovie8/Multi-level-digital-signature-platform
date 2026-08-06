const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const crypto = require('crypto');
require('dotenv').config();

// Initialize the S3 Client pointed at Cloudflare R2
const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

const uploadToR2 = async (fileBuffer, originalName) => {
    try {
        // Generate a unique filename to prevent overwriting
        const fileKey = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${originalName.replace(/\s+/g, '_')}`;
        
        const command = new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: fileKey,
            Body: fileBuffer,
            ContentType: 'application/pdf',
        });

        await s3.send(command);
        
        // Return the exact key (filename) stored in the bucket
        return fileKey; 
    } catch (error) {
        console.error('R2 Upload Error:', error);
        throw new Error('Failed to upload file to Cloudflare R2');
    }
};

module.exports = { uploadToR2 };