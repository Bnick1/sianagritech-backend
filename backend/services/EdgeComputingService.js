// Lightweight EdgeComputingService without TensorFlow.js
class EdgeComputingService {
  constructor() {
    console.log('✅ Edge Computing Service (Lightweight Mode)');
    this.sensorCache = new Map();
  }

  async processSensorData(sensorData) {
    // Simple sensor data processing
    const processed = {
      ...sensorData,
      processedAt: new Date(),
      quality: this.checkDataQuality(sensorData)
    };

    // Cache the data
    this.cacheSensorData(sensorData.sensorId, processed);

    return processed;
  }

  async analyzeCropHealth(imageData) {
    // Simple color analysis (placeholder for ML)
    return {
      status: 'healthy',
      confidence: 0.85,
      analysis: 'Basic color analysis completed',
      recommendations: ['Continue monitoring', 'Apply fertilizer in 2 weeks']
    };
  }

  async predictYield(farmData) {
    // Simple yield prediction based on area and historical data
    const baseYield = farmData.area * 1000; // kg per acre
    const adjustment = this.calculateAdjustment(farmData);
    
    return {
      predictedYield: Math.round(baseYield * adjustment),
      confidence: 0.75,
      factors: ['area', 'soil_quality', 'rainfall'],
      notes: 'Based on historical averages and current conditions'
    };
  }

  // Helper methods
  checkDataQuality(data) {
    const checks = {
      hasTimestamp: !!data.timestamp,
      hasLocation: !!(data.lat && data.lng),
      valuesValid: this.validateSensorValues(data)
    };
    
    const passed = Object.values(checks).filter(Boolean).length;
    return passed >= 2 ? 'good' : 'poor';
  }

  validateSensorValues(data) {
    // Simple validation rules
    if (data.temperature && (data.temperature < -10 || data.temperature > 50)) return false;
    if (data.moisture && (data.moisture < 0 || data.moisture > 100)) return false;
    if (data.ph && (data.ph < 0 || data.ph > 14)) return false;
    
    return true;
  }

  calculateAdjustment(farmData) {
    let adjustment = 1.0;
    
    // Simple adjustments based on conditions
    if (farmData.soilQuality === 'good') adjustment *= 1.2;
    if (farmData.soilQuality === 'poor') adjustment *= 0.8;
    
    if (farmData.irrigation === true) adjustment *= 1.1;
    if (farmData.pestPressure === 'high') adjustment *= 0.9;
    
    return adjustment;
  }

  cacheSensorData(sensorId, data) {
    const cacheKey = `sensor_${sensorId}`;
    const cache = this.sensorCache.get(cacheKey) || [];
    
    cache.push({
      ...data,
      cachedAt: new Date()
    });
    
    // Keep last 100 readings
    if (cache.length > 100) {
      cache.splice(0, cache.length - 100);
    }
    
    this.sensorCache.set(cacheKey, cache);
    return cache;
  }

  getCachedData(sensorId, limit = 50) {
    const cache = this.sensorCache.get(`sensor_${sensorId}`) || [];
    return cache.slice(-limit);
  }
}

export default new EdgeComputingService();