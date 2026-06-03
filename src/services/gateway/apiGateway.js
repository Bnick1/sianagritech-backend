// src/services/gateway/apiGateway.js
class ApiGateway {
  constructor() {
    this.baseURL = import.meta.env.VITE_API_BASE_URL || '/api';
    this.timeout = 30000;
    this.retries = 3;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'X-API-Key': import.meta.env.VITE_API_KEY,
      ...options.headers
    };

    let lastError;
    
    for (let i = 0; i < this.retries; i++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers,
          signal: AbortSignal.timeout(this.timeout)
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        // Log analytics
        this.logRequest(endpoint, 'success');
        return data;
        
      } catch (error) {
        lastError = error;
        this.logRequest(endpoint, 'error', error);
        
        if (i < this.retries - 1) {
          await this.delay(1000 * Math.pow(2, i)); // Exponential backoff
        }
      }
    }
    
    throw lastError;
  }

  async get(endpoint, params = {}) {
    const query = new URLSearchParams(params).toString();
    const url = query ? `${endpoint}?${query}` : endpoint;
    return this.request(url, { method: 'GET' });
  }

  async post(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // Health checks with circuit breaker pattern
  async healthCheck() {
    try {
      const health = await this.get('/health', {}, 5000);
      
      if (health.status === 'healthy') {
        this.markServiceHealthy();
        return health;
      }
      
      this.markServiceUnhealthy();
      throw new Error('Service unhealthy');
      
    } catch (error) {
      this.markServiceUnhealthy();
      
      // Fallback to cached data
      const cached = this.getCachedHealth();
      if (cached) {
        return { ...cached, cached: true, error: error.message };
      }
      
      throw error;
    }
  }

  logRequest(endpoint, status, error = null) {
    // Send to analytics/observability platform
    console.log(`[API Gateway] ${endpoint} - ${status}`, error ? `Error: ${error.message}` : '');
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default new ApiGateway();