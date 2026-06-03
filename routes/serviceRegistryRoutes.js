// backend/routes/serviceRegistryRoutes.js
import express from 'express';
import serviceRegistry from '../services/serviceRegistry.js';

const router = express.Router();

// Get registry status
router.get('/status', (req, res) => {
  try {
    const status = serviceRegistry.getRegistryStatus();
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get service metrics
router.get('/metrics', (req, res) => {
  try {
    const metrics = serviceRegistry.getServiceMetrics();
    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get specific service info
router.get('/services/:serviceName', (req, res) => {
  try {
    const { serviceName } = req.params;
    const service = serviceRegistry.services.get(serviceName);
    
    if (!service) {
      return res.status(404).json({
        success: false,
        error: `Service ${serviceName} not found`,
        timestamp: new Date().toISOString()
      });
    }
    
    const dependencies = serviceRegistry.checkDependencies(serviceName);
    const health = serviceRegistry.healthStatus.get(serviceName);
    
    res.json({
      success: true,
      data: {
        config: service.config,
        status: service.status,
        dependencies,
        health,
        uptime: service.uptime ? Date.now() - service.uptime : 0,
        lastHealthCheck: service.lastHealthCheck
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Execute a workflow
router.post('/workflows/:workflowName/execute', async (req, res) => {
  try {
    const { workflowName } = req.params;
    const { data } = req.body;
    
    const result = await serviceRegistry.executeWorkflow(workflowName, data);
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get available workflows
router.get('/workflows', (req, res) => {
  const workflows = {
    farm_health_check: {
      description: 'Complete farm health analysis using IoT, weather, and AI',
      services: ['farmerService', 'iotDataService', 'weatherService', 'aiService'],
      inputs: ['farmId'],
      outputs: ['health_score', 'recommendations', 'alerts']
    },
    farmer_alert: {
      description: 'Send alert to farmer through available channels',
      services: ['farmerService', 'notificationService', 'smsService'],
      inputs: ['farmerId', 'message', 'priority'],
      outputs: ['delivery_status', 'channel_used']
    },
    data_sync: {
      description: 'Synchronize offline data with central server',
      services: ['offlineSyncService', 'farmerService', 'iotDataService'],
      inputs: ['farmId', 'sinceTimestamp'],
      outputs: ['synced_count', 'failed_count', 'conflicts']
    },
    crop_analysis: {
      description: 'Analyze crop health using AI and sensor data',
      services: ['aiService', 'iotDataService', 'farmerService'],
      inputs: ['farmId', 'cropId', 'images'],
      outputs: ['disease_detection', 'health_score', 'recommendations']
    }
  };
  
  res.json({
    success: true,
    data: workflows,
    timestamp: new Date().toISOString()
  });
});

// Service dependency graph
router.get('/dependencies', (req, res) => {
  try {
    const graph = {};
    
    for (const [serviceName, dependencies] of serviceRegistry.dependencies.entries()) {
      graph[serviceName] = {
        dependsOn: dependencies,
        dependents: []
      };
    }
    
    // Calculate dependents
    for (const [serviceName, dependencies] of serviceRegistry.dependencies.entries()) {
      for (const dep of dependencies) {
        if (graph[dep]) {
          graph[dep].dependents.push(serviceName);
        }
      }
    }
    
    res.json({
      success: true,
      data: graph,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Force health check
router.post('/health-check', async (req, res) => {
  try {
    await serviceRegistry.performHealthChecks();
    
    res.json({
      success: true,
      message: 'Health check completed',
      data: serviceRegistry.systemHealth,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Register new service (admin only)
router.post('/services', async (req, res) => {
  try {
    const { serviceKey, config } = req.body;
    
    // In real implementation, validate admin token
    
    const result = serviceRegistry.registerService(serviceKey, null, config);
    
    res.json({
      success: result,
      message: `Service ${serviceKey} registered`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// System overview
router.get('/overview', (req, res) => {
  try {
    const status = serviceRegistry.getRegistryStatus();
    const metrics = serviceRegistry.getServiceMetrics();
    
    const overview = {
      system: {
        name: 'SianAgriTech Platform',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        status: status.system.overall,
        uptime: process.uptime()
      },
      services: {
        total: status.totals.registered,
        healthy: status.totals.healthy,
        unhealthy: status.totals.unhealthy,
        critical: Object.values(status.services).filter(s => s.critical).length
      },
      metrics: {
        totalRequests: metrics.requests.total,
        failureRate: metrics.requests.total > 0 ? 
          (metrics.requests.failures / metrics.requests.total * 100).toFixed(2) + '%' : '0%',
        lastUpdated: metrics.lastUpdated
      },
      capabilities: [
        'Farmer Management',
        'IoT Sensor Integration',
        'Weather Data Aggregation',
        'AI Crop Analysis',
        'SMS/USSD Communication',
        'Offline-First Operation',
        'Multi-Source Data Fusion'
      ]
    };
    
    res.json({
      success: true,
      data: overview,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;