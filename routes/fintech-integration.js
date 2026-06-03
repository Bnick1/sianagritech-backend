// fintech-integration.js - Connects SianAgriTech to SianFinTech
// ES Module version with environment variable API key support

import express from 'express';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const router = express.Router();

// Simple in-memory store for mock data (no database needed)
const mockFarmers = {
  'test-123': {
    farmSize: 3.2,
    crops: ['maize', 'beans'],
    irrigationScore: 0.7,
    marketplacePurchases: 12,
    totalSpend: 600000,
    yieldHistory: [
      { season: '2024A', value: 3.5 },
      { season: '2024B', value: 3.8 },
      { season: '2025A', value: 4.1 }
    ],
    averageYield: 3.8,
    diseaseCount: 0,
    yieldConsistency: 0.85,
    cropHealthScore: 78
  },
  'farmer-456': {
    farmSize: 1.8,
    crops: ['coffee', 'beans'],
    irrigationScore: 0.5,
    marketplacePurchases: 5,
    totalSpend: 250000,
    yieldHistory: [
      { season: '2024A', value: 2.2 },
      { season: '2024B', value: 2.5 },
      { season: '2025A', value: 2.8 }
    ],
    averageYield: 2.5,
    diseaseCount: 2,
    yieldConsistency: 0.6,
    cropHealthScore: 65
  },
  'nyaarushanje-001': {
    farmSize: 2.5,
    crops: ['maize', 'beans', 'coffee'],
    irrigationScore: 0.6,
    marketplacePurchases: 8,
    totalSpend: 400000,
    yieldHistory: [
      { season: '2024A', value: 3.2 },
      { season: '2024B', value: 3.5 },
      { season: '2025A', value: 3.8 }
    ],
    averageYield: 3.5,
    diseaseCount: 1,
    yieldConsistency: 0.75,
    cropHealthScore: 72
  }
};

// API key validation using environment variable
const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  // Use environment variable, fallback to shared_key_2026 for backward compatibility
  const validKey = process.env.SIANAGRITECH_API_KEY || 'shared_key_2026';
  
  if (!apiKey) {
    console.log('❌ No API key provided');
    return res.status(401).json({ error: 'API key required' });
  }
  
  if (apiKey !== validKey) {
    console.log(`❌ Invalid API key. Expected: ${validKey.substring(0, 8)}..., Got: ${apiKey.substring(0, 8)}...`);
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  console.log('✅ API key validated successfully');
  next();
};

// Apply to all routes
router.use(validateApiKey);

/**
 * GET /api/v1/farmer/:userId/farming-profile
 * Returns farming profile for credit scoring
 */
router.get('/farmer/:userId/farming-profile', (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log(`📡 SianAgriTech: Fetching farming profile for user ${userId}`);
    console.log(`   - API Key used: ${req.headers['x-api-key']?.substring(0, 8)}...`);
    
    // Check if we have mock data for this user
    const farmerData = mockFarmers[userId] || mockFarmers['nyaarushanje-001'];
    
    // Return the data
    res.json({
      farmSize: farmerData.farmSize,
      cropTypes: farmerData.crops.length,
      crops: farmerData.crops,
      irrigationScore: farmerData.irrigationScore,
      marketplacePurchases: farmerData.marketplacePurchases,
      totalSpend: farmerData.totalSpend,
      yieldHistory: farmerData.yieldHistory,
      averageYield: farmerData.averageYield,
      diseaseCount: farmerData.diseaseCount,
      yieldConsistency: farmerData.yieldConsistency,
      cropHealthScore: farmerData.cropHealthScore
    });
    
  } catch (error) {
    console.error('❌ Error in farming profile:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/health
 * Health check
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'sianagritech-fintech-integration',
    timestamp: new Date().toISOString(),
    apiKeyConfigured: !!process.env.SIANAGRITECH_API_KEY
  });
});

/**
 * GET /api/v1/test
 * Simple test endpoint without auth (for debugging)
 */
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'FinTech integration route is working',
    timestamp: new Date().toISOString()
  });
});

// Export as default for ES modules
export default router;