/**
 * TraffIQ Server - Main Application Entrypoint
 * AI-Powered Traffic Prediction and Smart Route Recommendation System
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const apiRouter = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend assets
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api', apiRouter);

// Fallback to index.html for client-side navigation
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start listening if run directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚦 TraffIQ Server is running!`);
    console.log(`📍 URL: http://localhost:${PORT}`);
    console.log(`🧠 AI/ML Engine: Random Forest Traffic Classifier`);
    console.log(`====================================================`);
  });
}

module.exports = app;
