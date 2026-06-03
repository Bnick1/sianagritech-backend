// backend/middleware/rateLimit.js
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import redis from '../lib/redis.js';

class RateLimiter {
  constructor() {
    this.configs = {
      // API endpoints
      api: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // Limit each IP to 100 requests per windowMs
        message: {
          error: 'Too many requests, please try again later.',
          retryAfter: '15 minutes'
        },
        standardHeaders: true,
        legacyHeaders: false,
        skipSuccessfulRequests: false
      },
      
      // Authentication endpoints
      auth: {
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 5, // 5 login attempts per hour
        message: {
          error: 'Too many login attempts, please try again later.',
          retryAfter: '1 hour'
        }
      },
      
      // USSD endpoints
      ussd: {
        windowMs: 60 * 1000, // 1 minute
        max: 10, // 10 USSD requests per minute
        message: {
          error: 'Too many USSD requests, please try again later.',
          retryAfter: '1 minute'
        }
      },
      
      // SMS endpoints
      sms: {
        windowMs: 60 * 1000,
        max: 20,
        message: {
          error: 'Too many SMS requests, please try again later.',
          retryAfter: '1 minute'
        }
      },
      
      // Public endpoints (higher limits)
      public: {
        windowMs: 60 * 1000,
        max: 200,
        message: {
          error: 'Rate limit exceeded. Please slow down.',
          retryAfter: '1 minute'
        }
      }
    };

    this.stores = {};
    this.initStores();
  }

  initStores() {
    // Use Redis store if available, otherwise memory store
    if (redis.connected) {
      const redisClient = redis.client;
      
      this.stores.redis = new RedisStore({
        sendCommand: (...args) => redisClient.sendCommand(args),
        prefix: 'rate_limit:'
      });
      
      console.log('✅ Rate limiting using Redis store');
    } else {
      console.log('⚠️ Rate limiting using memory store (Redis not available)');
    }
  }

  /**
   * Create rate limiter middleware
   */
  createLimiter(type = 'api', options = {}) {
    const config = { ...this.configs[type], ...options };
    
    // Use Redis store if available
    if (this.stores.redis) {
      config.store = this.stores.redis;
    }

    const limiter = rateLimit(config);
    
    // Add custom headers
    return (req, res, next) => {
      limiter(req, res, (err) => {
        if (err) {
          // Add rate limit headers
          res.set('X-RateLimit-Limit', config.max);
          res.set('X-RateLimit-Remaining', req.rateLimit?.remaining || 0);
          res.set('X-RateLimit-Reset', new Date(Date.now() + config.windowMs).toISOString());
          
          if (config.retryAfter) {
            res.set('Retry-After', Math.ceil(config.windowMs / 1000));
          }
        }
        next(err);
      });
    };
  }

  /**
   * Dynamic rate limiting based on user tier
   */
  dynamicLimiter(req) {
    const userTier = req.user?.tier || 'free';
    const ip = req.ip;
    
    const limits = {
      free: { windowMs: 15 * 60 * 1000, max: 100 },
      basic: { windowMs: 15 * 60 * 1000, max: 1000 },
      premium: { windowMs: 15 * 60 * 1000, max: 10000 },
      enterprise: { windowMs: 15 * 60 * 1000, max: 100000 }
    };

    const limit = limits[userTier] || limits.free;
    
    return rateLimit({
      ...limit,
      keyGenerator: (req) => `${userTier}:${ip}`,
      store: this.stores.redis,
      message: {
        error: `Rate limit exceeded for ${userTier} tier.`,
        tier: userTier,
        limit: limit.max,
        window: `${limit.windowMs / 60000} minutes`
      }
    });
  }

  /**
   * Burst protection
   */
  burstProtection(windowMs = 1000, max = 10) {
    return rateLimit({
      windowMs,
      max,
      message: {
        error: 'Too many requests too quickly. Please slow down.',
        retryAfter: `${windowMs / 1000} seconds`
      },
      skipSuccessfulRequests: false,
      store: this.stores.redis
    });
  }

  /**
   * Geo-based rate limiting
   */
  geoLimiter(countryLimits = {}) {
    return (req, res, next) => {
      const country = req.headers['cf-ipcountry'] || 
                     req.headers['x-vercel-ip-country'] || 
                     'unknown';
      
      const limit = countryLimits[country] || countryLimits.default || { max: 100 };
      
      const limiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: limit.max,
        keyGenerator: (req) => `${country}:${req.ip}`,
        message: {
          error: `Rate limit exceeded for your region (${country}).`,
          country,
          limit: limit.max
        },
        store: this.stores.redis
      });

      limiter(req, res, next);
    };
  }

  /**
   * API key rate limiting
   */
  apiKeyLimiter() {
    return (req, res, next) => {
      const apiKey = req.headers['x-api-key'] || req.query.apiKey;
      
      if (!apiKey) {
        return next();
      }

      // Different limits based on API key prefix
      let limit = { max: 100 };
      
      if (apiKey.startsWith('prod_')) {
        limit = { max: 10000 };
      } else if (apiKey.startsWith('dev_')) {
        limit = { max: 1000 };
      }

      const limiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: limit.max,
        keyGenerator: () => apiKey,
        message: {
          error: 'API rate limit exceeded.',
          limit: limit.max
        },
        store: this.stores.redis
      });

      limiter(req, res, next);
    };
  }

  /**
   * Get rate limit info
   */
  async getRateLimitInfo(key) {
    if (!this.stores.redis) return null;

    try {
      const redisKey = `rate_limit:${key}`;
      const data = await redis.get(redisKey);
      
      if (data) {
        const parsed = JSON.parse(data);
        return {
          key,
          totalHits: parsed.totalHits,
          resetTime: new Date(parsed.resetTime),
          remaining: Math.max(0, parsed.limit - parsed.totalHits)
        };
      }
    } catch (error) {
      console.error('Error getting rate limit info:', error);
    }
    
    return null;
  }

  /**
   * Reset rate limit for a key
   */
  async resetRateLimit(key) {
    if (!this.stores.redis) return false;

    try {
      const redisKey = `rate_limit:${key}`;
      await redis.del(redisKey);
      return true;
    } catch (error) {
      console.error('Error resetting rate limit:', error);
      return false;
    }
  }

  /**
   * Global rate limit statistics
   */
  async getGlobalStats() {
    if (!this.stores.redis) return null;

    try {
      // Get all rate limit keys
      const keys = await redis.keys('rate_limit:*');
      const stats = {
        totalKeys: keys.length,
        byType: {},
        topBlocked: []
      };

      // Analyze each key
      for (const key of keys.slice(0, 100)) { // Limit to 100 keys
        const data = await redis.get(key);
        if (data) {
          const parsed = JSON.parse(data);
          
          // Extract type from key
          const type = key.split(':')[1] || 'unknown';
          stats.byType[type] = (stats.byType[type] || 0) + 1;
          
          // Track high usage
          if (parsed.totalHits >= parsed.limit * 0.8) {
            stats.topBlocked.push({
              key,
              hits: parsed.totalHits,
              limit: parsed.limit,
              percentage: Math.round((parsed.totalHits / parsed.limit) * 100)
            });
          }
        }
      }

      // Sort top blocked
      stats.topBlocked.sort((a, b) => b.percentage - a.percentage);

      return stats;
    } catch (error) {
      console.error('Error getting rate limit stats:', error);
      return null;
    }
  }
}

export default new RateLimiter();