const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadDocument } = require('../controllers/documentController');
const authenticateToken = require('../middleware/authMiddleware');

// Use memory storage instead of saving to the local 'uploads' folder
const upload = multer({ storage: multer.memoryStorage() });

router.post('/upload', authenticateToken, upload.single('pdf_file'), uploadDocument);

module.exports = router;