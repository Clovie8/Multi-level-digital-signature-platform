const db = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendPasswordResetEmail, sendVerificationEmail } = require('../utils/emailManager');
require('dotenv').config();


// Register a new user
const registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Check if user already exists
        const userExists = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userExists.rows.length > 0) {
            return res.status(400).json({ error: 'User already exists' });
        }

        // Hash the password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Generate a 6-digit secure OTP
        const otpToken = crypto.randomInt(100000, 999999).toString();

        // Insert into database with the token
        const insertQuery = `
            INSERT INTO users (name, email, password_hash, verification_token)
            VALUES ($1, $2, $3, $4)
            RETURNING id, name, email;
        `;
        const newUser = await db.query(insertQuery, [name, email, passwordHash, otpToken]);

        // Fire the email
        await sendVerificationEmail(email, otpToken);

        res.status(201).json({
            message: 'User registered successfully',
            user: newUser.rows[0]
        });

    } catch (error) {
        console.error('Registration Error:', error);
        res.status(500).json({ error: 'Server error during registration' });
    }
};

// Login user and generate JWT
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find the user
        const userResult = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const user = userResult.rows[0];

        // Check password
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        if (!user.is_verified) {
            return res.status(403).json({ 
                error: 'Account not verified. Please check your email.',
                requiresVerification: true // Flag for the frontend
            });
        }

        // Generate JWT Token
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });

        res.status(200).json({
            message: 'Login successful',
            user: { id: user.id, name: user.name, email: user.email }
        });

    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ error: 'Server error during login' });
    }
};

// Request a password reset email
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        const userResult = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userResult.rows.length === 0) {
            return res.status(200).json({ message: 'If that email exists, a reset link was sent.' });
        }

        // Generate a secure 6-character code (user friendly) and set expiration to 1 hour
        const resetToken = crypto.randomBytes(3).toString('hex').toUpperCase();
        const expireTime = new Date(Date.now() + 3600000); 

        // UPDATED: Using your exact column names and updating the timestamp
        await db.query(
            `UPDATE users 
             SET reset_password_token = $1, 
                 reset_password_expires_at = $2, 
                 updated_at = CURRENT_TIMESTAMP 
             WHERE email = $3`,
            [resetToken, expireTime, email]
        );

        // Dispatch actual email
        await sendPasswordResetEmail(email, resetToken);
        console.log(`Email Sent to ${email} with token: ${resetToken}`);

        res.status(200).json({ message: 'Reset code sent to your email.' });

    } catch (error) {
        console.error('Forgot Password Error:', error);
        res.status(500).json({ error: 'Server error processing request' });
    }
};

// Reset the password using the token
const resetPassword = async (req, res) => {
    try {
        const { email, resetToken, newPassword } = req.body;

        // UPDATED: Matching your column names for validation
        const query = `
            SELECT * FROM users 
            WHERE email = $1 
            AND reset_password_token = $2 
            AND reset_password_expires_at > NOW()
        `;
        const userResult = await db.query(query, [email, resetToken]);

        if (userResult.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(newPassword, salt);

        // UPDATED: Clearing your specific token columns and updating the timestamp
        const updateQuery = `
            UPDATE users 
            SET password_hash = $1, 
                reset_password_token = NULL, 
                reset_password_expires_at = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE email = $2
        `;
        await db.query(updateQuery, [passwordHash, email]);

        res.status(200).json({ message: 'Password updated successfully' });

    } catch (error) {
        console.error('Reset Password Error:', error);
        res.status(500).json({ error: 'Server error resetting password' });
    }
};



// Verify the 6-digit code
const verifyEmail = async (req, res) => {
    try {
        const { email, otp } = req.body;

        // Check if the user exists and the code matches
        const query = 'SELECT * FROM users WHERE email = $1 AND verification_token = $2';
        const userResult = await db.query(query, [email, otp]);

        if (userResult.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid verification code' });
        }

        // Code matched! Update database
        await db.query(
            'UPDATE users SET is_verified = TRUE, verification_token = NULL WHERE email = $1',
            [email]
        );

        res.status(200).json({ message: 'Account verified successfully' });
    } catch (error) {
        console.error('Verification Error:', error);
        res.status(500).json({ error: 'Server error during verification' });
    }
};

// Resend the 6-digit code
const resendVerification = async (req, res) => {
    try {
        const { email } = req.body;

        // Make sure user exists and isn't already verified
        const userResult = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userResult.rows.length === 0 || userResult.rows[0].is_verified) {
            return res.status(400).json({ error: 'Account already verified or does not exist' });
        }

        // Generate new secure code and update DB
        const newOtp = crypto.randomInt(100000, 999999).toString();
        await db.query('UPDATE users SET verification_token = $1 WHERE email = $2', [newOtp, email]);

        // Resend email
        await sendVerificationEmail(email, newOtp);

        res.status(200).json({ message: 'New code sent' });
    } catch (error) {
        console.error('Resend Error:', error);
        res.status(500).json({ error: 'Server error resending code' });
    }
};

// Securely kill the session
const logoutUser = (req, res) => {
    // Clear the HttpOnly cookie
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
    });
    res.status(200).json({ message: 'Logged out successfully' });
};

// Get current logged in user's profile
const getUserProfile = async (req, res) => {
    try {
        const query = 'SELECT id, name, email, is_verified FROM users WHERE id = $1';
        const userResult = await db.query(query, [req.user.userId]);

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.status(200).json(userResult.rows[0]);
    } catch (error) {
        console.error('Fetch Profile Error:', error);
        res.status(500).json({ error: 'Server error fetching profile' });
    }
};

module.exports = { registerUser, loginUser, forgotPassword, resetPassword, verifyEmail, resendVerification, logoutUser, getUserProfile };