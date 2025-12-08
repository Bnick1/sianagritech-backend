// backend/config/database.js
import mongoose from 'mongoose';
import { Sequelize } from 'sequelize';

class DatabaseService {
  constructor() {
    this.mongoConnection = null;
    this.postgresConnection = null;
    this.retryCount = 0;
    this.maxRetries = 3;
  }

  async connectMongoDB() {
    if (this.mongoConnection) {
      return this.mongoConnection;
    }

    try {
      let mongoURI = process.env.MONGODB_URI;

      // If no MONGODB_URI in env, use default for local development
      if (!mongoURI) {
        console.warn('⚠️ MONGODB_URI not found in .env, using default');
        mongoURI = 'mongodb://localhost:27017/sianagritech';
      }

      console.log('🔗 Connecting to MongoDB...');

      const options = {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
        retryWrites: true,
        w: 'majority',
        appName: 'SianAgriTech'
      };

      const connection = await mongoose.connect(mongoURI, options);

      this.mongoConnection = connection;
      this.retryCount = 0;

      const dbInfo = connection.connection;
      console.log(`✅ MongoDB Connected:
        Host: ${dbInfo.host}
        Database: ${dbInfo.name}
        Port: ${dbInfo.port}
        State: ${dbInfo.readyState === 1 ? 'Connected' : 'Disconnected'}`);

      // Event listeners
      mongoose.connection.on('error', (err) => {
        console.error('❌ MongoDB connection error:', err.message);
      });

      mongoose.connection.on('disconnected', () => {
        console.warn('⚠️ MongoDB disconnected. Attempting to reconnect...');
        this.mongoConnection = null;
        setTimeout(() => this.connectMongoDB(), 5000);
      });

      mongoose.connection.on('reconnected', () => {
        console.log('🔄 MongoDB reconnected');
      });

      return connection;
    } catch (error) {
      console.error('❌ MongoDB connection failed:', error.message);

      // Retry logic for production
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        const delay = Math.min(1000 * Math.pow(2, this.retryCount), 10000);
        console.log(`🔄 Retry ${this.retryCount}/${this.maxRetries} in ${delay}ms...`);

        setTimeout(() => this.connectMongoDB(), delay);
      } else {
        console.error('💥 Max retries reached. Please check MongoDB configuration.');
        throw error;
      }
    }
  }

  async connectPostgreSQL() {
    if (this.postgresConnection) {
      return this.postgresConnection;
    }

    try {
      // PostgreSQL for IoT sensor data (optional for now)
      if (!process.env.POSTGRES_HOST) {
        console.log('📝 PostgreSQL: Not configured, skipping');
        return null;
      }

      console.log('🔗 Connecting to PostgreSQL...');

      const sequelize = new Sequelize(
        process.env.POSTGRES_DB,
        process.env.POSTGRES_USER,
        process.env.POSTGRES_PASSWORD,
        {
          host: process.env.POSTGRES_HOST,
          port: process.env.POSTGRES_PORT,
          dialect: 'postgres',
          logging: process.env.NODE_ENV === 'development' ? console.log : false,
          pool: {
            max: 10,
            min: 0,
            acquire: 30000,
            idle: 10000
          },
          dialectOptions: {
            ssl: process.env.NODE_ENV === 'production' ? {
              require: true,
              rejectUnauthorized: false
            } : false
          }
        }
      );

      await sequelize.authenticate();
      this.postgresConnection = sequelize;

      console.log('✅ PostgreSQL connected successfully');

      return sequelize;
    } catch (error) {
      console.warn('⚠️ PostgreSQL connection failed:', error.message);
      return null;
    }
  }

  async initializeDatabases() {
    try {
      console.log('🏗️  Initializing databases...');

      await this.connectMongoDB();
      await this.connectPostgreSQL();

      console.log('✅ All databases initialized');
      return true;
    } catch (error) {
      console.error('❌ Database initialization failed:', error.message);

      // Even if PostgreSQL fails, continue with MongoDB only
      if (this.mongoConnection) {
        console.log('⚠️ Running with MongoDB only');
        return true;
      }

      throw error;
    }
  }

  async disconnectDatabases() {
    try {
      console.log('🔌 Disconnecting databases...');

      if (this.mongoConnection) {
        await mongoose.disconnect();
        console.log('✅ MongoDB disconnected');
      }

      if (this.postgresConnection) {
        await this.postgresConnection.close();
        console.log('✅ PostgreSQL disconnected');
      }

      this.mongoConnection = null;
      this.postgresConnection = null;

      console.log('✅ All databases disconnected');
    } catch (error) {
      console.error('❌ Error disconnecting databases:', error);
    }
  }

  async getDatabaseHealth() {
    const health = {
      mongodb: { status: 'unknown', timestamp: new Date() },
      postgresql: { status: 'unknown', timestamp: new Date() }
    };

    try {
      // Check MongoDB
      if (mongoose.connection.readyState === 1) {
        health.mongodb.status = 'healthy';
        health.mongodb.ping = await mongoose.connection.db.admin().ping();
        health.mongodb.stats = await mongoose.connection.db.stats();
      } else {
        health.mongodb.status = 'disconnected';
        health.mongodb.readyState = mongoose.connection.readyState;
      }
    } catch (error) {
      health.mongodb.status = 'error';
      health.mongodb.error = error.message;
    }

    try {
      // Check PostgreSQL
      if (this.postgresConnection) {
        await this.postgresConnection.authenticate();
        health.postgresql.status = 'healthy';
      } else {
        health.postgresql.status = 'not_configured';
      }
    } catch (error) {
      health.postgresql.status = 'error';
      health.postgresql.error = error.message;
    }

    return health;
  }
}

export default new DatabaseService();