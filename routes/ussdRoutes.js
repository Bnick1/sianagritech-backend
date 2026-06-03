import express from 'express';
import USSDService from '../services/ussdService.js';

const router = express.Router();

// USSD callback endpoint (Africa's Talking format)
router.post('/callback', async (req, res) => {
  try {
    const { sessionId, phoneNumber, text } = req.body;
    
    // Process USSD request
    const response = await USSDService.handleRequest(sessionId, phoneNumber, null, text || '');
    
    // Parse response format (CON or END)
    const isComplete = response.startsWith('END');
    const message = response.substring(4); // Remove 'CON ' or 'END '
    
    res.set('Content-Type', 'text/plain');
    res.send(`${isComplete ? 'END' : 'CON'} ${message}`);
    
  } catch (error) {
    console.error('USSD error:', error);
    res.send('END Service temporarily unavailable. Please try again later.');
  }
});

// Alternative format for testing
router.post('/ussd', async (req, res) => {
  try {
    const { sessionId, phoneNumber, text } = req.body;
    const response = await USSDService.handleRequest(sessionId, phoneNumber, null, text || '');
    res.json({ response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
