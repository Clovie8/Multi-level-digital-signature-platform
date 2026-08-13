const jwt = require('jsonwebtoken');
require('dotenv').config();

const authenticateToken = (req, res, next) => {
    // Check for token in secure HttpOnly cookie OR Authorization header (for fallback/Postman)
    const token = req.cookies?.token || (req.headers.authorization && req.headers.authorization.split(' ')[1]); 

    // If there is no token, reject the request
    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    // Verify the token is valid and hasn't been tampered with
    jwt.verify(token, process.env.JWT_SECRET, (err, decodedUser) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token.' });
        }

        req.user = decodedUser; 
        next(); 
    });
};

module.exports = authenticateToken;