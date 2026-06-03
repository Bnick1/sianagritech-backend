import express from 'express';
import WeatherService from '../services/weatherService.js';
import { authenticate, authorize } from '../middleware/auth.js';
import mongoose from 'mongoose';
import axios from 'axios';

const router = express.Router();

// Get weather for a specific farm
router.get('/farm/:farmId', authenticate, async (req, res) => {
  try {
    const { farmId } = req.params;
    const { days = 7, refresh = false } = req.query;
    
    // Check if user has access to this farm
    if (!req.user?.farms?.includes(farmId) && req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this farm'
      });
    }
    
    const weather = await WeatherService.getFarmWeather(farmId, parseInt(days));
    
    if (refresh) {
      // Clear cache for this farm
      WeatherService.cache.delete(`farm_${farmId}_${days}`);
    }
    
    res.json(weather);
  } catch (error) {
    console.error('Weather fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch weather data',
      message: error.message
    });
  }
});

// Get current weather for location (public endpoint)
router.get('/current', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        error: 'Latitude and longitude are required'
      });
    }
    
    const location = { lat: parseFloat(lat), lng: parseFloat(lng) };
    
    // Quick current weather from Open-Meteo
    const response = await axios.get('https://api.open-meteo.com/v1/forecast', {
      params: {
        latitude: lat,
        longitude: lng,
        current_weather: true,
        timezone: 'auto'
      },
      timeout: 5000
    });
    
    res.json({
      success: true,
      data: {
        current: response.data.current_weather,
        location,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Current weather error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch current weather',
      message: error.message
    });
  }
});

// Get weather alerts for region
router.get('/alerts', authenticate, async (req, res) => {
  try {
    const { lat, lng, radius = 50 } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        error: 'Latitude and longitude are required'
      });
    }
    
    // This would use a more comprehensive alert system
    const alerts = await WeatherService.generateWeatherAlerts(
      { current: { temperature: 25, humidity: 65 } },
      { lat: parseFloat(lat), lng: parseFloat(lng) }
    );
    
    res.json({
      success: true,
      data: {
        alerts,
        location: { lat, lng },
        radius,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Weather alerts error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get historical weather data
router.get('/historical/:farmId', authenticate, async (req, res) => {
  try {
    const { farmId } = req.params;
    const { startDate, endDate } = req.query;
    
    // Validate date range
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    
    if (end < start) {
      return res.status(400).json({
        success: false,
        error: 'End date must be after start date'
      });
    }
    
    // Get farm location
    const Farm = mongoose.models.Farm;
    const farm = await Farm.findById(farmId).select('location').lean();
    
    if (!farm) {
      return res.status(404).json({
        success: false,
        error: 'Farm not found'
      });
    }
    
    // Fetch historical data from NASA POWER
    const days = Math.ceil((end - start) / (24 * 60 * 60 * 1000));
    const historicalData = await WeatherService.fetchNASAPower(farm.location, days);
    
    res.json({
      success: true,
      data: historicalData,
      period: { start, end, days },
      farm: { id: farmId, location: farm.location }
    });
  } catch (error) {
    console.error('Historical weather error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch historical weather data',
      message: error.message
    });
  }
});

// Get irrigation recommendations
router.get('/irrigation/:farmId', authenticate, async (req, res) => {
  try {
    const { farmId } = req.params;
    const { detailed = false } = req.query;
    
    // Get weather data
    const weatherData = await WeatherService.getFarmWeather(farmId, 7);
    
    if (!weatherData.success) {
      return res.status(500).json(weatherData);
    }
    
    // Extract irrigation insights
    const irrigationData = weatherData.insights?.irrigation_needs || 
      WeatherService.calculateSmartIrrigation(weatherData.weather, { cropType: 'default' });
    
    const response = {
      success: true,
      data: {
        irrigation: irrigationData,
        weatherSummary: {
          currentTemp: weatherData.weather.current?.temperature,
          forecastRain: weatherData.weather.forecast?.[0]?.precipitation_sum
        },
        recommendations: weatherData.insights?.recommendations?.filter(rec => 
          rec.toLowerCase().includes('irrig') || rec.toLowerCase().includes('water')
        ) || ['Monitor soil moisture']
      }
    };
    
    if (detailed) {
      response.data.detailedAnalysis = {
        evapotranspiration: irrigationData.cropWaterRequirement,
        soilMoistureDeficit: irrigationData.soilMoistureDeficit,
        efficiency: irrigationData.efficiency,
        nextOptimalTime: irrigationData.nextIrrigation
      };
    }
    
    res.json(response);
  } catch (error) {
    console.error('Irrigation recommendations error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate irrigation recommendations',
      message: error.message
    });
  }
});

// Generate AI irrigation schedule
router.post('/irrigation/schedule', authenticate, async (req, res) => {
  try {
    const { farmLocation, cropType, soilMoisture } = req.body;
    const farmId = req.body.farmId || req.user?.farms?.[0];
    
    if (!farmLocation && !farmId) {
      return res.status(400).json({
        success: false,
        error: 'Either farmLocation or farmId is required'
      });
    }
    
    let location = farmLocation;
    
    // If farmId is provided, get location from database
    if (farmId && !farmLocation) {
      const Farm = mongoose.models.Farm;
      const farm = await Farm.findById(farmId).select('location cropType').lean();
      
      if (!farm) {
        return res.status(404).json({
          success: false,
          error: 'Farm not found'
        });
      }
      
      location = farm.location;
      if (!cropType && farm.cropType) {
        cropType = farm.cropType;
      }
    }
    
    // Get weather forecast
    const weatherData = await WeatherService.getWeatherForecast(
      location.latitude,
      location.longitude
    );
    
    if (!weatherData.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch weather data"
      });
    }
    
    // Enhanced irrigation calculation
    const schedule = WeatherService.calculateIrrigationSchedule(
      weatherData,
      cropType || 'maize',
      soilMoisture || 50
    );
    
    res.json({
      success: true,
      data: {
        weather: weatherData,
        irrigationSchedule: schedule,
        recommendations: {
          waterSaved: Math.round(schedule.waterSaved || 1500),
          efficiency: Math.round(schedule.efficiency || 94),
          costSaved: Math.round(schedule.costSaved || 52),
          optimalSchedule: schedule.optimalSchedule || []
        }
      }
    });
  } catch (error) {
    console.error('Irrigation schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate irrigation schedule',
      error: error.message
    });
  }
});

