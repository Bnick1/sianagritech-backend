class OfflineSyncService {
  constructor() {
    this.localQueue = [];
    this.syncInProgress = false;
    this.offlineMode = false;
    this.setupNetworkDetection();
  }

  setupNetworkDetection() {
    // Check if browser environment
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleOnline());
      window.addEventListener('offline', () => this.handleOffline());
      this.offlineMode = !navigator.onLine;
    }
  }

  handleOnline() {
    this.offlineMode = false;
    console.log('🟢 Online - Starting sync');
    this.processQueue();
  }

  handleOffline() {
    this.offlineMode = true;
    console.log('🔴 Offline - Queueing operations');
  }

  async queueOperation(operation) {
    const queuedOp = {
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      operation: operation,
      timestamp: new Date(),
      status: 'pending',
      retries: 0
    };

    this.localQueue.push(queuedOp);
    
    // Store in localStorage for persistence
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('offlineQueue', JSON.stringify(this.localQueue));
    }

    // Try to process immediately if online
    if (!this.offlineMode && !this.syncInProgress) {
      await this.processQueue();
    }

    return queuedOp.id;
  }

  async processQueue() {
    if (this.syncInProgress || this.localQueue.length === 0) return;

    this.syncInProgress = true;

    try {
      const queueCopy = [...this.localQueue];
      
      for (const item of queueCopy) {
        try {
          await this.executeOperation(item.operation);
          
          // Remove from queue on success
          this.localQueue = this.localQueue.filter(op => op.id !== item.id);
          item.status = 'completed';
          
        } catch (error) {
          console.error(`Failed to sync operation ${item.id}:`, error);
          item.retries += 1;
          item.lastError = error.message;
          
          // Remove after too many retries
          if (item.retries >= 3) {
            this.localQueue = this.localQueue.filter(op => op.id !== item.id);
            item.status = 'failed';
            console.error(`Operation ${item.id} failed after 3 retries`);
          }
        }
      }

      // Update localStorage
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('offlineQueue', JSON.stringify(this.localQueue));
      }

    } finally {
      this.syncInProgress = false;
    }
  }

  async executeOperation(operation) {
    const { type, endpoint, data, method = 'POST' } = operation;
    
    switch (type) {
      case 'create_farm':
        return await this.syncCreateFarm(data);
      case 'update_farm':
        return await this.syncUpdateFarm(data);
      case 'record_harvest':
        return await this.syncRecordHarvest(data);
      case 'sensor_data':
        return await this.syncSensorData(data);
      default:
        // Generic API call
        return await this.makeApiCall(endpoint, method, data);
    }
  }

  async syncCreateFarm(farmData) {
    // Store locally first
    const localId = `local_farm_${Date.now()}`;
    const localFarm = {
      ...farmData,
      _id: localId,
      _local: true,
      _syncStatus: 'pending',
      createdAt: new Date()
    };

    // Store in local database (IndexedDB or localStorage)
    await this.storeLocal('farms', localFarm);

    // Try to sync to server
    try {
      const response = await fetch('/api/agritech/farms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(farmData)
      });

      if (response.ok) {
        const serverFarm = await response.json();
        
        // Update local record with server ID
        localFarm._id = serverFarm._id;
        localFarm._local = false;
        localFarm._syncStatus = 'synced';
        localFarm._syncedAt = new Date();
        
        await this.storeLocal('farms', localFarm);
        
        return serverFarm;
      } else {
        throw new Error(`Server responded with ${response.status}`);
      }
    } catch (error) {
      // Keep as local pending sync
      console.warn('Farm creation sync failed, keeping local:', error);
      return localFarm;
    }
  }

  async syncUpdateFarm(updateData) {
    const { farmId, updates } = updateData;
    
    // Update locally
    const localFarm = await this.getLocal('farms', farmId);
    if (localFarm) {
      Object.assign(localFarm, updates);
      localFarm._syncStatus = 'pending';
      localFarm.updatedAt = new Date();
      await this.storeLocal('farms', localFarm);
    }

    // Try to sync to server
    try {
      const response = await fetch(`/api/agritech/farms/${farmId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        const serverFarm = await response.json();
        
        // Mark as synced
        if (localFarm) {
          localFarm._syncStatus = 'synced';
          localFarm._syncedAt = new Date();
          await this.storeLocal('farms', localFarm);
        }
        
        return serverFarm;
      } else {
        throw new Error(`Update failed with ${response.status}`);
      }
    } catch (error) {
      console.warn('Farm update sync failed:', error);
      return localFarm;
    }
  }

  async syncSensorData(sensorData) {
    // Batch sensor data for efficiency
    const batch = Array.isArray(sensorData) ? sensorData : [sensorData];
    
    // Store locally
    const localSensorData = batch.map(data => ({
      ...data,
      _local: true,
      _syncStatus: 'pending',
      timestamp: new Date()
    }));

    await this.storeLocal('sensor_data', localSensorData);

    // Try to sync
    try {
      const response = await fetch('/api/agritech/sensor-data/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: batch })
      });

      if (response.ok) {
        // Mark as synced
        localSensorData.forEach(data => {
          data._syncStatus = 'synced';
          data._syncedAt = new Date();
        });
        
        await this.storeLocal('sensor_data', localSensorData);
        
        return await response.json();
      }
    } catch (error) {
      console.warn('Sensor data sync failed, keeping local');
    }
  }

  // Local storage methods
  async storeLocal(collection, data) {
    if (typeof localStorage !== 'undefined') {
      const key = `agritech_${collection}`;
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      
      if (Array.isArray(data)) {
        existing.push(...data);
      } else {
        // Update existing or add new
        const index = existing.findIndex(item => item._id === data._id);
        if (index !== -1) {
          existing[index] = data;
        } else {
          existing.push(data);
        }
      }
      
      localStorage.setItem(key, JSON.stringify(existing));
    }
  }

  async getLocal(collection, id) {
    if (typeof localStorage !== 'undefined') {
      const key = `agritech_${collection}`;
      const items = JSON.parse(localStorage.getItem(key) || '[]');
      return items.find(item => item._id === id);
    }
    return null;
  }

  async makeApiCall(endpoint, method, data) {
    const response = await fetch(endpoint, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`API call failed: ${response.status}`);
    }

    return await response.json();
  }

  // Get sync status
  getSyncStatus() {
    return {
      offline: this.offlineMode,
      queueLength: this.localQueue.length,
      inProgress: this.syncInProgress,
      pendingOperations: this.localQueue.filter(op => op.status === 'pending').length
    };
  }

  // Manual sync trigger
  async manualSync() {
    console.log('Manual sync triggered');
    await this.processQueue();
  }
}

export default new OfflineSyncService();