// api/index.js
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Health endpoint
  if (req.method === 'GET' && req.url === '/health') {
    return res.status(200).json({
      status: 'ok',
      service: 'SianAgriTech USSD',
      timestamp: new Date().toISOString()
    });
  }
  
  // USSD endpoint
  if (req.method === 'POST' && req.url === '/api/ussd/callback') {
    const { text = '' } = req.body;
    
    if (!text || text === '') {
      return res.status(200).send('CON Welcome to SianAgriTech\n1. Register\n2. Credit Score\n3. Help');
    }
    
    if (text === '1') {
      return res.status(200).send('CON Enter your name:');
    }
    
    if (text === '2') {
      return res.status(200).send('END Credit Score: 68/100\nLoan Limit: UGX 1,700,000');
    }
    
    if (text === '3') {
      return res.status(200).send('END Dial *384# for main menu');
    }
    
    return res.status(200).send('END Invalid option');
  }
  
  // Root
  if (req.url === '/' || req.url === '') {
    return res.status(200).json({ message: 'API is running' });
  }
  
  return res.status(404).json({ error: 'Not found' });
}