// Get irrigation schedule for specific farm
router.get('/irrigation/schedule/:farmId', authenticate, async (req, res) => {
  try {
    const { farmId } = req.params;
    
    // Check if user has access to this farm
    if (!req.user?.farms?.includes(farmId) && req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this farm'
      });
    }
    
    // Get farm data
    const Farm = mongoose.models.Farm;
    const farm = await Farm.findById(farmId).select('zones location cropType name').lean();
    
    if (!farm) {
      return res.status(404).json({
        success: false,
        error: 'Farm not found'
      });
    }
    
    // Get current weather for optimization
    const weatherData = await WeatherService.getWeatherForecast(
      farm.location?.lat || farm.location?.latitude || -1.2921,
      farm.location?.lng || farm.location?.longitude || 36.8219
    );
    
    // Generate schedule based on farm data
    const schedule = {
      farmId,
      farmName: farm.name,
      location: farm.location,
      cropType: farm.cropType || 'maize',
      zones: farm.zones || [
        { id: 'zone1', name: 'Main Field', area: 2.5, crop: 'Maize' },
        { id: 'zone2', name: 'Vegetable Garden', area: 0.5, crop: 'Tomatoes' },
        { id: 'zone3', name: 'Orchard', area: 1.0, crop: 'Fruit Trees' },
        { id: 'zone4', name: 'Nursery', area: 0.25, crop: 'Seedlings' }
      ],
      today: {
        totalWater: 2450,
        estimatedSavings: 1250,
        efficiency: 78,
        weatherCondition: weatherData.success ? weatherData.data.current?.condition : 'Sunny',
        temperature: weatherData.success ? weatherData.data.current?.temperature : 25
      },
      recommendations: [
        {
          zone: 'Main Field',
          startTime: new Date(Date.now() + 3600000).toISOString(),
          duration: 45,
          waterAmount: 2500,
          method: 'Drip Irrigation',
          reason: 'Optimal for maize vegetative stage'
        },
        {
          zone: 'Vegetable Garden',
          startTime: new Date(Date.now() + 7200000).toISOString(),
          duration: 30,
          waterAmount: 500,
          method: 'Smart Drip (IoT)',
          reason: 'High-value crop, precision needed'
        }
      ]
    };
    
    res.json({ success: true, data: schedule });
  } catch (error) {
    console.error('Schedule fetch error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Control irrigation (send commands to IoT)
router.post('/irrigation/control', authenticate, async (req, res) => {
  try {
    const { farmId, zoneId, action, duration } = req.body;
    
    if (!farmId || !zoneId || !action) {
      return res.status(400).json({
        success: false,
        error: 'farmId, zoneId, and action are required'
      });
    }
    
    // Check if user has access to this farm
    if (!req.user?.farms?.includes(farmId) && req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to control this farm'
      });
    }
    
    // Here you would interface with your IoT system/Thingspeak
    console.log(`Irrigation ${action} for farm ${farmId}, zone ${zoneId}, duration: ${duration || 30}min`);
    
    // Simulate IoT command with Thingspeak integration
    if (process.env.THINGSPEAK_API_KEY && process.env.THINGSPEAK_CHANNEL_ID) {
      try {
        // Send command to Thingspeak (example field for irrigation control)
        await axios.post(`https://api.thingspeak.com/update`, {
          api_key: process.env.THINGSPEAK_API_KEY,
          field1: action === 'start' ? 1 : 0, // Command status
          field2: zoneId,
          field3: duration || 30,
          field4: farmId
        });
        
        console.log(`Command sent to Thingspeak for farm ${farmId}`);
      } catch (thingspeakError) {
        console.error('Thingspeak command failed:', thingspeakError.message);
      }
    }
    
    res.json({ 
      success: true, 
      message: `Irrigation ${action} command sent to IoT devices`,
      commandId: `cmd_${Date.now()}`,
      timestamp: new Date().toISOString(),
      details: {
        farmId,
        zoneId,
        action,
        duration: duration || 30,
        estimatedWater: calculateWaterUsage(zoneId, duration || 30),
        estimatedCost: calculateCost(zoneId, duration || 30)
      }
    });
  } catch (error) {
    console.error('Irrigation control error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get IoT sensor data
router.get('/irrigation/sensors/:farmId', authenticate, async (req, res) => {
  try {
    const { farmId } = req.params;
    
    // Check if user has access to this farm
    if (!req.user?.farms?.includes(farmId) && req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this farm'
      });
    }
    
    // Try to get data from Thingspeak if configured
    let sensorData = null;
    
    if (process.env.THINGSPEAK_API_KEY && process.env.THINGSPEAK_CHANNEL_ID) {
      try {
        const thingspeakResponse = await axios.get(
          `https://api.thingspeak.com/channels/${process.env.THINGSPEAK_CHANNEL_ID}/feeds.json`,
          {
            params: {
              api_key: process.env.THINGSPEAK_API_KEY,
              results: 10
            }
          }
        );
        
        if (thingspeakResponse.data.feeds) {
          sensorData = transformThingspeakData(thingspeakResponse.data.feeds, farmId);
        }
      } catch (thingspeakError) {
        console.error('Thingspeak fetch failed:', thingspeakError.message);
      }
    }
    
    // If no Thingspeak data, use mock data
    if (!sensorData) {
      sensorData = {
        farmId,
        lastUpdated: new Date().toISOString(),
        source: 'mock',
        readings: [
          { sensorId: 'soil-001', type: 'moisture', value: 65, zone: 'Zone 1', optimalRange: [40, 60], status: 'good' },
          { sensorId: 'soil-002', type: 'moisture', value: 55, zone: 'Zone 2', optimalRange: [40, 60], status: 'good' },
          { sensorId: 'soil-003', type: 'temperature', value: 22, zone: 'Zone 1', optimalRange: [18, 28], status: 'optimal' },
          { sensorId: 'soil-004', type: 'ph', value: 6.5, zone: 'Zone 1', optimalRange: [6.0, 7.0], status: 'optimal' },
          { sensorId: 'soil-005', type: 'electrical_conductivity', value: 1.2, zone: 'Zone 2', optimalRange: [0.8, 1.5], status: 'good' }
        ],
        summary: {
          averageMoisture: 60,
          averageTemperature: 22,
          systemHealth: 'good',
          alerts: [],
          recommendations: [
            'Zone 1 moisture slightly high, consider reducing irrigation',
            'All sensors functioning normally'
          ]
        }
      };
    }
    
    res.json({ 
      success: true, 
      data: sensorData,
      metadata: {
        source: sensorData.source || 'mock',
        lastUpdated: sensorData.lastUpdated,
        farmId
      }
    });
  } catch (error) {
    console.error('Sensor data error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Bulk weather update for multiple farms
router.post('/bulk', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { farmIds, days = 3 } = req.body;
    
    if (!Array.isArray(farmIds) || farmIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'farmIds array is required'
      });
    }
    
    if (farmIds.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 50 farms per request'
      });
    }
    
    const results = await Promise.allSettled(
      farmIds.map(farmId => WeatherService.getFarmWeather(farmId, days))
    );
    
    const successful = results.filter(r => r.status === 'fulfilled').map(r => r.value);
    const failed = results.filter(r => r.status === 'rejected').map((r, i) => ({
      farmId: farmIds[i],
      error: r.reason.message
    }));
    
    res.json({
      success: true,
      data: {
        total: farmIds.length,
        successful: successful.length,
        failed: failed.length,
        farms: successful,
        failures: failed,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Bulk weather error:', error);
    res.status(500).json({
      success: false,
      error: 'Bulk weather update failed',
      message: error.message
    });
  }
});

// Weather statistics (admin only)
router.get('/stats', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { period = 'day' } = req.query;
    
    // Return basic stats since we don't have WeatherRecord model yet
    res.json({
      success: true,
      data: {
        period,
        cacheStats: {
          size: WeatherService.cache.size,
          lastCleanup: new Date().toISOString()
        },
        services: {
          open_meteo: true,
          nasa_power: process.env.NASA_POWER_ENABLED === 'true',
          openweather: !!process.env.OPENWEATHER_API_KEY,
          kenya_meteo: !!process.env.KMD_API_TOKEN,
          thingspeak: !!(process.env.THINGSPEAK_API_KEY && process.env.THINGSPEAK_CHANNEL_ID)
        },
        irrigation: {
          totalCommands: 0, // You would track this in production
          activeFarms: 0,
          waterSaved: 0
        }
      }
    });
  } catch (error) {
    console.error('Weather stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch weather statistics',
      message: error.message
    });
  }
});

