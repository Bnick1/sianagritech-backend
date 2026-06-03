// backend/lib/cache.js
import redis from './redis.js';

class CacheService {
  constructor() {
    this.localCache = new Map();
    this.defaultTTL = 3600; // 1 hour
    this.useRedis = process.env.REDIS_URL && redis.connected;
  }

  /**
   * Get cached value
   */
  async get(key, useLocal = true) {
    // Check local cache first
    if (useLocal) {
      const localItem = this.localCache.get(key);
      if (localItem && !this.isExpired(localItem)) {
        return localItem.value;
      }
      this.localCache.delete(key);
    }

    // Check Redis if available
    if (this.useRedis) {
      try {
        const value = await redis.get(key);
        if (value) {
          const parsed = JSON.parse(value);
          
          // Also store in local cache for faster access
          if (useLocal && parsed.ttl) {
            this.localCache.set(key, {
              value: parsed.data,
              expiresAt: Date.now() + (parsed.ttl * 1000)
            });
          }
          
          return parsed.data;
        }
      } catch (error) {
        console.error('Redis cache get error:', error.message);
      }
    }

    return null;
  }

  /**
   * Set cached value
   */
  async set(key, value, ttl = this.defaultTTL) {
    const cacheItem = {
      value,
      expiresAt: Date.now() + (ttl * 1000)
    };

    // Store in local cache
    this.localCache.set(key, cacheItem);

    // Store in Redis if available
    if (this.useRedis) {
      try {
        const redisValue = JSON.stringify({
          data: value,
          ttl,
          cachedAt: new Date().toISOString()
        });
        
        await redis.set(key, redisValue, ttl);
      } catch (error) {
        console.error('Redis cache set error:', error.message);
      }
    }

    return true;
  }

  /**
   * Delete cached value
   */
  async del(key) {
    this.localCache.delete(key);
    
    if (this.useRedis) {
      try {
        await redis.del(key);
      } catch (error) {
        console.error('Redis cache del error:', error.message);
      }
    }
    
    return true;
  }

  /**
   * Get or set cached value (cache-aside pattern)
   */
  async getOrSet(key, fetchFn, ttl = this.defaultTTL) {
    const cached = await this.get(key);
    if (cached !== null) {
      return cached;
    }

    const value = await fetchFn();
    await this.set(key, value, ttl);
    return value;
  }

  /**
   * Clear all cache
   */
  async clear() {
    this.localCache.clear();
    
    if (this.useRedis) {
      try {
        // Note: In production, use scan + del for pattern matching
        // This is a simple implementation
        await redis.del('*');
      } catch (error) {
        console.error('Redis cache clear error:', error.message);
      }
    }
    
    return true;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now();
    const localItems = Array.from(this.localCache.entries());
    
    return {
      local: {
        total: this.localCache.size,
        expired: localItems.filter(([_, item]) => this.isExpired(item)).length,
        memory: this.getMemoryUsage()
      },
      redis: {
        enabled: this.useRedis,
        connected: redis.connected
      },
      defaultTTL: this.defaultTTL
    };
  }

  /**
   * Get keys by pattern (Redis only)
   */
  async keys(pattern = '*') {
    if (!this.useRedis) {
      return Array.from(this.localCache.keys()).filter(key => 
        this.matchPattern(key, pattern)
      );
    }

    try {
      // Note: In production Redis, use SCAN instead of KEYS
      // This is a simplified version
      return await redis.keys(pattern);
    } catch (error) {
      console.error('Redis keys error:', error.message);
      return [];
    }
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidate(pattern) {
    const keys = await this.keys(pattern);
    
    for (const key of keys) {
      await this.del(key);
    }
    
    return keys.length;
  }

  /**
   * Set multiple values at once
   */
  async mset(items, ttl = this.defaultTTL) {
    for (const [key, value] of Object.entries(items)) {
      await this.set(key, value, ttl);
    }
    return true;
  }

  /**
   * Get multiple values at once
   */
  async mget(keys) {
    const results = {};
    
    for (const key of keys) {
      results[key] = await this.get(key);
    }
    
    return results;
  }

  /**
   * Increment counter
   */
  async incr(key, value = 1, ttl = this.defaultTTL) {
    const current = (await this.get(key)) || 0;
    const newValue = Number(current) + value;
    
    await this.set(key, newValue, ttl);
    return newValue;
  }

  /**
   * Decrement counter
   */
  async decr(key, value = 1, ttl = this.defaultTTL) {
    return await this.incr(key, -value, ttl);
  }

  // Helper methods
  isExpired(item) {
    return item.expiresAt < Date.now();
  }

  getMemoryUsage() {
    const used = process.memoryUsage().heapUsed;
    return `${Math.round(used / 1024 / 1024 * 100) / 100} MB`;
  }

  matchPattern(key, pattern) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
    return regex.test(key);
  }

  /**
   * Cache middleware for Express routes
   */
  middleware(ttl = 300) {
    return (req, res, next) => {
      // Skip cache for non-GET requests
      if (req.method !== 'GET') {
        return next();
      }

      // Generate cache key from request
      const cacheKey = `route:${req.originalUrl}:${JSON.stringify(req.query)}`;
      
      // Get from cache
      this.get(cacheKey).then(cached => {
        if (cached) {
          return res.json(cached);
        }

        // Store original send method
        const originalSend = res.send;
        
        // Override send method to cache response
        res.send = function(body) {
          // Only cache JSON responses
          if (res.get('Content-Type')?.includes('application/json')) {
            try {
              const data = typeof body === 'string' ? JSON.parse(body) : body;
              this.set(cacheKey, data, ttl).catch(console.error);
            } catch (error) {
              // Ignore parsing errors
            }
          }
          
          originalSend.call(this, body);
        };

        next();
      }).catch(next);
    };
  }
}

export default new CacheService();