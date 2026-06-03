// backend/services/OfflineSyncService.js
import mongoose from 'mongoose';

class OfflineSyncService {
  constructor() {
    this.localQueue = [];
    this.syncInProgress = false;
    this.offlineMode = false;
    this.syncStats = {
      successful: 0,
      failed: 0,
      pending: 0,
      lastSync: null,
      totalSynced: 0
    };
    this.setupNetworkDetection();
  }

  setupNetworkDetection() {
    // Check network connectivity periodically
    setInterval(() => {
      this.checkNetworkConnectivity();
    }, 30000);
    
    setTimeout(() => this.checkNetworkConnectivity(), 5000);
  }

  async checkNetworkConnectivity() {
    const wasOffline = this.offlineMode;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch('https://httpbin.org/get', {
        signal: controller.signal,
        method: 'HEAD'
      });
      
      clearTimeout(timeoutId);
      
      this.offlineMode = false;
      if (wasOffline) {
        console.log('🟢 Back online - network connectivity restored');
        this.onNetworkRestored();
      }
    } catch (error) {
      this.offlineMode = true;
      if (!wasOffline) {
        console.log('🔴 Offline - network connectivity lost');
      }
    }
  }

  onNetworkRestored() {
    this.processQueue().catch(console.error);
  }

  async queueOperation(operation) {
    const operationId = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const queuedOp = {
      id: operationId,
      operation: operation,
      timestamp: new Date(),
      status: 'pending',
      retries: 0,
      priority: operation.priority || 'normal'
    };

    this.localQueue.push(queuedOp);
    this.syncStats.pending++;
    
    // Store in MongoDB as backup
    if (mongoose.connection.readyState === 1) {
      try {
        const OfflineOp = mongoose.models.OfflineOperation || 
          mongoose.model('OfflineOperation', new mongoose.Schema({
            operationId: String,
            type: String,
            data: mongoose.Schema.Types.Mixed,
            status: String,
            retries: Number,
            priority: String,
            metadata: mongoose.Schema.Types.Mixed,
            createdAt: Date,
            updatedAt: Date
          }));
        
        await OfflineOp.create({
          operationId,
          type: operation.type,
          data: operation.data,
          status: 'pending',
          retries: 0,
          priority: operation.priority || 'normal',
          metadata: operation.metadata,
          createdAt: new Date()
        });
      } catch (dbErr) {
        console.warn('Failed to store offline operation:', dbErr.message);
      }
    }

    // Try to process immediately if online
    if (!this.offlineMode && !this.syncInProgress) {
      await this.processQueue();
    }

    return {
      success: true,
      operationId,
      message: 'Operation queued for sync',
      offline: this.offlineMode
    };
  }

  async processQueue() {
    if (this.syncInProgress || this.localQueue.length === 0 || this.offlineMode) {
      return;
    }

    this.syncInProgress = true;
    console.log(`🔄 Processing sync queue (${this.localQueue.length} items)`);

    try {
      // Sort by priority
      const sortedQueue = [...this.localQueue].sort((a, b) => {
        const priorityOrder = { high: 3, normal: 2, low: 1 };
        return (priorityOrder[b.priority] || 2) - (priorityOrder[a.priority] || 2);
      });

      for (const item of sortedQueue) {
        try {
          await this.executeOperation(item.operation);
          
          // Remove from queue on success
          this.localQueue = this.localQueue.filter(op => op.id !== item.id);
          this.syncStats.successful++;
          this.syncStats.pending--;
          this.syncStats.totalSynced++;
          
          // Update database record
          await this.updateOperationStatus(item.id, 'completed');
          
        } catch (error) {
          console.error(`Failed to sync operation ${item.id}:`, error);
          item.retries++;
          
          if (item.retries >= 3) {
            // Too many retries - mark as failed
            this.localQueue = this.localQueue.filter(op => op.id !== item.id);
            this.syncStats.failed++;
            this.syncStats.pending--;
            await this.updateOperationStatus(item.id, 'failed', error.message);
          }
        }
      }

      this.syncStats.lastSync = new Date();
      console.log(`✅ Sync completed. Stats:`, this.syncStats);

    } catch (error) {
      console.error('❌ Error processing sync queue:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  async executeOperation(operation) {
    const { type, data } = operation;
    
    switch (type) {
      case 'create_farm':
        return await this.syncCreateFarm(data);
      case 'sensor_data':
        return await this.syncSensorData(data);
      case 'weather_data':
        return await this.syncWeatherData(data);
      case 'crop_observation':
        return await this.syncCropObservation(data);
      default:
        throw new Error(`Unknown operation type: ${type}`);
    }
  }

  async syncCreateFarm(farmData) {
    const Farm = mongoose.models.Farm;
    if (!Farm) {
      throw new Error('Farm model not available');
    }
    
    const farm = new Farm({
      ...farmData,
      syncStatus: 'synced',
      lastSynced: new Date(),
      offlineCreated: farmData._local || false
    });
    
    return await farm.save();
  }

  async syncSensorData(sensorData) {
    const SensorReading = mongoose.models.SensorReading || 
      mongoose.model('SensorReading', new mongoose.Schema({
        sensorId: String,
        type: String,
        value: Number,
        unit: String,
        timestamp: Date,
        farmId: String,
        syncStatus: String,
        createdAt: Date
      }));
    
    const readings = Array.isArray(sensorData) ? sensorData : [sensorData];
    
    return await SensorReading.insertMany(
      readings.map(reading => ({
        ...reading,
        syncStatus: 'synced',
        createdAt: new Date()
      }))
    );
  }

  async syncWeatherData(weatherData) {
    const WeatherRecord = mongoose.models.WeatherRecord || 
      mongoose.model('WeatherRecord', new mongoose.Schema({
        farmId: String,
        temperature: Number,
        humidity: Number,
        rainfall: Number,
        recordedAt: Date,
        source: String,
        syncStatus: String,
        createdAt: Date
      }));
    
    const record = new WeatherRecord({
      ...weatherData,
      syncStatus: 'synced',
      createdAt: new Date()
    });
    
    return await record.save();
  }

  async syncCropObservation(observationData) {
    const CropObservation = mongoose.models.CropObservation;
    if (!CropObservation) {
      throw new Error('CropObservation model not available');
    }
    
    const observation = new CropObservation({
      ...observationData,
      syncStatus: 'synced',
      observedAt: observationData.observedAt || new Date()
    });
    
    return await observation.save();
  }

  async updateOperationStatus(operationId, status, error = null) {
    if (mongoose.connection.readyState === 1) {
      try {
        const OfflineOp = mongoose.models.OfflineOperation;
        if (OfflineOp) {
          await OfflineOp.findOneAndUpdate(
            { operationId },
            {
              status,
              error,
              updatedAt: new Date(),
              syncedAt: status === 'completed' ? new Date() : null
            }
          );
        }
      } catch (error) {
        console.warn('Failed to update operation status:', error.message);
      }
    }
  }

  getSyncStatus() {
    return {
      offline: this.offlineMode,
      queueLength: this.localQueue.length,
      inProgress: this.syncInProgress,
      pendingOperations: this.localQueue.filter(op => op.status === 'pending').length,
      stats: this.syncStats,
      lastUpdated: new Date().toISOString()
    };
  }

  async manualSync() {
    console.log('🔧 Manual sync triggered');
    await this.processQueue();
    
    return {
      success: true,
      message: 'Manual sync completed',
      stats: this.syncStats,
      timestamp: new Date().toISOString()
    };
  }
}

// Create singleton instance
const offlineSyncServiceInstance = new OfflineSyncService();
export default offlineSyncServiceInstance;