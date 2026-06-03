// Minimal Service Registry
class ServiceRegistry {
  constructor() {
    this.services = new Map();
    this.healthChecks = new Map();
  }

  async registerService(name, instance, healthCheck) {
    this.services.set(name, instance);
    if (healthCheck) this.healthChecks.set(name, healthCheck);
    
    // Auto-initialize if method exists
    if (instance.initialize && typeof instance.initialize === 'function') {
      try {
        await instance.initialize();
        console.log(`✅ ${name}: Initialized`);
        return { success: true, status: 'healthy' };
      } catch (error) {
        console.log(`⚠️ ${name}: Initialization failed - ${error.message}`);
        return { success: false, status: 'unhealthy', error: error.message };
      }
    }
    return { success: true, status: 'healthy' };
  }

  async checkService(name) {
    const instance = this.services.get(name);
    const healthCheck = this.healthChecks.get(name);
    
    if (!instance) {
      return { healthy: false, error: 'Service not registered' };
    }

    try {
      if (healthCheck) {
        const result = await healthCheck();
        return { healthy: true, ...result };
      }
      
      // Default health check
      if (instance.healthCheck && typeof instance.healthCheck === 'function') {
        const result = await instance.healthCheck();
        return { healthy: true, ...result };
      }
      
      return { healthy: true, status: 'no health check defined' };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }

  async checkAllServices() {
    const results = {};
    for (const [name] of this.services) {
      results[name] = await this.checkService(name);
    }
    return results;
  }
}

export default new ServiceRegistry();
