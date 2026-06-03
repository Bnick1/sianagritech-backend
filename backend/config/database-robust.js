// Create backend/config/database-robust.js
class RobustDatabaseService {
  constructor() {
    this.mongodbUri = process.env.MONGODB_URI;
    this.postgresConfig = {
      host: process.env.POSTGRES_HOST,
      port: process.env.POSTGRES_PORT,
      database: process.env.POSTGRES_DB,
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD
    };
    this.mongoClient = null;
    this.pgClient = null;
    this.initialized = false;
  }

  async initializeDatabases() {
    console.log('🏗️ Initializing databases...');
    
    // Initialize MongoDB
    await this.connectMongoDB();
    
    // Initialize PostgreSQL (optional)
    if (this.postgresConfig.host && this.postgresConfig.host !== '${POSTGRES_HOST}') {
      await this.connectPostgreSQL();
    }
    
    this.initialized = true;
    console.log('✅ All databases initialized');
    return true;
  }

  async connectMongoDB() {
    try {
      // Skip if no MongoDB URI
      if (!this.mongodbUri || this.mongodbUri.includes('${DB_PASSWORD}')) {
        console.log('⚠️ MongoDB: No valid connection string');
        return null;
      }
      
      console.log('🔗 Connecting to MongoDB...');
      
      // Use mongoose for MongoDB
      const mongoose = await import('mongoose');
      
      // Connection options for better error handling
      const options = {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        family: 4 // Use IPv4, skip IPv6
      };
      
      await mongoose.connect(this.mongodbUri, options);
      
      console.log('✅ MongoDB connected successfully');
      this.mongoClient = mongoose.connection;
      
      // Set up event listeners
      this.mongoClient.on('error', (err) => {
        console.error('❌ MongoDB connection error:', err.message);
      });
      
      this.mongoClient.on('disconnected', () => {
        console.log('⚠️ MongoDB disconnected');
      });
      
      return this.mongoClient;
      
    } catch (error) {
      console.warn('⚠️ MongoDB connection failed:', error.message);
      console.log('⚠️ Running without MongoDB database');
      return null;
    }
  }

  async connectPostgreSQL() {
    try {
      console.log('🔗 Connecting to PostgreSQL...');
      
      // Skip if placeholder values
      if (this.postgresConfig.host.includes('${')) {
        console.log('⚠️ PostgreSQL: Using placeholder values, skipping');
        return null;
      }
      
      const { Client } = await import('pg');
      this.pgClient = new Client(this.postgresConfig);
      
      await this.pgClient.connect();
      console.log('✅ PostgreSQL connected successfully');
      
      return this.pgClient;
      
    } catch (error) {
      console.warn('⚠️ PostgreSQL connection failed:', error.message);
      return null;
    }
  }

  async getDatabaseHealth() {
    const health = {
      mongodb: { status: 'unknown' },
      postgresql: { status: 'unknown' }
    };
    
    try {
      // Check MongoDB
      if (this.mongoClient && this.mongoClient.readyState === 1) {
        await this.mongoClient.db.command({ ping: 1 });
        health.mongodb = { status: 'healthy', message: 'Connected' };
      } else {
        health.mongodb = { status: 'unhealthy', message: 'Not connected' };
      }
    } catch (error) {
      health.mongodb = { status: 'unhealthy', message: error.message };
    }
    
    try {
      // Check PostgreSQL
      if (this.pgClient) {
        await this.pgClient.query('SELECT 1');
        health.postgresql = { status: 'healthy', message: 'Connected' };
      } else {
        health.postgresql = { status: 'not_configured', message: 'Not configured' };
      }
    } catch (error) {
      health.postgresql = { status: 'unhealthy', message: error.message };
    }
    
    return health;
  }
}

export default new RobustDatabaseService();