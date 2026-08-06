const nodemailer = require('nodemailer');
require('dotenv').config();

// Create the transporter using environment variables
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false, // true for 465, false for other ports like 587
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

const sendSignatureEmail = async (signerEmail, signerName, token, documentName) => {
    try {
        // Construct the secure link pointing to your future React frontend
        const secureLink = `${process.env.FRONTEND_URL}/sign?token=${token}`;

        const mailOptions = {
            from: `"Digital Signature Platform" <${process.env.SMTP_USER}>`,
            to: signerEmail,
            subject: `Action Required: Please sign ${documentName}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
                    <h2 style="color: #333;">Hello ${signerName},</h2>
                    <p style="color: #555; font-size: 16px;">
                        You have been requested to review and digitally sign <strong>${documentName}</strong>.
                    </p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${secureLink}" style="background-color: #0056b3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 16px;">
                            Review and Sign Document
                        </a>
                    </div>
                    <p style="color: #777; font-size: 14px;">
                        This is a secure, one-time link. Please do not forward this email.
                    </p>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`Email sent to ${signerEmail}: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error('Email Dispatch Error:', error);
        // We log the error but don't throw it, so a failed email doesn't crash the database transaction
        return false; 
    }
};

module.exports = { sendSignatureEmail };