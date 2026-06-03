// backend/services/healthService.js - FINAL STABLE VERSION
import mongoose from 'mongoose';

class HealthService {
  constructor() {
    this.apiHealthCache = new Map();
    this.initialized = false;
    
    console.log('🔄 Initializing health service...');
    
    // Only start monitoring if enabled
    if (process.env.FEATURE_EXTERNAL_APIS !== 'false') {
      this.startAPIMonitoring();
    } else {
      console.log('🔶 External API monitoring disabled');
    }
    
    this.initialized = true;
  }

  // Simple API monitoring
  startAPIMonitoring() {
    console.log('🔍 Starting API health monitoring');
    
    // Only check database connection
    setInterval(() => {
      this.checkDatabaseConnection().catch(console.error);
    }, 30000); // Every 30 seconds
  }

  async checkDatabaseConnection() {
    const start = Date.now();
    
    try {
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.db.command({ ping: 1 });
        const latency = Date.now() - start;
        
        this.apiHealthCache.set('mongodb', {
          name: 'MongoDB',
          status: 'connected',
          latency,
          timestamp: new Date().toISOString(),
          category: 'database'
        });
        
        return {
          status: 'connected',
          latency: `${latency}ms`
        };
      }
      
      this.apiHealthCache.set('mongodb', {
        name: 'MongoDB',
        status: 'disconnected',
        latency: 0,
        timestamp: new Date().toISOString(),
        category: 'database'
      });
      
      return {
        status: 'disconnected',
        readyState: mongoose.connection.readyState
      };
    } catch (error) {
      this.apiHealthCache.set('mongodb', {
        name: 'MongoDB',
        status: 'error',
        latency: Date.now() - start,
        error: error.message,
        timestamp: new Date().toISOString(),
        category: 'database'
      });
      
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  getActiveConnections() {
    try {
      return {
        mongodb: {
          connections: mongoose.connection.readyState === 1 ? 1 : 0,
          status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
          readyState: mongoose.connection.readyState
        },
        redis: {
          status: 'not_configured',
          message: 'Redis disabled in development'
        },
        totals: {
          connections: mongoose.connection.readyState === 1 ? 1 : 0
        }
      };
    } catch (error) {
      return {
        mongodb: { error: error.message },
        redis: { error: 'Not configured' },
        error: 'Failed to get connections'
      };
    }
  }

  async comprehensiveHealthCheck() {
    const checks = await Promise.allSettled([
      this.checkDatabaseConnection(),
      this.getSystemMetrics()
    ]);

    const results = {
      mongodb: checks[0].status === 'fulfilled' ? checks[0].value : {
        error: checks[0].reason?.message,
        status: 'error'
      },
      system: checks[1].status === 'fulfilled' ? checks[1].value : {
        error: checks[1].reason?.message,
        status: 'error'
      }
    };

    // Determine overall status
    let overallStatus = 'healthy';
    let healthScore = 100;

    if (results.mongodb.status !== 'connected') {
      overallStatus = process.env.NODE_ENV === 'production' ? 'degraded' : 'healthy';
      healthScore = process.env.NODE_ENV === 'production' ? 60 : 80;
    }

    return {
      status: overallStatus,
      score: healthScore,
      timestamp: new Date().toISOString(),
      service: 'SianAgriTech Backend',
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks: results,
      apiStatus: this.getCurrentAPIStatus()
    };
  }

  async getSystemMetrics() {
    const memory = process.memoryUsage();
    const uptime = process.uptime();
    
    return {
      memory: {
        rss: `${Math.round(memory.rss / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memory.heapTotal / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)}MB`,
        usagePercentage: `${((memory.heapUsed / memory.heapTotal) * 100).toFixed(1)}%`
      },
      process: {
        pid: process.pid,
        version: process.version,
        platform: process.platform,
        arch: process.arch,
        uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`
      },
      timestamp: new Date().toISOString()
    };
  }

  getCurrentAPIStatus() {
    const status = {};
    for (const [apiKey, record] of this.apiHealthCache.entries()) {
      status[apiKey] = {
        name: record.name,
        status: record.status,
        lastChecked: record.timestamp,
        latency: record.latency,
        category: record.category
      };
    }
    return status;
  }
}

// Export singleton
const healthService = new HealthService();
export default healthService;
export { healthService };