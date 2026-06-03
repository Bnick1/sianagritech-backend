// src/services/apiService.js
import axios from 'axios';

// Create axios instance with base URL
const api = axios.create({
  baseURL: '/api', // Will be proxied to http://localhost:3003 by Vite
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // You can add auth tokens here later
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    
    // Handle offline mode
    if (!navigator.onLine) {
      console.warn('Offline mode - queuing request');
      // Queue for later sync
      queueOfflineRequest(error.config);
    }
    
    return Promise.reject(error);
  }
);

// Offline request queue
const offlineQueue = JSON.parse(localStorage.getItem('offlineQueue') || '[]');

function queueOfflineRequest(config) {
  offlineQueue.push({
    ...config,
    timestamp: new Date().toISOString(),
    id: Date.now()
  });
  localStorage.setItem('offlineQueue', JSON.stringify(offlineQueue));
}

// ==================== FARMER API ====================
export const farmerApi = {
  // Get all farmers
  getFarmers: (page = 1, limit = 20) => 
    api.get(`/agritech/farmers?page=${page}&limit=${limit}`),
  
  // Get farmer by ID
  getFarmer: (id) => 
    api.get(`/agritech/farmers/${id}`),
  
  // Register new farmer
  registerFarmer: (farmerData) => 
    api.post('/agritech/farmers', farmerData),
  
  // Update farmer
  updateFarmer: (id, updates) => 
    api.put(`/agritech/farmers/${id}`, updates),
  
  // Search farmers
  searchFarmers: (query) => 
    api.get(`/agritech/farmers/search?q=${query}`),
  
  // Get farmer statistics
  getFarmerStats: () => 
    api.get('/agritech/farmers/stats')
};

// ==================== IOT API ====================
export const iotApi = {
  // Get sensor data
  getSensorData: (farmId, limit = 50) => 
    api.get(`/iot/sensor-data/${farmId}?limit=${limit}`),
  
  // Submit sensor data
  submitSensorData: (data) => 
    api.post('/iot/sensor-data', data),
  
  // Get farms with sensors
  getFarmsWithSensors: (district) => 
    api.get('/iot/farms' + (district ? `?district=${district}` : '')),
  
  // Register sensor
  registerSensor: (farmId, sensorData) => 
    api.post(`/iot/farms/${farmId}/sensors`, sensorData),
  
  // Get IoT health
  getIotHealth: () => 
    api.get('/iot/health')
};

// ==================== USSD/SMS API ====================
export const gatewayApi = {
  // Process USSD request
  processUssd: (ussdData) => 
    api.post('/gateway/ussd', ussdData),
  
  // Process incoming SMS
  processSms: (smsData) => 
    api.post('/gateway/sms/incoming', smsData),
  
  // Send SMS
  sendSms: (smsData) => 
    api.post('/gateway/sms/send', smsData),
  
  // Get gateway status
  getGatewayStatus: () => 
    api.get('/gateway/status')
};

// ==================== SYSTEM API ====================
export const systemApi = {
  // Health check
  getHealth: () => 
    api.get('/health'),
  
  // Readiness check
  getReadiness: () => 
    api.get('/ready'),
  
  // System metrics
  getMetrics: () => 
    api.get('/metrics'),
  
  // API documentation
  getApiInfo: () => 
    api.get('/')
};

// ==================== AUTH API (for future) ====================
export const authApi = {
  login: (credentials) => 
    api.post('/auth/login', credentials),
  
  register: (userData) => 
    api.post('/auth/register', userData),
  
  logout: () => 
    api.post('/auth/logout'),
  
  getProfile: () => 
    api.get('/auth/profile')
};

// ==================== UTILITIES ====================
export const checkConnection = async () => {
  try {
    const response = await api.get('/health');
    return {
      connected: true,
      status: response.status,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      connected: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

export const getOfflineQueue = () => offlineQueue;

export const processOfflineQueue = async () => {
  if (offlineQueue.length === 0 || !navigator.onLine) return [];

  const processed = [];
  const failed = [];

  for (const request of offlineQueue) {
    try {
      const response = await api(request);
      processed.push({ id: request.id, success: true, response });
    } catch (error) {
      failed.push({ id: request.id, success: false, error: error.message });
    }
  }

  // Remove processed requests
  const remaining = offlineQueue.filter(req => 
    !processed.find(p => p.id === req.id) && !failed.find(f => f.id === req.id)
  );
  
  localStorage.setItem('offlineQueue', JSON.stringify(remaining));

  return { processed, failed, remaining: remaining.length };
};

// Export default instance
export default api;