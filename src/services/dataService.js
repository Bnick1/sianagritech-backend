// src/services/dataService.js
class DataService {
  constructor() {
    // Remove process.env references and use hardcoded values for Vite
    this.config = {
      readKey: 'DOGX68GA2CUP8UJ0', // Your Thingspeak read API key
      writeKey: '', // Leave empty if you don't have write key
      channelId: '2987883', // Your Thingspeak channel ID
      baseURL: 'https://api.thingspeak.com'
    };
    
    this.cacheKey = 'sian_agritech_cache';
    this.syncQueueKey = 'sian_sync_queue';
    this.offlineMode = false;
    this.lastUpdateTime = null;
    
    this.init();
  }

  async init() {
    // Check initial connection
    this.checkConnection();
    
    // Setup periodic connection checking
    setInterval(() => this.checkConnection(), 30000);
    
    // Load cached data
    this.cache = this.loadFromCache();
    this.syncQueue = this.loadSyncQueue();
    
    // Start background sync if online
    if (!this.offlineMode) {
      this.processSyncQueue();
    }
  }

  // ===== CONNECTION MANAGEMENT =====
  checkConnection() {
    this.offlineMode = !navigator.onLine;
    return !this.offlineMode;
  }

  isOnline() {
    return !this.offlineMode;
  }

  // ===== CACHE MANAGEMENT =====
  loadFromCache() {
    try {
      const cached = localStorage.getItem(this.cacheKey);
      return cached ? JSON.parse(cached) : {
        sensorData: null,
        lastUpdated: null,
        irrigationStatus: false,
        offlineData: []
      };
    } catch (error) {
      console.error('Error loading cache:', error);
      return {
        sensorData: null,
        lastUpdated: null,
        irrigationStatus: false,
        offlineData: []
      };
    }
  }

  saveToCache(data) {
    try {
      this.cache = {
        ...this.cache,
        ...data
      };
      localStorage.setItem(this.cacheKey, JSON.stringify(this.cache));
    } catch (error) {
      console.error('Error saving cache:', error);
    }
  }

  // ===== SYNC QUEUE MANAGEMENT =====
  loadSyncQueue() {
    try {
      const queue = localStorage.getItem(this.syncQueueKey);
      return queue ? JSON.parse(queue) : [];
    } catch (error) {
      console.error('Error loading sync queue:', error);
      return [];
    }
  }

  addToSyncQueue(action) {
    const queueItem = {
      ...action,
      timestamp: new Date().toISOString(),
      id: Date.now() + Math.random().toString(36).substr(2, 9)
    };
    
    this.syncQueue.push(queueItem);
    localStorage.setItem(this.syncQueueKey, JSON.stringify(this.syncQueue));
    return queueItem;
  }

  async processSyncQueue() {
    if (this.syncQueue.length === 0 || this.offlineMode) return;

    const successfulIds = [];
    
    for (const action of this.syncQueue) {
      try {
        await this.processQueuedAction(action);
        successfulIds.push(action.id);
      } catch (error) {
        console.error('Failed to sync action:', action, error);
      }
    }

    // Remove successfully synced actions
    this.syncQueue = this.syncQueue.filter(action => 
      !successfulIds.includes(action.id)
    );
    localStorage.setItem(this.syncQueueKey, JSON.stringify(this.syncQueue));
  }

  async processQueuedAction(action) {
    switch (action.type) {
      case 'irrigation_control':
        return await this.syncIrrigationToThingspeak(action.data);
      case 'sensor_data':
        return await this.writeSensorDataToThingspeak(action.data);
      default:
        console.warn('Unknown action type:', action.type);
    }
  }

  // ===== THINGSPEAK INTEGRATION =====
  async fetchSensorData() {
    if (this.offlineMode) {
      console.log('Offline mode: Returning cached sensor data');
      return this.getCachedSensorData();
    }

    try {
      const response = await fetch(
        `${this.config.baseURL}/channels/${this.config.channelId}/feeds/last.json?api_key=${this.config.readKey}`
      );

      if (!response.ok) {
        throw new Error(`Thingspeak API error: ${response.status}`);
      }

      const thingspeakData = await response.json();
      
      // Transform Thingspeak data to our format
      const transformedData = this.transformThingspeakData(thingspeakData);
      
      // Cache the data
      this.saveToCache({
        sensorData: transformedData,
        lastUpdated: new Date().toISOString()
      });

      this.lastUpdateTime = new Date();
      return transformedData;
    } catch (error) {
      console.error('Error fetching sensor data from Thingspeak:', error);
      return this.getCachedSensorData();
    }
  }

