const db = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
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

        // Insert into database
        const insertQuery = `
            INSERT INTO users (name, email, password_hash)
            VALUES ($1, $2, $3)
            RETURNING id, name, email;
        `;
        const newUser = await db.query(insertQuery, [name, email, passwordHash]);

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

        // Generate JWT Token
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(200).json({
            message: 'Login successful',
            token,
            user: { id: user.id, name: user.name, email: user.email }
        });

    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ error: 'Server error during login' });
    }
};

module.exports = { registerUser, loginUser };