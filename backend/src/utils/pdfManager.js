const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
require('dotenv').config();

// Initialize the S3 Client for Cloudflare R2
const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

const applySignatureToPDF = async (fileKey, signerName, uiData, stepHash) => {
    try {
        // Fetch the original PDF file from Cloudflare R2
        const getCommand = new GetObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: fileKey,
        });

        const r2Response = await s3.send(getCommand);
        
        // Convert the R2 response stream into a Buffer for pdf-lib
        const pdfBytesArray = await r2Response.Body.transformToByteArray();
        const existingPdfBytes = Buffer.from(pdfBytesArray);

        // Load the PDF bytes into pdf-lib
        const pdfDoc = await PDFDocument.load(existingPdfBytes);
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

        // Handle target page and placement coordinates
        const targetPageNumber = uiData?.page ? uiData.page - 1 : 0;
        const page = pdfDoc.getPages()[targetPageNumber];
        const { height } = page.getSize();

        const targetX = uiData?.x || 50;
        // Invert Y coordinate (Web top-left to PDF bottom-left origin)
        const targetY = uiData?.y ? height - uiData.y : 100;

        // Format signature text block
        const signatureText = [
            `Digitally Signed by: ${signerName}`,
            `Date: ${new Date().toLocaleString()}`,
            `Hash: ${stepHash.substring(0, 16)}...`
        ].join('\n');

        // Stamp signature on target page
        page.drawText(signatureText, {
            x: targetX,
            y: targetY,
            size: 10,
            font: font,
            color: rgb(0, 0.2, 0.6),
            lineHeight: 14,
        });

        // Save modified PDF bytes
        const modifiedPdfBytes = await pdfDoc.save();

        // Upload/Overwrite the updated PDF back onto Cloudflare R2
        const putCommand = new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: fileKey,
            Body: modifiedPdfBytes,
            ContentType: 'application/pdf',
        });

        await s3.send(putCommand);

        return true;
    } catch (error) {
        console.error('R2 PDF Stamping Error:', error);
        throw new Error('Failed to stamp PDF file on Cloudflare R2');
    }
};

module.exports = { applySignatureToPDF };