  transformThingspeakData(data) {
    // Map Thingspeak fields to your dashboard format
    return {
      temperature: {
        value: data.field1 ? parseFloat(data.field1) : 27.3,
        status: this.getTemperatureStatus(data.field1),
        trend: this.getTemperatureTrend(data.field1),
        source: `ThingSpeak Channel ${this.config.channelId}`,
        rawValue: data.field1,
        timestamp: data.created_at
      },
      humidity: {
        value: data.field2 ? parseFloat(data.field2) : 31.97,
        status: this.getHumidityStatus(data.field2),
        trend: this.getHumidityTrend(data.field2),
        source: 'Field Station #1',
        rawValue: data.field2,
        timestamp: data.created_at
      },
      soilMoisture: {
        value: data.field3 ? parseFloat(data.field3) : 47.75,
        status: this.getSoilMoistureStatus(data.field3),
        trend: '→ Stable',
        source: 'Sensor Node A-12',
        rawValue: data.field3,
        timestamp: data.created_at
      },
      lightIntensity: {
        value: data.field4 ? parseFloat(data.field4) : 350,
        status: this.getLightStatus(data.field4),
        trend: this.getLightTrend(data.field4),
        source: 'Photosynthesis Active',
        rawValue: data.field4,
        timestamp: data.created_at
      },
      rawData: data,
      timestamp: data.created_at || new Date().toISOString(),
      channelId: this.config.channelId
    };
  }

  // ===== WRITE TO THINGSPEAK =====
  async writeSensorDataToThingspeak(data) {
    if (this.offlineMode) {
      const queued = this.addToSyncQueue({
        type: 'sensor_data',
        data
      });
      return { success: false, offline: true, queuedId: queued.id };
    }

    try {
      // Only write if we have a write key
      if (!this.config.writeKey) {
        console.log('No write key configured - simulating write');
        return { success: true, message: 'Simulated write (no write key)' };
      }

      // Build query string for Thingspeak update
      const params = new URLSearchParams();
      params.append('api_key', this.config.writeKey);
      
      // Map your data to Thingspeak fields
      if (data.temperature !== undefined) params.append('field1', data.temperature);
      if (data.humidity !== undefined) params.append('field2', data.humidity);
      if (data.soilMoisture !== undefined) params.append('field3', data.soilMoisture);
      if (data.light !== undefined) params.append('field4', data.light);
      
      const response = await fetch(
        `${this.config.baseURL}/update?${params.toString()}`,
        { method: 'POST' }
      );

      if (response.ok) {
        return { success: true, message: 'Data written to Thingspeak' };
      } else {
        throw new Error(`Thingspeak write failed: ${response.status}`);
      }
    } catch (error) {
      console.error('Error writing to Thingspeak:', error);
      const queued = this.addToSyncQueue({
        type: 'sensor_data',
        data
      });
      return { success: false, offline: true, queuedId: queued.id };
    }
  }

  async syncIrrigationToThingspeak(data) {
    // Write irrigation status to Thingspeak
    const thingspeakData = {
      field5: data.state ? '1' : '0'
    };
    
    return await this.writeSensorDataToThingspeak(thingspeakData);
  }

  // ===== STATUS CALCULATIONS =====
  getTemperatureStatus(temp) {
    const value = parseFloat(temp) || 27.3;
    if (value >= 20 && value <= 30) return 'optimal';
    if (value > 30 && value <= 35) return 'warning';
    if (value > 35) return 'critical';
    if (value < 15) return 'low';
    return 'optimal';
  }

  getTemperatureTrend(temp) {
    const value = parseFloat(temp) || 27.3;
    const base = 27.3;
    const diff = value - base;
    
    if (diff > 1) return '↗️ Rising fast';
    if (diff > 0.2) return '↗️ Rising';
    if (diff < -1) return '↘️ Falling fast';
    if (diff < -0.2) return '↘️ Falling';
    return '→ Stable';
  }

  getHumidityStatus(humidity) {
    const value = parseFloat(humidity) || 31.97;
    if (value >= 40 && value <= 60) return 'optimal';
    if (value > 60 && value <= 80) return 'high';
    if (value > 80) return 'very high';
    return 'low';
  }

  getHumidityTrend(humidity) {
    const value = parseFloat(humidity) || 31.97;
    const base = 31.97;
    const diff = value - base;
    
    if (diff > 5) return '↗️ +' + diff.toFixed(1) + '%';
    if (diff < -5) return '↘️ ' + diff.toFixed(1) + '%';
    if (diff > 0) return '↗️ +' + diff.toFixed(1) + '%';
    if (diff < 0) return '↘️ ' + diff.toFixed(1) + '%';
    return '→ Stable';
  }

  getSoilMoistureStatus(moisture) {
    const value = parseFloat(moisture) || 47.75;
    if (value >= 40 && value <= 60) return 'optimal';
    if (value > 60 && value <= 80) return 'wet';
    if (value > 80) return 'very wet';
    if (value < 20) return 'very dry';
    return 'dry';
  }

  getLightStatus(light) {
    const value = parseFloat(light) || 350;
    if (value >= 200 && value <= 1000) return 'good';
    if (value < 100) return 'low';
    if (value > 1000) return 'high';
    return 'optimal';
  }