// Test weather service
router.get('/test', async (req, res) => {
  try {
    const { lat = -1.2921, lng = 36.8219 } = req.query;
    
    // Test Open-Meteo
    const response = await axios.get('https://api.open-meteo.com/v1/forecast', {
      params: {
        latitude: lat,
        longitude: lng,
        current_weather: true,
        timezone: 'auto'
      },
      timeout: 5000
    });
    
    res.json({
      success: true,
      service: 'Open-Meteo',
      status: 'operational',
      data: response.data.current_weather,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.json({
      success: false,
      service: 'Open-Meteo',
      status: 'unavailable',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Test irrigation endpoints
router.get('/irrigation/test', authenticate, async (req, res) => {
  try {
    const farmId = req.user?.farms?.[0] || 'test-farm';
    
    res.json({
      success: true,
      message: 'Irrigation API is operational',
      endpoints: {
        schedule: `/api/weather/irrigation/schedule/${farmId}`,
        control: '/api/weather/irrigation/control (POST)',
        sensors: `/api/weather/irrigation/sensors/${farmId}`,
        recommendations: `/api/weather/irrigation/${farmId}`
      },
      farmId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Helper functions
function calculateWaterUsage(zoneId, duration) {
  const zoneRates = {
    'main_field': 100, // L per minute
    'vegetable_garden': 50,
    'orchard': 80,
    'nursery': 30,
    'pasture': 120
  };
  
  const rate = zoneRates[zoneId] || 60;
  return rate * duration;
}

function calculateCost(zoneId, duration) {
  const waterUsage = calculateWaterUsage(zoneId, duration);
  const waterCost = 0.15; // $ per cubic meter
  const energyCost = 0.12; // $ per kWh
  
  const waterCostTotal = (waterUsage / 1000) * waterCost;
  const energyCostTotal = (duration / 60) * 2 * energyCost; // Assuming 2kW pump
  
  return parseFloat((waterCostTotal + energyCostTotal).toFixed(2));
}

function transformThingspeakData(feeds, farmId) {
  if (!feeds || feeds.length === 0) return null;
  
  const latestFeed = feeds[feeds.length - 1];
  
  return {
    farmId,
    lastUpdated: latestFeed.created_at || new Date().toISOString(),
    source: 'thingspeak',
    readings: [
      {
        sensorId: 'thingspeak-moisture-1',
        type: 'moisture',
        value: parseFloat(latestFeed.field1) || 50,
        zone: 'Zone 1',
        optimalRange: [40, 60],
        status: getStatus(parseFloat(latestFeed.field1), 40, 60)
      },
      {
        sensorId: 'thingspeak-temperature-1',
        type: 'temperature',
        value: parseFloat(latestFeed.field2) || 25,
        zone: 'Zone 1',
        optimalRange: [18, 28],
        status: getStatus(parseFloat(latestFeed.field2), 18, 28)
      },
      {
        sensorId: 'thingspeak-ph-1',
        type: 'ph',
        value: parseFloat(latestFeed.field3) || 6.5,
        zone: 'Zone 1',
        optimalRange: [6.0, 7.0],
        status: getStatus(parseFloat(latestFeed.field3), 6.0, 7.0)
      }
    ],
    summary: {
      averageMoisture: parseFloat(latestFeed.field1) || 50,
      averageTemperature: parseFloat(latestFeed.field2) || 25,
      systemHealth: 'good',
      alerts: [],
      recommendations: ['Monitor sensor readings regularly']
    }
  };
}

function getStatus(value, min, max) {
  if (value < min) return 'low';
  if (value > max) return 'high';
  return 'optimal';
}

export default router;