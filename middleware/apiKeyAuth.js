import crypto from 'crypto';

// In-memory store for API keys
const validApiKeys = new Map();

export const keyStore = validApiKeys;

export const generateApiKey = () => {
  return `ag_${crypto.randomBytes(32).toString('hex')}`;
};

export const apiKeyAuth = (req, res, next) => {
  const apiKey = req.header('X-API-Key');
  
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'API key is required',
      message: 'Please provide an X-API-Key header'
    });
  }
  
  if (!apiKey.startsWith('ag_')) {
    return res.status(403).json({
      success: false,
      error: 'Invalid API key format',
      message: 'API key must start with "ag_"'
    });
  }
  
  const keyData = validApiKeys.get(apiKey);
  
  if (!keyData || !keyData.active) {
    return res.status(403).json({
      success: false,
      error: 'Invalid API key',
      message: 'The provided API key is not authorized'
    });
  }
  
  keyData.lastUsed = new Date().toISOString();
  validApiKeys.set(apiKey, keyData);
  
  req.apiKey = {
    key: apiKey,
    name: keyData.name,
    permissions: keyData.permissions
  };
  
  console.log(`🔑 API access from ${req.ip} using key: ${keyData.name} at ${new Date().toISOString()}`);
  
  next();
};

export default {
  keyStore,
  generateApiKey,
  apiKeyAuth
};