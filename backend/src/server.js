const express = require('express');
const cors = require('cors');
require('dotenv').config();

const documentRoutes = require('./routes/documentRoutes');
const authRoutes = require('./routes/authRoutes');
const workflowRoutes = require('./routes/workflowRoutes');
const signatureRoutes = require('./routes/signatureRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/signatures', signatureRoutes);

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Digital Signature API running on port ${PORT}`);
});