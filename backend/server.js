// server.js - CommonJS version for Vercel compatibility
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://nkiremire9_db_user:26xE6RnkKIomiap2@cluster0.ksslca9.mongodb.net/sian-fintech?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err.message));

// Health endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'SianAgriTech API',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Simple test endpoint
app.get('/test', (req, res) => {
  res.json({ message: 'API is working!' });
});

// USSD endpoint
app.post('/api/ussd/callback', async (req, res) => {
  try {
    const { sessionId, phoneNumber, text } = req.body;
    
    // Simple USSD menu
    if (!text || text === '') {
      const response = `CON Welcome to SianAgriTech!
1. Register
2. Check Credit Score
3. Help`;
      res.set('Content-Type', 'text/plain');
      return res.send(response);
    }
    
    if (text === '1') {
      res.set('Content-Type', 'text/plain');
      return res.send(`CON Enter your name:`);
    }
    
    if (text.startsWith('1*')) {
      const parts = text.split('*');
      if (parts.length === 2) {
        res.set('Content-Type', 'text/plain');
        return res.send(`CON Enter your district:`);
      }
      if (parts.length === 3) {
        res.set('Content-Type', 'text/plain');
        return res.send(`CON Enter your village:`);
      }
      if (parts.length === 4) {
        res.set('Content-Type', 'text/plain');
        return res.send(`END Registration successful! Your credit score is 50/100`);
      }
    }
    
    if (text === '2') {
      res.set('Content-Type', 'text/plain');
      return res.send(`END Your credit score: 50/100`);
    }
    
    if (text === '3') {
      res.set('Content-Type', 'text/plain');
      return res.send(`END Help: Dial *384# for main menu`);
    }
    
    res.set('Content-Type', 'text/plain');
    res.send(`END Invalid option. Dial *384# to start over.`);
  } catch (error) {
    console.error('USSD error:', error);
    res.set('Content-Type', 'text/plain');
    res.send('END Service unavailable');
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Export for Vercel (no app.listen)
module.exports = app;
