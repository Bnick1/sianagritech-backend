// backend/routes/healthRoutes.js
import express from 'express';
import HealthService from '../services/healthService.js';

const router = express.Router();

// Comprehensive health check
router.get('/', async (req, res) => {
  try {
    const health = await HealthService.comprehensiveHealthCheck();
    
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Health-Check-Timestamp': health.timestamp,
      'X-Health-Score': health.score
    });
    
    res.status(health.status === 'unhealthy' ? 503 : 200).json(health);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ 
      status: 'error', 
      message: error.message,
      timestamp: new Date().toISOString(),
      service: 'sianagritech-backend'
    });
  }
});

// Lightweight health check
router.get('/liveness', async (req, res) => {
  try {
    const mongodb = await HealthService.checkDatabaseConnection();
    const isAlive = mongodb.status === 'connected';
    
    res.status(isAlive ? 200 : 503).json({
      alive: isAlive,
      mongodb: mongodb.status,
      timestamp: new Date().toISOString(),
      service: 'sianagritech-backend'
    });
  } catch (error) {
    res.status(503).json({
      alive: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Readiness check
router.get('/readiness', async (req, res) => {
  try {
    const checks = await Promise.allSettled([
      HealthService.checkDatabaseConnection(),
      HealthService.checkRedisConnection()
    ]);
    
    const mongodbReady = checks[0].status === 'fulfilled' && checks[0].value.status === 'connected';
    const redisReady = checks[1].status === 'fulfilled' && 
                      (checks[1].value.status === 'connected' || checks[1].value.status === 'not_configured');
    
    const isReady = mongodbReady && redisReady;
    
    res.status(isReady ? 200 : 503).json({
      ready: isReady,
      checks: {
        mongodb: checks[0].status === 'fulfilled' ? checks[0].value : { error: checks[0].reason?.message },
        redis: checks[1].status === 'fulfilled' ? checks[1].value : { error: checks[1].reason?.message }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      ready: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// External API health
router.get('/apis', async (req, res) => {
  try {
    const apiHealth = await HealthService.checkAllExternalAPIs();
    
    res.json({
      status: 'success',
      data: apiHealth,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Specific API health
router.get('/apis/:apiKey', async (req, res) => {
  try {
    const { apiKey } = req.params;
    const config = HealthService.externalAPIs[apiKey];
    
    if (!config) {
      return res.status(404).json({ 
        status: 'error', 
        error: `API '${apiKey}' not found`,
        availableAPIs: Object.keys(HealthService.externalAPIs)
      });
    }
    
    const health = await HealthService.checkExternalAPI(apiKey, config);
    
    res.json({
      status: 'success',
      data: health,
      config: {
        name: config.name,
        category: config.category,
        required: config.required,
        fallback: config.fallback
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// System metrics
router.get('/system', async (req, res) => {
  try {
    const metrics = await HealthService.getSystemMetrics();
    
    res.json({
      status: 'success',
      data: metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Active connections
router.get('/connections', async (req, res) => {
  try {
    const connections = await HealthService.getActiveConnections();
    
    res.json({
      status: 'success',
      data: connections,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// API configuration
router.get('/config', (req, res) => {
  try {
    const configs = {};
    Object.entries(HealthService.externalAPIs).forEach(([key, config]) => {
      configs[key] = {
        name: config.name,
        category: config.category,
        required: config.required,
        fallback: config.fallback,
        checkInterval: config.checkInterval,
        timeout: config.timeout
      };
    });
    
    res.json({
      status: 'success',
      data: {
        apis: configs,
        total: Object.keys(configs).length,
        required: Object.values(configs).filter(c => c.required).length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// API status (cached)
router.get('/status', (req, res) => {
  try {
    const currentStatus = HealthService.getCurrentAPIStatus();
    
    res.json({
      status: 'success',
      data: {
        currentStatus,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;