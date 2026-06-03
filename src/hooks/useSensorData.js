// src/hooks/useSensorData.js
import { useState, useEffect, useCallback } from 'react';
import dataService from '../services/dataService';

export const useSensorData = (refreshInterval = 30000) => {
  const [sensorData, setSensorData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [offline, setOffline] = useState(dataService.offlineMode);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await dataService.fetchSensorData();
      setSensorData(data);
      setOffline(dataService.offlineMode);
      setLastUpdate(new Date());
      
      // Process any queued actions if we're back online
      if (!dataService.offlineMode) {
        dataService.processSyncQueue();
      }
    } catch (err) {
      console.error('Error in fetchData:', err);
      setError(err.message);
      setSensorData(dataService.getCachedSensorData());
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchData();
    
    // Set up periodic refresh
    const interval = setInterval(fetchData, refreshInterval);
    
    // Listen for connection changes
    const handleOnline = () => {
      setOffline(false);
      dataService.checkConnection();
      fetchData(); // Refresh immediately when back online
    };
    
    const handleOffline = () => {
      setOffline(true);
      dataService.checkConnection();
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchData, refreshInterval]);

  const controlIrrigation = useCallback(async (state) => {
    return await dataService.controlIrrigation(state);
  }, []);

  const getConnectionStatus = useCallback(() => {
    return dataService.getConnectionStatus();
  }, []);

  const refreshNow = useCallback(() => {
    fetchData();
  }, [fetchData]);

  const getQueueLength = useCallback(() => {
    return dataService.getQueueLength();
  }, []);

  return {
    sensorData,
    loading,
    error,
    offline,
    lastUpdate,
    refresh: refreshNow,
    controlIrrigation,
    getConnectionStatus,
    getQueueLength,
    fetchData
  };
};