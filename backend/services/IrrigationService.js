import mongoose from 'mongoose';
import AIService from './aiService.js';
import offlineSyncService from './offlineSyncService.js';

class IrrigationService {
  constructor() {
    this.activeSchedules = new Map();
  }

  /**
   * Calculate optimal irrigation schedule
   */
  async calculateSchedule(farmId, userPreferences) {
    try {
      // Get farm data
      const farm = await this.getFarmData(farmId);
      if (!farm) {
        throw new Error(`Farm ${farmId} not found`);
      }

      // Get latest sensor data
      const sensorData = await this.getLatestSensorData(farmId);
      
      // Get weather forecast
      const weatherData = await this.getWeatherForecast(farmId);
      
      // Get AI recommendation
      const aiRecommendation = await AIService.recommendIrrigation(farmId, farm.primaryCrop);
      
      // Calculate water requirements for each zone
      const zones = farm.zones || [];
      const zoneCalculations = zones.map(zone => 
        this.calculateZoneIrrigation(zone, sensorData, weatherData, aiRecommendation, userPreferences)
      );

      // Generate schedule
      const schedule = this.generateIrrigationSchedule(zoneCalculations, userPreferences);
      
      // Store schedule
      await this.saveSchedule(farmId, schedule, userPreferences);
      
      // Queue for sync if needed
      await offlineSyncService.queueOperation({
        type: 'irrigation_schedule',
        data: { farmId, schedule, calculatedAt: new Date() },
        priority: 'normal'
      });

      // Calculate totals
      const totals = this.calculateTotals(zoneCalculations, userPreferences);
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(zones, sensorData, weatherData, aiRecommendation);

      return {
        success: true,
        schedule,
        zoneCalculations,
        totals,
        recommendations,
        calculatedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Irrigation schedule calculation failed:', error);
      return {
        success: false,
        error: error.message,
        fallback: this.generateFallbackSchedule(farmId)
      };
    }
  }

  /**
   * Execute irrigation command
   */
  async executeIrrigation(farmId, zoneId, duration, waterAmount) {
    try {
      const command = {
        farmId,
        zoneId,
        action: 'START_IRRIGATION',
        duration,
        waterAmount,
        timestamp: new Date().toISOString(),
        source: 'api'
      };

      // Save command to database
      const IrrigationCommand = mongoose.models.IrrigationCommand || 
        mongoose.model('IrrigationCommand', new mongoose.Schema({
          farmId: { type: String, required: true, index: true },
          zoneId: { type: String, required: true },
          action: { type: String, required: true },
          duration: { type: Number, required: true }, // minutes
          waterAmount: { type: Number, required: true }, // liters
          status: { 
            type: String, 
            enum: ['pending', 'executing', 'completed', 'failed'],
            default: 'pending'
          },
          executedAt: Date,
          createdAt: { type: Date, default: Date.now }
        }));

      const savedCommand = await IrrigationCommand.create({
        ...command,
        status: 'pending'
      });

      // Send to IoT device
      await this.sendToIoTDevice(command);

      // Queue for offline sync
      await offlineSyncService.queueOperation({
        type: 'irrigation_command',
        data: command,
        priority: 'high'
      });

      return {
        success: true,
        commandId: savedCommand._id,
        message: `Irrigation started for zone ${zoneId}`,
        estimatedCompletion: new Date(Date.now() + duration * 60 * 1000).toISOString()
      };

    } catch (error) {
      console.error('Failed to execute irrigation:', error);
      
      // Queue for retry
      await offlineSyncService.queueOperation({
        type: 'irrigation_command',
        data: { farmId, zoneId, duration, waterAmount },
        priority: 'high',
        metadata: { error: error.message, retry: true }
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get irrigation history
   */
  async getIrrigationHistory(farmId, days = 7) {
    try {
      const IrrigationCommand = mongoose.models.IrrigationCommand;
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const history = await IrrigationCommand.find({
        farmId,
        createdAt: { $gte: startDate }
      })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

      return {
        success: true,
        history,
        summary: this.calculateHistorySummary(history)
      };

    } catch (error) {
      console.error('Failed to fetch irrigation history:', error);
      return {
        success: false,
        error: error.message,
        history: []
      };
    }
  }

  // Helper Methods

  async getFarmData(farmId) {
    const Farm = mongoose.models.Farm;
    return await Farm.findById(farmId).lean();
  }

  async getLatestSensorData(farmId) {
    const SensorReading = mongoose.models.SensorReading;
    const latestReadings = await SensorReading.find({ farmId })
      .sort({ timestamp: -1 })
      .limit(10)
      .lean();

    // Aggregate readings by sensor type
    const aggregated = {
      soilMoisture: this.calculateAverage(latestReadings.filter(r => r.type === 'soil_moisture')),
      temperature: this.calculateAverage(latestReadings.filter(r => r.type === 'temperature')),
      humidity: this.calculateAverage(latestReadings.filter(r => r.type === 'humidity'))
    };

    return aggregated;
  }

  async getWeatherForecast(farmId) {
    const WeatherRecord = mongoose.models.WeatherRecord;
    const forecast = await WeatherRecord.findOne({ farmId })
      .sort({ createdAt: -1 })
      .lean();

    return forecast?.data?.forecast || [];
  }

  calculateZoneIrrigation(zone, sensorData, weatherData, aiRecommendation, userPreferences) {
    const cropWaterRequirement = this.getCropWaterRequirement(zone.crop);
    const soilMoisture = sensorData.soilMoisture || 50;
    const temperature = sensorData.temperature || 25;
    
    // Calculate water need based on multiple factors
    let waterNeeded = cropWaterRequirement * zone.area;
    
    // Adjust for soil moisture
    if (soilMoisture > userPreferences.soilMoistureThreshold) {
      waterNeeded *= 0.5; // Reduce water if soil is moist
    } else if (soilMoisture < userPreferences.soilMoistureThreshold * 0.7) {
      waterNeeded *= 1.3; // Increase water if soil is dry
    }
    
    // Adjust for temperature
    if (temperature > 30) waterNeeded *= 1.2;
    if (temperature < 15) waterNeeded *= 0.8;
    
    // Adjust for method efficiency
    const methodEfficiency = this.getMethodEfficiency(userPreferences.irrigationMethod);
    waterNeeded /= methodEfficiency;
    
    // Check weather forecast
    const todayForecast = weatherData[0];
    if (todayForecast && todayForecast.rainChance > 70) {
      waterNeeded *= 0.3; // Reduce water if rain expected
    }
    
    // Apply user priority
    waterNeeded = this.applyPriority(waterNeeded, userPreferences.priority);
    
    // Calculate duration based on irrigation method
    const duration = this.calculateDuration(waterNeeded, userPreferences.irrigationMethod);
    
    return {
      zoneId: zone.id,
      zoneName: zone.name,
      crop: zone.crop,
      area: zone.area,
      waterNeeded: Math.round(waterNeeded),
      duration: Math.round(duration),
      startTime: this.calculateOptimalStartTime(zone.id, weatherData),
      method: userPreferences.irrigationMethod,
      efficiency: Math.round(methodEfficiency * 100),
      status: 'scheduled'
    };
  }

  getCropWaterRequirement(crop) {
    const requirements = {
      'Maize': 500,      // liters/day/ha
      'Tomatoes': 600,
      'Fruit Trees': 400,
      'Seedlings': 300,
      'Grass': 350,
      'default': 450
    };
    return requirements[crop] || requirements.default;
  }

  getMethodEfficiency(method) {
    const efficiencies = {
      'drip': 0.90,
      'sprinkler': 0.75,
      'flood': 0.50,
      'manual': 0.40,
      'pivot': 0.85
    };
    return efficiencies[method] || 0.75;
  }

  applyPriority(waterNeeded, priority) {
    switch(priority) {
      case 'water_saving':
        return waterNeeded * 0.8;
      case 'yield_max':
        return waterNeeded * 1.2;
      case 'cost_min':
        return waterNeeded * 0.9;
      default:
        return waterNeeded;
    }
  }

  calculateDuration(waterNeeded, method) {
    const flowRates = {
      'drip': 2,      // liters/minute per zone
      'sprinkler': 15,
      'flood': 50,
      'manual': 10,
      'pivot': 30
    };
    const flowRate = flowRates[method] || 10;
    return waterNeeded / flowRate; // minutes
  }

  calculateOptimalStartTime(zoneId, weatherData) {
    const now = new Date();
    const hour = now.getHours();
    
    // Avoid irrigating during hot midday
    let optimalHour;
    if (hour >= 10 && hour <= 16) {
      optimalHour = 18; // Evening
    } else if (weatherData[0]?.rainChance > 50) {
      optimalHour = 6; // Early morning if rain expected
    } else {
      optimalHour = 6; // Default early morning
    }
    
    const startTime = new Date();
    startTime.setDate(startTime.getDate() + this.getZoneOffset(zoneId));
    startTime.setHours(optimalHour, 0, 0, 0);
    
    return startTime.toISOString();
  }

  getZoneOffset(zoneId) {
    // Stagger irrigation across days
    const offsets = {
      'main_field': 0,
      'vegetable_garden': 1,
      'orchard': 0,
      'nursery': 2,
      'pasture': 1
    };
    return offsets[zoneId] || 0;
  }

  generateIrrigationSchedule(zoneCalculations, userPreferences) {
    return zoneCalculations.map(zone => ({
      zoneId: zone.zoneId,
      zoneName: zone.zoneName,
      startTime: zone.startTime,
      duration: zone.duration,
      waterAmount: zone.waterNeeded,
      method: zone.method,
      crop: zone.crop,
      efficiency: zone.efficiency,
      status: 'scheduled',
      estimatedCost: this.calculateZoneCost(zone, userPreferences)
    }));
  }

  calculateZoneCost(zone, userPreferences) {
    const waterCost = zone.waterNeeded * (userPreferences.waterPrice || 0.15) / 1000; // Convert to m3
    const energyCost = zone.duration * 0.5 * (userPreferences.energyCost || 0.15); // Pump power
    return Math.round((waterCost + energyCost) * 100) / 100;
  }

  calculateTotals(zoneCalculations, userPreferences) {
    const totals = zoneCalculations.reduce((acc, zone) => {
      acc.waterNeeded += zone.waterNeeded;
      acc.totalDuration += zone.duration;
      acc.totalArea += zone.area;
      acc.totalCost += this.calculateZoneCost(zone, userPreferences);
      return acc;
    }, { waterNeeded: 0, totalDuration: 0, totalArea: 0, totalCost: 0 });

    // Calculate water savings
    const baselineWater = zoneCalculations.reduce((acc, zone) => {
      return acc + (this.getCropWaterRequirement(zone.crop) * zone.area);
    }, 0);
    
    totals.waterSaved = Math.round((baselineWater - totals.waterNeeded) * 100) / 100;
    totals.savingsPercentage = Math.round((totals.waterSaved / baselineWater) * 100);

    return totals;
  }

  generateRecommendations(zones, sensorData, weatherData, aiRecommendation) {
    const recommendations = [];
    
    // Check soil moisture
    if (sensorData.soilMoisture < 30) {
      recommendations.push({
        type: 'warning',
        icon: '💧',
        title: 'Low Soil Moisture',
        message: `Soil moisture is ${sensorData.soilMoisture}%. Consider immediate irrigation.`,
        action: 'Start irrigation now'
      });
    }
    
    // Check weather
    if (weatherData[0]?.rainChance > 70) {
      recommendations.push({
        type: 'success',
        icon: '🌧️',
        title: 'Rain Expected',
        message: `${weatherData[0].rainChance}% chance of rain today. You can reduce irrigation.`,
        action: 'Adjust schedule for rain'
      });
    }
    
    // Add AI recommendations
    if (aiRecommendation.recommendations) {
      recommendations.push(...aiRecommendation.recommendations.map(rec => ({
        type: 'ai',
        icon: '🤖',
        title: 'AI Recommendation',
        message: rec.action,
        action: rec.expectedImpact
      })));
    }
    
    return recommendations;
  }

  async saveSchedule(farmId, schedule, preferences) {
    const IrrigationSchedule = mongoose.models.IrrigationSchedule || 
      mongoose.model('IrrigationSchedule', new mongoose.Schema({
        farmId: String,
        schedule: Array,
        preferences: Object,
        calculatedAt: Date,
        active: { type: Boolean, default: true },
        createdAt: { type: Date, default: Date.now }
      }));
    
    await IrrigationSchedule.create({
      farmId,
      schedule,
      preferences,
      calculatedAt: new Date()
    });
  }

  async sendToIoTDevice(command) {
    // This is where you'd integrate with MQTT/HTTP to your ESP32
    // For now, simulate the communication
    console.log('📡 Sending to IoT device:', {
      topic: `farm/${command.farmId}/irrigation`,
      payload: {
        zoneId: command.zoneId,
        action: 'START_PUMP',
        duration: command.duration,
        relayPin: this.getRelayPin(command.zoneId),
        timestamp: new Date().toISOString()
      }
    });
    
    // In production, you would use:
    // await mqttClient.publish(`farm/${command.farmId}/irrigation`, JSON.stringify(payload));
    
    return true;
  }

  getRelayPin(zoneId) {
    const pinMap = {
      'main_field': 12,
      'vegetable_garden': 13,
      'orchard': 14,
      'nursery': 15,
      'pasture': 16
    };
    return pinMap[zoneId] || 12;
  }

  calculateAverage(readings) {
    if (!readings || readings.length === 0) return 50;
    const sum = readings.reduce((acc, r) => acc + (r.value || 0), 0);
    return sum / readings.length;
  }

  calculateHistorySummary(history) {
    if (history.length === 0) return {};
    
    const lastWeek = history.filter(h => 
      new Date(h.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );
    
    return {
      totalIrrigations: lastWeek.length,
      totalWaterUsed: lastWeek.reduce((sum, h) => sum + (h.waterAmount || 0), 0),
      totalDuration: lastWeek.reduce((sum, h) => sum + (h.duration || 0), 0),
      averageEfficiency: 75 // This would be calculated from sensor data
    };
  }

  generateFallbackSchedule(farmId) {
    // Return a simple fallback schedule if AI fails
    return {
      schedule: [{
        zoneId: 'main_field',
        zoneName: 'Main Field',
        startTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
        duration: 30,
        waterAmount: 1000,
        method: 'drip',
        status: 'scheduled'
      }],
      recommendations: [{
        type: 'info',
        icon: 'ℹ️',
        title: 'Fallback Mode',
        message: 'Using basic irrigation schedule. AI service temporarily unavailable.',
        action: 'Retry AI optimization'
      }]
    };
  }
}

export default new IrrigationService();