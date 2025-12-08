const express = require('express');
const router = express.Router();
const AfricasTalking = require('africastalking');

// Initialize Africa's Talking
const africastalking = AfricasTalking({
  apiKey: process.env.AT_API_KEY,
  username: process.env.AT_USERNAME
});

// USSD Endpoint
router.post('/ussd', async (req, res) => {
  const { sessionId, serviceCode, phoneNumber, text } = req.body;
  
  let response = '';
  
  if (text === '') {
    // First screen
    response = `CON Welcome to SianAgriTech\nSelect Service:\n1. Insurance\n2. Marketplace\n3. Weather\n4. Finance\n5. Expert\n6. Subsidy`;
  } else if (text === '1') {
    // Insurance menu
    response = `CON Insurance Services:\n1. Buy Insurance\n2. Submit Claim\n3. Check Policy\n4. Premium Payment\n0. Back`;
  } else if (text === '1*1') {
    // Buy insurance flow
    response = `CON Select Crop:\n1. Maize\n2. Beans\n3. Tomatoes\n4. Coffee`;
  } else if (text.startsWith('1*1*')) {
    // Process insurance purchase
    const crop = text.split('*')[2];
    // Call insurance API
    const premium = await calculatePremium(phoneNumber, crop);
    response = `END Insurance premium: ${premium} KES. Reply INSURANCE to confirm.`;
  }
  
  res.set('Content-Type', 'text/plain');
  res.send(response);
});

// SMS Endpoint
router.post('/sms', async (req, res) => {
  const { from, to, text } = req.body;
  
  const keyword = text.split(' ')[0].toUpperCase();
  
  switch(keyword) {
    case 'WEATHER':
      const location = text.substring(8) || 'Nairobi';
      const forecast = await getWeather(location);
      await sendSMS(from, forecast);
      break;
    case 'PRICE':
      const commodity = text.substring(6) || 'maize';
      const price = await getMarketPrice(commodity);
      await sendSMS(from, price);
      break;
    case 'INSURANCE':
      const policy = await getInsuranceStatus(from);
      await sendSMS(from, policy);
      break;
  }
  
  res.status(200).json({ status: 'success' });
});

async function sendSMS(to, message) {
  try {
    await africastalking.SMS.send({
      to: [to],
      message: message,
      from: 'SianAgri'
    });
  } catch (error) {
    console.error('SMS Error:', error);
  }
}

module.exports = router;