const express = require('express');
const router = express.Router();
const multer = require('multer');

// requestOTP and verifyOTP to the imports
const { 
    uploadDocument, 
    dispatchDocument, 
    getSigningView, 
    completeSigning,
    requestOTP,
    verifyOTP
} = require('../controllers/documentController');

const authenticateToken = require('../middleware/authMiddleware');

// Use memory storage instead of saving to the local 'uploads' folder
const upload = multer({ storage: multer.memoryStorage() });

router.post('/upload', authenticateToken, upload.single('pdf_file'), uploadDocument);
router.post('/:id/dispatch', authenticateToken, dispatchDocument);

// Public route for the signing canvas (Auth is handled via the URL token)
router.get('/sign/:token', getSigningView);
router.post('/sign/:token/complete', completeSigning);

// OTP Gateway Routes
router.post('/sign/:token/request-otp', requestOTP);
router.post('/sign/:token/verify-otp', verifyOTP);

module.exports = router;