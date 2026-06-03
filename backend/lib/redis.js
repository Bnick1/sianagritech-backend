// backend/lib/redis.js
import { createClient } from 'redis';

class RedisClient {
  constructor() {
    this.client = null;
    this.connected = false;
    this.connect();
  }

  async connect() {
    if (!process.env.REDIS_URL) {
      console.warn('⚠️ Redis URL not configured, skipping Redis initialization');
      return;
    }

    try {
      this.client = createClient({
        url: process.env.REDIS_URL,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              console.error('Max Redis reconnection attempts reached');
              return false;
            }
            return Math.min(retries * 100, 3000);
          }
        }
      });

      this.client.on('error', (err) => {
        console.error('Redis Client Error:', err);
        this.connected = false;
      });

      this.client.on('connect', () => {
        console.log('✅ Redis connected successfully');
        this.connected = true;
      });

      this.client.on('reconnecting', () => {
        console.log('🔄 Redis reconnecting...');
        this.connected = false;
      });

      await this.client.connect();
      
    } catch (error) {
      console.error('Failed to connect to Redis:', error.message);
      this.connected = false;
    }
  }

  async get(key) {
    if (!this.connected) return null;
    
    try {
      return await this.client.get(key);
    } catch (error) {
      console.error('Redis GET error:', error);
      return null;
    }
  }

  async set(key, value, ttl = 3600) {
    if (!this.connected) return false;
    
    try {
      await this.client.set(key, value, { EX: ttl });
      return true;
    } catch (error) {
      console.error('Redis SET error:', error);
      return false;
    }
  }

  async del(key) {
    if (!this.connected) return false;
    
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error('Redis DEL error:', error);
      return false;
    }
  }

  async hSet(key, field, value) {
    if (!this.connected) return false;
    
    try {
      await this.client.hSet(key, field, value);
      return true;
    } catch (error) {
      console.error('Redis HSET error:', error);
      return false;
    }
  }

  async hGet(key, field) {
    if (!this.connected) return null;
    
    try {
      return await this.client.hGet(key, field);
    } catch (error) {
      console.error('Redis HGET error:', error);
      return null;
    }
  }

  async publish(channel, message) {
    if (!this.connected) return false;
    
    try {
      await this.client.publish(channel, JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('Redis PUBLISH error:', error);
      return false;
    }
  }

  async disconnect() {
    if (this.client && this.connected) {
      await this.client.quit();
      this.connected = false;
      console.log('Redis disconnected');
    }
  }
}

export default new RedisClient();