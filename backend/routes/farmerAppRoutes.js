// backend/routes/farmerAppRoutes.js
import express from 'express';
import mongoose from 'mongoose';
import serviceRegistry from '../services/serviceRegistry.js';
import offlineSyncService from '../services/offlineSyncService.js';

const router = express.Router();

// ==================== AUTHENTICATION ====================
router.post('/auth/login', async (req, res) => {
  try {
    const { phone, pin } = req.body;
    
    if (!phone || !pin) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and PIN are required'
      });
    }

    // Format phone number
    const formattedPhone = formatPhoneNumber(phone);
    
    // Find farmer
    const Farmer = mongoose.models.Farmer;
    const farmer = await Farmer.findOne({ 
      phone: formattedPhone,
      status: 'active'
    }).select('+pinHash').lean();

    if (!farmer) {
      return res.status(401).json({
        success: false,
        message: 'Farmer not found or inactive'
      });
    }

    // Verify PIN (in production, use bcrypt)
    // For now, simple comparison
    if (farmer.pinHash !== pin) { // In reality, hash and compare
      return res.status(401).json({
        success: false,
        message: 'Invalid PIN'
      });
    }

    // Generate session token
    const sessionToken = generateSessionToken(farmer._id);
    
    // Get farmer data (excluding sensitive info)
    const farmerData = await Farmer.findById(farmer._id)
      .select('-pinHash -__v')
      .populate('farms', 'name location size cropType status')
      .lean();

    // Store session
    await storeSession(farmer._id, sessionToken);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        farmer: farmerData,
        token: sessionToken,
        session: {
          expiresIn: '7d',
          offlineCapable: true
        }
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
});

// ==================== OFFLINE-FIRST SYNC ====================
router.post('/sync/check', async (req, res) => {
  try {
    const { farmerId, lastSync, offlineOperations } = req.body;
    
    if (!farmerId) {
      return res.status(400).json({
        success: false,
        message: 'Farmer ID required'
      });
    }

    // Get sync status
    const syncStatus = offlineSyncService.getSyncStatus();
    
    // Get changes since last sync
    const changes = await getChangesSince(farmerId, lastSync);
    
    // Process offline operations if provided
    let operationResults = [];
    if (offlineOperations && offlineOperations.length > 0) {
      operationResults = await processOfflineOperations(offlineOperations);
    }

    res.json({
      success: true,
      data: {
        syncStatus,
        changes,
        operationResults,
        serverTime: new Date().toISOString(),
        nextSyncRecommendation: getNextSyncTime()
      }
    });

  } catch (error) {
    console.error('Sync check error:', error);
    res.status(500).json({
      success: false,
      message: 'Sync failed',
      error: error.message
    });
  }
});