  getLightTrend(light) {
    const value = parseFloat(light) || 350;
    const hour = new Date().getHours();
    
    // Simulate daily light pattern
    if (hour >= 5 && hour < 12) return '↗️ Sunrise';
    if (hour >= 12 && hour < 16) return '☀️ Peak sun';
    if (hour >= 16 && hour < 19) return '↘️ Sunset';
    return '→ Stable';
  }

  // ===== OFFLINE DATA =====
  getCachedSensorData() {
    if (this.cache.sensorData) {
      return {
        ...this.cache.sensorData,
        offline: true,
        cached: true,
        cacheTimestamp: this.cache.lastUpdated
      };
    }

    // Return simulated data if cache is empty
    return this.getSimulatedData();
  }

  getSimulatedData() {
    const now = new Date();
    const hour = now.getHours();
    
    // Simulate daily patterns
    const tempBase = 27.3 + (hour - 12) * 0.5;
    const humidityBase = 31.97 + Math.sin(hour / 24 * Math.PI) * 10;
    const lightBase = hour >= 6 && hour <= 18 ? 350 + (hour - 12) * 50 : 50;
    
    return {
      temperature: {
        value: tempBase + (Math.random() * 2 - 1),
        status: this.getTemperatureStatus(tempBase),
        trend: hour < 12 ? '↗️ Rising' : hour < 18 ? '→ Stable' : '↘️ Falling',
        source: 'Simulated Data (Offline)',
        simulated: true
      },
      humidity: {
        value: humidityBase + (Math.random() * 5 - 2.5),
        status: this.getHumidityStatus(humidityBase),
        trend: Math.random() > 0.5 ? '↗️ +1.2%' : '↘️ -0.8%',
        source: 'Field Station #1 (Simulated)',
        simulated: true
      },
      soilMoisture: {
        value: 47.75 + (Math.random() * 10 - 5),
        status: this.getSoilMoistureStatus(47.75),
        trend: '→ Stable',
        source: 'Sensor Node A-12 (Offline)',
        simulated: true
      },
      lightIntensity: {
        value: Math.max(0, lightBase + (Math.random() * 100 - 50)),
        status: this.getLightStatus(lightBase),
        trend: hour < 12 ? '↗️ Sunrise' : hour > 18 ? '↘️ Night' : '→ Daytime',
        source: 'Photosynthesis Active (Simulated)',
        simulated: true
      },
      timestamp: now.toISOString(),
      offline: true,
      simulated: true
    };
  }

  // ===== IRRIGATION CONTROL =====
  async controlIrrigation(state) {
    const actionData = {
      state,
      timestamp: new Date().toISOString(),
      location: 'main_field',
      manual: true,
      userId: 'dashboard_user'
    };

    if (this.offlineMode) {
      const queued = this.addToSyncQueue({
        type: 'irrigation_control',
        data: actionData
      });
      
      // Update local cache immediately
      this.saveToCache({
        irrigationStatus: state
      });

      return {
        success: true,
        offline: true,
        queuedId: queued.id,
        message: 'Irrigation command queued for sync'
      };
    }

    try {
      // Send to Thingspeak
      const result = await this.syncIrrigationToThingspeak(actionData);
      
      if (result.success) {
        this.saveToCache({
          irrigationStatus: state
        });
        
        return {
          success: true,
          message: `Irrigation turned ${state ? 'ON' : 'OFF'}`
        };
      } else {
        throw new Error('Failed to write to Thingspeak');
      }
    } catch (error) {
      console.error('Irrigation control error:', error);
      
      // Queue for retry
      const queued = this.addToSyncQueue({
        type: 'irrigation_control',
        data: actionData
      });
      
      return {
        success: false,
        offline: true,
        queuedId: queued.id,
        message: 'Failed - command queued for retry'
      };
    }
  }

  // ===== DATA UTILITIES =====
  getLastUpdated() {
    return this.cache.lastUpdated || this.lastUpdateTime;
  }

  getQueueLength() {
    return this.syncQueue.length;
  }

  getConnectionStatus() {
    return {
      online: !this.offlineMode,
      lastSync: this.cache.lastUpdated,
      queuedActions: this.syncQueue.length,
      cacheAge: this.cache.lastUpdated ? 
        Math.floor((Date.now() - new Date(this.cache.lastUpdated).getTime()) / 60000) : 
        null,
      channelId: this.config.channelId
    };
  }

  clearCache() {
    localStorage.removeItem(this.cacheKey);
    localStorage.removeItem(this.syncQueueKey);
    this.cache = this.loadFromCache();
    this.syncQueue = this.loadSyncQueue();
  }

  // For testing - simulate sensor data
  async simulateSensorUpdate(data) {
    return await this.writeSensorDataToThingspeak(data);
  }
}

// Export singleton instance
const dataService = new DataService();
export default dataService;