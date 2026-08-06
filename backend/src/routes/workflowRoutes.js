const express = require('express');
const router = express.Router();
const { createWorkflow } = require('../controllers/workflowController');
const authenticateToken = require('../middleware/authMiddleware');

// Protect the route with JWT middleware
router.post('/create', authenticateToken, createWorkflow);

module.exports = router;