router.post('/sync/upload', async (req, res) => {
  try {
    const { farmerId, operations } = req.body;
    
    if (!farmerId || !operations || !Array.isArray(operations)) {
      return res.status(400).json({
        success: false,
        message: 'Farmer ID and operations array required'
      });
    }

    const results = [];
    
    for (const operation of operations) {
      try {
        const result = await offlineSyncService.queueOperation({
          ...operation,
          metadata: {
            ...operation.metadata,
            farmerId,
            uploadedAt: new Date().toISOString(),
            deviceId: req.headers['x-device-id']
          }
        });
        
        results.push({
          operationId: operation.operationId,
          success: true,
          syncId: result.operationId,
          status: 'queued'
        });
      } catch (opError) {
        results.push({
          operationId: operation.operationId,
          success: false,
          error: opError.message,
          status: 'failed'
        });
      }
    }

    res.json({
      success: true,
      message: `${results.length} operations queued for sync`,
      data: {
        results,
        syncStatus: offlineSyncService.getSyncStatus(),
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Sync upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Upload failed',
      error: error.message
    });
  }
});

// ==================== FARMER DASHBOARD ====================
router.get('/dashboard/:farmerId', async (req, res) => {
  try {
    const { farmerId } = req.params;
    const { forceRefresh = false } = req.query;

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = await getCachedDashboard(farmerId);
      if (cached) {
        return res.json({
          success: true,
          cached: true,
          data: cached,
          timestamp: cached.timestamp
        });
      }
    }

    // Get farmer service
    const farmerService = serviceRegistry.getService('farmerService');
    
    // Get dashboard data
    const dashboard = await buildFarmerDashboard(farmerId, farmerService);
    
    // Cache the dashboard
    await cacheDashboard(farmerId, dashboard);

    res.json({
      success: true,
      cached: false,
      data: dashboard,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    
    // Return offline dashboard if possible
    const offlineDashboard = await getOfflineDashboard(req.params.farmerId);
    
    if (offlineDashboard) {
      return res.json({
        success: true,
        offline: true,
        message: 'Using offline data',
        data: offlineDashboard,
        timestamp: offlineDashboard.timestamp
      });
    }

    res.status(500).json({
      success: false,
      message: 'Dashboard failed',
      error: error.message
    });
  }
});

// ==================== CROP MONITORING ====================
router.get('/farms/:farmId/crops', async (req, res) => {
  try {
    const { farmId } = req.params;
    const { lastUpdate } = req.query;

    // Get crop service via registry
    const cropService = serviceRegistry.routeRequest('farmer_data');
    
    const crops = await cropService.instance.getFarmCrops(farmId, {
      since: lastUpdate ? new Date(lastUpdate) : null,
      includeObservations: true
    });

    // Add offline viewing instructions
    const cropsWithOfflineSupport = crops.map(crop => ({
      ...crop,
      offlineCapable: true,
      lastObservation: crop.lastObservation || null,
      nextCheckRecommendation: getNextCropCheck(crop.type)
    }));

    res.json({
      success: true,
      data: {
        crops: cropsWithOfflineSupport,
        summary: {
          total: crops.length,
          healthy: crops.filter(c => c.healthScore > 70).length,
          needsAttention: crops.filter(c => c.healthScore <= 70).length,
          lastUpdated: new Date().toISOString()
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Crops error:', error);
    
    // Return cached crop data
    const cachedCrops = await getCachedCrops(req.params.farmId);
    
    res.json({
      success: true,
      cached: true,
      message: 'Using cached crop data',
      data: cachedCrops,
      timestamp: new Date().toISOString()
    });
  }
});

router.post('/crops/:cropId/observations', async (req, res) => {
  try {
    const { cropId } = req.params;
    const observationData = req.body;
    
    // Validate observation data
    const validation = validateObservationData(observationData);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid observation data',
        errors: validation.errors
      });
    }

    // Queue for sync (offline-first)
    const syncResult = await offlineSyncService.queueOperation({
      type: 'crop_observation',
      data: {
        cropId,
        ...observationData,
        deviceInfo: {
          timestamp: new Date().toISOString(),
          deviceId: req.headers['x-device-id'],
          location: observationData.location || null,
          offline: req.headers['x-offline-mode'] === 'true'
        }
      },
      priority: 'normal',
      metadata: {
        farmerId: observationData.farmerId,
        farmId: observationData.farmId
      }
    });

    // If online and AI service available, analyze immediately
    let aiAnalysis = null;
    if (!req.headers['x-offline-mode'] && serviceRegistry.services.get('aiService')?.status === 'healthy') {
      try {
        const aiService = serviceRegistry.getService('aiService');
        if (observationData.images && observationData.images.length > 0) {
          aiAnalysis = await aiService.analyzeCropImage(
            observationData.images[0],
            observationData.cropType,
            observationData.farmId
          );
        }
      } catch (aiError) {
        console.warn('AI analysis skipped:', aiError.message);
      }
    }

    res.json({
      success: true,
      message: 'Observation recorded',
      data: {
        observationId: syncResult.operationId,
        syncStatus: 'queued',
        aiAnalysis,
        nextSteps: [
          'Observation will sync when online',
          'Check back in 24 hours for AI analysis',
          'Monitor crop for changes'
        ]
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Observation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record observation',
      error: error.message
    });
  }
});

// ==================== WEATHER & ALERTS ====================
router.get('/farms/:farmId/weather', async (req, res) => {
  try {
    const { farmId } = req.params;
    const { forecastDays = 3 } = req.query;

    // Try to get weather service
    let weatherData;
    try {
      const weatherService = serviceRegistry.getService('weatherService');
      weatherData = await weatherService.getFarmWeather(farmId, parseInt(forecastDays));
    } catch (weatherError) {
      console.warn('Weather service unavailable:', weatherError.message);
      weatherData = await getCachedWeather(farmId);
    }

    // Format for mobile app
    const formattedWeather = formatWeatherForMobile(weatherData);

    res.json({
      success: true,
      data: formattedWeather,
      source: weatherData.source || 'cache',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Weather error:', error);
    
    // Return basic weather info
    res.json({
      success: true,
      offline: true,
      message: 'Using basic weather data',
      data: getBasicWeatherInfo(),
      timestamp: new Date().toISOString()
    });
  }
});

router.get('/farmers/:farmerId/alerts', async (req, res) => {
  try {
    const { farmerId } = req.params;
    const { unreadOnly = false, limit = 50 } = req.query;

    // Get alerts from notification service
    const notificationService = serviceRegistry.getService('notificationService');
    const alerts = await notificationService.getFarmerAlerts(farmerId, {
      unreadOnly: unreadOnly === 'true',
      limit: parseInt(limit)
    });

    // Format for mobile
    const formattedAlerts = alerts.map(alert => ({
      id: alert._id,
      type: alert.type,
      title: getAlertTitle(alert.type),
      message: alert.message,
      priority: alert.priority,
      timestamp: alert.createdAt,
      read: alert.read,
      actionRequired: alert.actionRequired || false,
      actions: alert.actions || []
    }));

    res.json({
      success: true,
      data: {
        alerts: formattedAlerts,
        summary: {
          total: alerts.length,
          unread: alerts.filter(a => !a.read).length,
          highPriority: alerts.filter(a => a.priority === 'high').length
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Alerts error:', error);
    
    // Return empty alerts (better than error for mobile)
    res.json({
      success: true,
      offline: true,
      message: 'Alerts temporarily unavailable',
      data: {
        alerts: [],
        summary: {
          total: 0,
          unread: 0,
          highPriority: 0
        }
      },
      timestamp: new Date().toISOString()
    });
  }
});

// ==================== TASKS & RECOMMENDATIONS ====================
router.get('/farmers/:farmerId/tasks', async (req, res) => {
  try {
    const { farmerId } = req.params;
    const { status = 'pending', date } = req.query;

    // Get tasks from multiple sources
    const tasks = await getFarmerTasks(farmerId, {
      status,
      date: date ? new Date(date) : null
    });

    // Prioritize tasks
    const prioritizedTasks = prioritizeTasks(tasks);

    res.json({
      success: true,
      data: {
        tasks: prioritizedTasks,
        summary: {
          total: tasks.length,
          pending: tasks.filter(t => t.status === 'pending').length,
          overdue: tasks.filter(t => t.isOverdue).length,
          completedToday: tasks.filter(t => 
            t.status === 'completed' && 
            isToday(t.completedAt)
          ).length
        },
        dailyFocus: getDailyFocusTask(prioritizedTasks)
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Tasks error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load tasks',
      error: error.message
    });
  }
});

router.post('/tasks/:taskId/complete', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { notes, photos, completionTime } = req.body;

    // Queue completion for sync
    const syncResult = await offlineSyncService.queueOperation({
      type: 'task_completion',
      data: {
        taskId,
        completedAt: completionTime || new Date().toISOString(),
        notes,
        photos,
        verified: false // Needs supervisor verification
      },
      priority: 'normal',
      metadata: {
        deviceId: req.headers['x-device-id'],
        offline: req.headers['x-offline-mode'] === 'true'
      }
    });

    res.json({
      success: true,
      message: 'Task marked as completed',
      data: {
        taskId,
        syncId: syncResult.operationId,
        nextTask: await getNextRecommendedTask(taskId),
        rewards: calculateTaskRewards(taskId)
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Task completion error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete task',
      error: error.message
    });
  }
});

// ==================== MARKET PRICES & KNOWLEDGE ====================
router.get('/market/prices', async (req, res) => {
  try {
    const { crop, region, lastUpdate } = req.query;

    // Try to get fresh prices
    let prices;
    try {
      // This would connect to market price API
      prices = await getMarketPrices(crop, region);
    } catch (priceError) {
      console.warn('Market prices unavailable:', priceError.message);
      prices = await getCachedMarketPrices(crop, region);
    }

    // Format for mobile
    const formattedPrices = prices.map(price => ({
      crop: price.crop,
      unit: price.unit,
      price: price.price,
      market: price.market,
      region: price.region,
      timestamp: price.timestamp,
      trend: price.trend || 'stable',
      change: price.change || 0
    }));

    res.json({
      success: true,
      data: {
        prices: formattedPrices,
        lastUpdated: prices[0]?.timestamp || new Date().toISOString(),
        disclaimer: 'Prices are indicative. Verify at local market.'
      },
      source: prices[0]?.source || 'cache',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Market prices error:', error);
    
    // Return sample prices for offline use
    res.json({
      success: true,
      offline: true,
      message: 'Using sample market data',
      data: getSampleMarketPrices(),
      timestamp: new Date().toISOString()
    });
  }
});

router.get('/knowledge/articles', async (req, res) => {
  try {
    const { category, crop, language = 'en' } = req.query;
    
    // Get articles (could be from CMS or static)
    const articles = await getKnowledgeArticles({
      category,
      crop,
      language,
      limit: 20
    });

    // Mark which can be downloaded for offline
    const articlesWithOffline = articles.map(article => ({
      ...article,
      offlineAvailable: article.content.length < 10000, // Small articles only
      downloadSize: estimateDownloadSize(article),
      lastUpdated: article.updatedAt
    }));

    res.json({
      success: true,
      data: {
        articles: articlesWithOffline,
        categories: getArticleCategories(),
        featured: getFeaturedArticles(crop)
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Knowledge articles error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load articles',
      error: error.message
    });
  }
});

// ==================== OFFLINE DATA PACKAGES ====================
router.get('/offline/packages', async (req, res) => {
  try {
    const { farmerId } = req.query;
    
    if (!farmerId) {
      return res.status(400).json({
        success: false,
        message: 'Farmer ID required'
      });
    }

    // Generate offline data package
    const offlinePackage = await generateOfflinePackage(farmerId);

    res.json({
      success: true,
      data: {
        packageId: `offline_${Date.now()}`,
        size: offlinePackage.size,
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        contents: offlinePackage.contents,
        downloadUrl: `/api/farmer-app/offline/packages/download/${offlinePackage.id}`,
        instructions: [
          'Download when connected to WiFi',
          'Package valid for 7 days',
          'Includes weather forecasts, market prices, and knowledge articles'
        ]
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Offline package error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate offline package',
      error: error.message
    });
  }
});

router.get('/offline/packages/download/:packageId', async (req, res) => {
  try {
    const { packageId } = req.params;
    
    // Get package data
    const packageData = await getOfflinePackage(packageId);
    
    if (!packageData) {
      return res.status(404).json({
        success: false,
        message: 'Offline package not found'
      });
    }

    // Set headers for file download
    res.set({
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="sianagritech_offline_${packageId}.json"`,
      'Content-Length': Buffer.byteLength(JSON.stringify(packageData))
    });

    res.send(JSON.stringify(packageData));

  } catch (error) {
    console.error('Package download error:', error);
    res.status(500).json({
      success: false,
      message: 'Download failed',
      error: error.message
    });
  }
});

// ==================== HEALTH & SUPPORT ====================
router.get('/app/health', async (req, res) => {
  try {
    const deviceInfo = {
      deviceId: req.headers['x-device-id'],
      appVersion: req.headers['x-app-version'],
      platform: req.headers['x-platform'],
      offlineMode: req.headers['x-offline-mode'] === 'true'
    };

    // Check service availability
    const services = serviceRegistry.getRegistryStatus();
    
    // Check offline sync queue
    const syncStatus = offlineSyncService.getSyncStatus();
    
    // Get app-specific metrics
    const appMetrics = await getAppMetrics(deviceInfo.deviceId);

    res.json({
      success: true,
      data: {
        device: deviceInfo,
        services: services.system,
        sync: syncStatus,
        metrics: appMetrics,
        recommendations: generateAppHealthRecommendations(deviceInfo, services, syncStatus)
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('App health error:', error);
    res.status(500).json({
      success: false,
      message: 'Health check failed',
      error: error.message
    });
  }
});

router.post('/support/feedback', async (req, res) => {
  try {
    const { farmerId, type, message, rating, photos } = req.body;
    
    if (!farmerId || !message) {
      return res.status(400).json({
        success: false,
        message: 'Farmer ID and message required'
      });
    }

    // Queue feedback for sync
    const syncResult = await offlineSyncService.queueOperation({
      type: 'farmer_feedback',
      data: {
        farmerId,
        type: type || 'general',
        message,
        rating: rating || null,
        photos: photos || [],
        deviceInfo: {
          deviceId: req.headers['x-device-id'],
          appVersion: req.headers['x-app-version'],
          timestamp: new Date().toISOString()
        }
      },
      priority: 'low',
      metadata: {
        source: 'mobile_app'
      }
    });

    res.json({
      success: true,
      message: 'Feedback received',
      data: {
        feedbackId: syncResult.operationId,
        thankYouMessage: getThankYouMessage(type),
        followUp: type === 'bug' ? 'We will investigate within 48 hours' : null
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit feedback',
      error: error.message
    });
  }
});

// ==================== HELPER FUNCTIONS ====================
function formatPhoneNumber(phone) {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // Format for East Africa
  if (digits.startsWith('256') && digits.length === 12) {
    return `+${digits}`;
  } else if (digits.startsWith('0') && digits.length === 10) {
    return `+256${digits.substring(1)}`;
  } else if (digits.length >= 10) {
    return `+${digits}`;
  }
  
  return phone;
}

function generateSessionToken(farmerId) {
  return `app_${farmerId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

async function storeSession(farmerId, token) {
  // Store in Redis or database
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  
  const Session = mongoose.models.Session || mongoose.model('Session', 
    new mongoose.Schema({
      farmerId: String,
      token: String,
      deviceInfo: mongoose.Schema.Types.Mixed,
      expiresAt: Date,
      createdAt: { type: Date, default: Date.now }
    })
  );
  
  await Session.create({
    farmerId,
    token,
    deviceInfo: {},
    expiresAt
  });
  
  return true;
}

async function getChangesSince(farmerId, lastSync) {
  const changes = {
    farms: [],
    crops: [],
    tasks: [],
    alerts: [],
    weather: [],
    lastSync: lastSync || null
  };

  if (!lastSync) {
    // Initial sync - return everything
    const Farmer = mongoose.models.Farmer;
    const farmer = await Farmer.findById(farmerId)
      .populate('farms')
      .lean();
    
    changes.farms = farmer.farms || [];
    // ... load other data
  } else {
    // Incremental sync
    const syncDate = new Date(lastSync);
    
    // Get updated farms
    const Farm = mongoose.models.Farm;
    changes.farms = await Farm.find({
      farmerId,
      updatedAt: { $gt: syncDate }
    }).lean();
    
    // Get new alerts
    // ... etc
  }

  return changes;
}

async function processOfflineOperations(operations) {
  const results = [];
  
  for (const op of operations) {
    try {
      // Validate operation
      const validation = validateOfflineOperation(op);
      if (!validation.valid) {
        results.push({
          operationId: op.operationId,
          success: false,
          error: 'Invalid operation',
          details: validation.errors
        });
        continue;
      }

      // Process based on type
      let result;
      switch (op.type) {
        case 'crop_observation':
          result = await processCropObservation(op.data);
          break;
        case 'task_completion':
          result = await processTaskCompletion(op.data);
          break;
        case 'farmer_feedback':
          result = await processFarmerFeedback(op.data);
          break;
        default:
          result = { success: false, error: 'Unknown operation type' };
      }

      results.push({
        operationId: op.operationId,
        success: result.success,
        data: result.data,
        error: result.error
      });

    } catch (error) {
      results.push({
        operationId: op.operationId,
        success: false,
        error: error.message
      });
    }
  }
  
  return results;
}

async function buildFarmerDashboard(farmerId, farmerService) {
  // This would aggregate data from multiple services
  const dashboard = {
    farmerId,
    updatedAt: new Date().toISOString(),
    overview: {
      farmCount: 0,
      totalArea: 0,
      activeCrops: 0,
      tasksPending: 0,
      alerts: 0
    },
    farms: [],
    weather: {},
    market: {},
    insights: [],
    quickActions: []
  };

  try {
    // Get farmer data
    const farmer = await farmerService.getFarmerById(farmerId);
    dashboard.farmer = farmer;
    
    // Get farms
    const farms = await farmerService.getFarmerFarms(farmerId);
    dashboard.overview.farmCount = farms.length;
    dashboard.overview.totalArea = farms.reduce((sum, farm) => sum + (farm.size || 0), 0);
    dashboard.farms = farms;
    
    // Get weather for primary farm
    if (farms.length > 0) {
      try {
        const weatherService = serviceRegistry.getService('weatherService');
        const weather = await weatherService.getFarmWeather(farms[0]._id);
        dashboard.weather = weather;
      } catch (weatherError) {
        console.warn('Weather service unavailable for dashboard');
      }
    }
    
    // Get tasks
    const tasks = await getFarmerTasks(farmerId, { status: 'pending' });
    dashboard.overview.tasksPending = tasks.length;
    
    // Get alerts
    try {
      const notificationService = serviceRegistry.getService('notificationService');
      const alerts = await notificationService.getFarmerAlerts(farmerId, { unreadOnly: true });
      dashboard.overview.alerts = alerts.length;
    } catch (alertError) {
      console.warn('Notification service unavailable');
    }
    
    // Generate insights
    dashboard.insights = generateDashboardInsights(farms, dashboard.weather, tasks);
    
    // Set quick actions
    dashboard.quickActions = getQuickActions(farmer, farms, tasks);

  } catch (error) {
    console.error('Dashboard build error:', error);
    throw error;
  }
  
  return dashboard;
}

function validateObservationData(data) {
  const errors = [];
  
  if (!data.cropId) errors.push('cropId is required');
  if (!data.farmerId) errors.push('farmerId is required');
  if (!data.farmId) errors.push('farmId is required');
  
  // Validate observation type
  const validTypes = ['visual', 'measurement', 'photo', 'issue'];
  if (data.type && !validTypes.includes(data.type)) {
    errors.push(`type must be one of: ${validTypes.join(', ')}`);
  }
  
  // Validate photos if present
  if (data.photos && !Array.isArray(data.photos)) {
    errors.push('photos must be an array');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

function formatWeatherForMobile(weatherData) {
  if (!weatherData || !weatherData.data) {
    return getBasicWeatherInfo();
  }
  
  const { current, forecast } = weatherData.data;
  
  return {
    current: {
      temperature: current?.temperature || 'N/A',
      condition: current?.condition || 'Unknown',
      humidity: current?.humidity || 'N/A',
      rainfall: current?.precipitation || 0,
      updated: new Date().toISOString()
    },
    forecast: (forecast || []).slice(0, 3).map(day => ({
      day: day.date ? new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' }) : 'Unknown',
      high: day.temperature?.max || 'N/A',
      low: day.temperature?.min || 'N/A',
      condition: day.condition || 'Unknown',
      rainChance: day.precipitation?.probability || 0
    })),
    alerts: weatherData.alerts || [],
    source: weatherData.source || 'unknown'
  };
}

async function getFarmerTasks(farmerId, options = {}) {
  const { status = 'pending', date = null } = options;
  
  // This would query tasks from database
  const Task = mongoose.models.Task || mongoose.model('Task',
    new mongoose.Schema({
      farmerId: String,
      farmId: String,
      type: String,
      title: String,
      description: String,
      dueDate: Date,
      priority: { type: String, enum: ['low', 'medium', 'high'] },
      status: { type: String, enum: ['pending', 'in_progress', 'completed', 'overdue'] },
      completedAt: Date,
      notes: String,
      photos: [String],
      createdAt: { type: Date, default: Date.now }
    })
  );
  
  const query = { farmerId, status };
  if (date) {
    query.dueDate = { $lte: date };
  }
  
  return await Task.find(query)
    .sort({ priority: -1, dueDate: 1 })
    .limit(50)
    .lean();
}

function prioritizeTasks(tasks) {
  return tasks.sort((a, b) => {
    // Priority weights
    const priorityWeights = { high: 3, medium: 2, low: 1 };
    
    // Calculate scores
    const scoreA = (priorityWeights[a.priority] || 1) * 
                   (a.status === 'overdue' ? 2 : 1);
    const scoreB = (priorityWeights[b.priority] || 1) * 
                   (b.status === 'overdue' ? 2 : 1);
    
    return scoreB - scoreA; // Higher score first
  });
}

function getDailyFocusTask(tasks) {
  if (tasks.length === 0) return null;
  
  // Find highest priority overdue task
  const overdue = tasks.find(t => t.status === 'overdue');
  if (overdue) return overdue;
  
  // Find high priority pending task
  const highPriority = tasks.find(t => t.priority === 'high' && t.status === 'pending');
  if (highPriority) return highPriority;
  
  // Return first task
  return tasks[0];
}

async function generateOfflinePackage(farmerId) {
  // This would generate a comprehensive offline data package
  const packageData = {
    id: `offline_${farmerId}_${Date.now()}`,
    farmerId,
    generatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    contents: {
      farmerInfo: {},
      farms: [],
      crops: [],
      tasks: [],
      knowledge: [],
      marketPrices: [],
      weatherForecast: {}
    },
    size: 0
  };

  try {
    // Get farmer info
    const Farmer = mongoose.models.Farmer;
    packageData.contents.farmerInfo = await Farmer.findById(farmerId).lean();
    
    // Get farms
    const Farm = mongoose.models.Farm;
    packageData.contents.farms = await Farm.find({ farmerId }).lean();
    
    // Get tasks for next 7 days
    const Task = mongoose.models.Task;
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    packageData.contents.tasks = await Task.find({
      farmerId,
      dueDate: { $lte: nextWeek },
      status: { $in: ['pending', 'overdue'] }
    }).lean();
    
    // Get knowledge articles
    packageData.contents.knowledge = await getKnowledgeArticles({
      limit: 10,
      offlineFriendly: true
    });
    
    // Get market prices
    packageData.contents.marketPrices = await getCachedMarketPrices();
    
    // Calculate size
    packageData.size = Buffer.byteLength(JSON.stringify(packageData));
    
  } catch (error) {
    console.error('Offline package generation error:', error);
    throw error;
  }
  
  return packageData;
}

// Cache helper functions
async function getCachedDashboard(farmerId) {
  // Implement Redis or memory cache
  return null;
}

async function cacheDashboard(farmerId, dashboard) {
  // Implement caching
}

async function getOfflineDashboard(farmerId) {
  // Generate basic dashboard from local data
  return {
    farmerId,
    offline: true,
    message: 'Using offline data - connect for latest information',
    overview: {
      farmCount: 0,
      tasksPending: 0
    },
    farms: [],
    timestamp: new Date().toISOString()
  };
}

export default router;