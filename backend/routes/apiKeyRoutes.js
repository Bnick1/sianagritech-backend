import express from 'express';
import crypto from 'crypto';
import { keyStore, generateApiKey } from '../middleware/apiKeyAuth.js';

const router = express.Router();

// Generate a new API key
router.post('/generate', async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Key name is required'
      });
    }
    
    const key = generateApiKey();
    
    const keyData = {
      key,
      name,
      createdAt: new Date().toISOString(),
      lastUsed: null,
      active: true,
      permissions: ['read', 'write']
    };
    
    keyStore.set(key, keyData);
    
    res.json({
      success: true,
      message: 'API key generated successfully',
      key,
      name,
      createdAt: keyData.createdAt
    });
    
  } catch (error) {
    console.error('Failed to generate API key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate API key'
    });
  }
});

// List all API keys
router.get('/', async (req, res) => {
  try {
    const keys = Array.from(keyStore.values()).map(({ key, name, createdAt, lastUsed, active }) => ({
      key: key.substring(0, 16) + '...',
      name,
      createdAt,
      lastUsed,
      active
    }));
    
    res.json({
      success: true,
      keys
    });
    
  } catch (error) {
    console.error('Failed to list API keys:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list API keys'
    });
  }
});

// Revoke an API key
router.delete('/:keyId', async (req, res) => {
  try {
    const { keyId } = req.params;
    
    let foundKey = null;
    for (const [fullKey, data] of keyStore.entries()) {
      if (fullKey.includes(keyId) || data.name === keyId) {
        foundKey = fullKey;
        break;
      }
    }
    
    if (foundKey) {
      keyStore.delete(foundKey);
    }
    
    res.json({
      success: true,
      message: 'API key revoked successfully'
    });
    
  } catch (error) {
    console.error('Failed to revoke API key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to revoke API key'
    });
  }
});

// Validate an API key (internal use)
router.post('/validate', async (req, res) => {
  try {
    const { apiKey } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: 'API key is required'
      });
    }
    
    const keyData = keyStore.get(apiKey);
    
    if (keyData && keyData.active) {
      keyData.lastUsed = new Date().toISOString();
      keyStore.set(apiKey, keyData);
      
      res.json({
        success: true,
        valid: true,
        name: keyData.name,
        permissions: keyData.permissions
      });
    } else {
      res.json({
        success: true,
        valid: false,
        message: 'Invalid or inactive API key'
      });
    }
    
  } catch (error) {
    console.error('Failed to validate API key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate API key'
    });
  }
});

export default router;