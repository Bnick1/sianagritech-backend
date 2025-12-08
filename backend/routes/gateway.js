import express from 'express';
const router = express.Router();
import USSDService from '../services/ussdService.js';
import SMSService from '../services/smsService.js';

// USSD Endpoint
router.post('/ussd', async (req, res) => {
  try {
    const { sessionId, serviceCode, phoneNumber, text } = req.body;
    
    const response = await USSDService.handleRequest(
      sessionId,
      phoneNumber,
      serviceCode,
      text
    );
    
    res.set('Content-Type', 'text/plain');
    res.send(response);
  } catch (error) {
    console.error('USSD Error:', error);
    res.status(500).send('END System error. Please try again later.');
  }
});

// SMS Incoming Endpoint
router.post('/sms/incoming', async (req, res) => {
  try {
    const { from, to, text, date, id } = req.body;
    
    // Process SMS based on keyword
    const keyword = text.split(' ')[0].toUpperCase();
    
    switch(keyword) {
      case 'WEATHER':
        const location = text.substring(8) || 'Nairobi';
        const forecast = `Weather for ${location}: Sunny, 25°C, 10% rain. Good for farming.`;
        await SMSService.sendSMS(from, forecast);
        break;
        
      case 'PRICE':
        const commodity = text.substring(6) || 'maize';
        const price = `Price for ${commodity}: UGX 2,800/kg (Kampala), UGX 3,200/kg (Jinja)`;
        await SMSService.sendSMS(from, price);
        break;
        
      case 'INSURANCE':
        await SMSService.sendSMS(from, 'Insurance: Your policy is active. Premium due in 15 days.');
        break;
        
      case 'LOAN':
        await SMSService.sendSMS(from, 'Loan: Application received. We\'ll SMS decision in 24h.');
        break;
        
      case 'EXPERT':
        const problem = text.substring(7) || 'general';
        await SMSService.sendSMS(from, `Expert: For ${problem}, consult extension officer or visit clinic.`);
        break;
        
      case 'SUBSIDY':
        await SMSService.sendSMS(from, 'Subsidy: You qualify for 50% fertilizer discount. Visit NAADS.');
        break;
        
      default:
        await SMSService.sendSMS(from, 'SianAgri: Invalid keyword. Try: WEATHER, PRICE, INSURANCE, LOAN, EXPERT, SUBSIDY');
    }
    
    res.status(200).json({ status: 'success' });
  } catch (error) {
    console.error('SMS Processing Error:', error);
    res.status(500).json({ status: 'error', error: error.message });
  }
});

// Send SMS endpoint
router.post('/sms/send', async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;
    
    const result = await SMSService.sendSMS(phoneNumber, message);
    
    res.json({
      success: result.success,
      provider: result.provider,
      data: result.data,
      error: result.error
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Check API status
router.get('/status', async (req, res) => {
  try {
    const atStatus = await SMSService.getATBalance();
    const mtnStatus = await SMSService.getMTNBalance();
    
    res.json({
      africasTalking: atStatus,
      mtnUganda: mtnStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

export default router;