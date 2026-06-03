// ==================== ENHANCED DEBUGGING ====================
console.log('\nVERCELL ENVIRONMENT DEBUG - START');
console.log('====================================');

// Check ALL environment variables
console.log('MONGODB_URI exists:', !!process.env.MONGODB_URI);
console.log('MONGODB_URI length:', process.env.MONGODB_URI?.length);

// Mask the URI for security but show structure
if (process.env.MONGODB_URI) {
  const masked = process.env.MONGODB_URI
    .replace(/:\/\/[^:]*:[^@]*@/, '://USER:PASSWORD@')
    .replace(/@[^/]+/, '@HOST');
  console.log('MONGODB_URI structure:', masked);
  
  // Check for common issues
  console.log('Contains @:', process.env.MONGODB_URI.includes('@'));
  console.log('Contains mongodb+srv:', process.env.MONGODB_URI.includes('mongodb+srv'));
  console.log('Contains SianAgriTech:', process.env.MONGODB_URI.includes('SianAgriTech'));
}

console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('VERCEL:', process.env.VERCEL);
console.log('VERCEL_ENV:', process.env.VERCEL_ENV);
console.log('====================================\n');

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Load environment variables
dotenv.config();

// ES Module fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Express app
const app = express();

// Configuration
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || 'localhost';
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

// ==================== MONGODB CONNECTION CACHING ====================
// CRITICAL FOR VERCELL SERVERLESS
let cachedDb = null;
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 3;

async function connectToDatabase() {
  // Return cached connection if available and healthy
  if (cachedDb && cachedDb.readyState === 1) {
    console.log('Using cached MongoDB connection');
    return cachedDb;
  }

  // Clear cache if connection is in a bad state
  if (cachedDb && (cachedDb.readyState === 3 || cachedDb.readyState === 0)) {
    console.log('Clearing stale MongoDB connection');
    cachedDb = null;
  }

  // Prevent infinite reconnection loops
  if (connectionAttempts >= MAX_CONNECTION_ATTEMPTS) {
    console.warn('Max connection attempts reached, returning null');
    return null;
  }

  console.log(`Attempting MongoDB connection (attempt ${connectionAttempts + 1}/${MAX_CONNECTION_ATTEMPTS})...`);
  
  try {
    if (!process.env.MONGODB_URI) {
      console.error('MONGODB_URI not found in environment variables');
      return null;
    }

    // Log connection string (masked for security)
    const maskedUri = process.env.MONGODB_URI.replace(/:\/\/[^@]+@/, '://***@');
    console.log(`Connecting to: ${maskedUri}`);

    // Serverless-optimized MongoDB connection settings
    const connectionOptions = {
      serverSelectionTimeoutMS: 15000,      // 15 seconds timeout for server selection
      socketTimeoutMS: 30000,               // 30 seconds socket timeout
      connectTimeoutMS: 15000,              // 15 seconds connection timeout
      maxPoolSize: 1,                       // CRITICAL: 1 connection per serverless instance
      minPoolSize: 0,                       // No minimum pool size
      maxIdleTimeMS: 10000,                 // Close idle connections after 10s
      retryWrites: true,
      w: 'majority',
    };

    // Establish connection
    await mongoose.connect(process.env.MONGODB_URI, connectionOptions);
    
    // Setup connection event handlers
    mongoose.connection.on('connected', () => {
      console.log('MongoDB connected successfully');
      connectionAttempts = 0; // Reset counter on success
    });

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err.message);
      connectionAttempts++;
      cachedDb = null; // Clear cache on error
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
      cachedDb = null; // Clear cache on disconnect
    });

    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnected');
      connectionAttempts = 0;
    });

    // Test the connection with a ping
    await mongoose.connection.db.admin().ping();
    console.log('MongoDB ping successful');
    
    // Cache the connection
    cachedDb = mongoose.connection;
    connectionAttempts = 0;
    
    return cachedDb;
    
  } catch (error) {
    connectionAttempts++;
    console.error('MongoDB connection failed:', error.message);
    
    // Detailed error diagnostics
    if (error.name === 'MongoNetworkError') {
      console.error('Network Error - Check:');
      console.error('   1. MongoDB Atlas Network Access (must have 0.0.0.0/0)');
      console.error('   2. Firewall settings');
      console.error('   3. Internet connectivity from Vercel');
    } else if (error.name === 'MongooseServerSelectionError') {
      console.error('Server Selection Error - Check:');
      console.error('   1. MongoDB cluster is running');
      console.error('   2. Connection string is correct');
      console.error('   3. Database user permissions');
    } else if (error.name === 'MongoTimeoutError') {
      console.error('Timeout Error - Check:');
      console.error('   1. Network latency');
      console.error('   2. Server load');
      console.error('   3. Connection string parameters');
    }
    
    cachedDb = null;
    return null;
  }
}

// Initialize database connection on server start
connectToDatabase().catch(console.error);

// ==================== LOGGER SETUP ====================
import winston from 'winston';

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, 'logs');
try {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
} catch (error) {
  console.warn(`Cannot create logs directory: ${error.message}`);
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'sianagritech-backend' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(
          ({ timestamp, level, message, service }) => {
            return `${timestamp} [${service}] ${level}: ${message}`;
          }
        )
      )
    }),
    ...(fs.existsSync(logsDir) ? [
      new winston.transports.File({ 
        filename: path.join(logsDir, 'error.log'), 
        level: 'error' 
      }),
      new winston.transports.File({ 
        filename: path.join(logsDir, 'combined.log') 
      })
    ] : [])
  ]
});

// ==================== APPLICATION BOOT MESSAGE ====================
console.log(`
SIAN AGRITECH PLATFORM BACKEND
================================
Date: ${new Date().toLocaleString()}                           
Version: ${process.env.APP_VERSION || '1.0.0'}            
Environment: ${NODE_ENV.toUpperCase()}                    
Host: ${HOST}:${PORT}                                     
Platform: Vercel Serverless Optimized                    
Database: Connection Caching Enabled                     
================================
`);

logger.info(`Application starting in ${NODE_ENV} mode on Vercel Serverless`);

// ==================== MIDDLEWARE SETUP ====================

// Security headers
app.use(helmet({
  contentSecurityPolicy: isProduction,
  crossOriginEmbedderPolicy: isProduction,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration - Allow all origins for now
const corsOptions = {
  origin: '*',
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));
logger.info(`CORS configured for all origins`);

// Request logging
app.use(morgan(isProduction ? 'combined' : 'dev', {
  stream: {
    write: (message) => logger.http(message.trim())
  }
}));

// Body parsers
app.use(express.json({ limit: process.env.UPLOAD_MAX_SIZE || '5mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.UPLOAD_MAX_SIZE || '5mb' }));

// ==================== HEALTH SERVICE ====================
const createHealthService = () => {
  return {
    getActiveConnections: async () => {
      const db = await connectToDatabase();
      return {
        mongodb: {
          connections: db ? 1 : 0,
          status: db ? 'connected' : 'disconnected',
          readyState: db ? db.readyState : 0,
          host: process.env.MONGODB_URI ? new URL(process.env.MONGODB_URI).hostname : 'none',
          database: db ? db.db.databaseName : 'none'
        },
        totals: {
          connections: db ? 1 : 0,
          timestamp: new Date().toISOString()
        }
      };
    },
    
    comprehensiveHealthCheck: async () => {
      const db = await connectToDatabase();
      const dbStatus = db ? 'healthy' : 'unhealthy';
      const dbLatency = db ? 'connected' : 'timeout';
      const dbReadyState = db ? db.readyState : 0;
      
      return {
        status: db ? 'healthy' : 'degraded',
        score: db ? 100 : 50,
        timestamp: new Date().toISOString(),
        service: process.env.APP_NAME || 'SianAgriTech API',
        version: process.env.APP_VERSION || '1.0.0',
        environment: NODE_ENV,
        uptime: process.uptime(),
        checks: {
          mongodb: {
            status: dbStatus,
            readyState: dbReadyState,
            latency: dbLatency,
            connected: !!db,
            uriConfigured: !!process.env.MONGODB_URI,
            cached: !!cachedDb
          },
          memory: {
            rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
            heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`
          },
          system: {
            cpu: process.cpuUsage(),
            platform: process.platform,
            nodeVersion: process.version
          }
        }
      };
    }
  };
};

const healthService = createHealthService();

// ==================== ROUTES ====================

// Health endpoints
app.get('/health', async (req, res) => {
  try {
    const healthData = await healthService.comprehensiveHealthCheck();
    res.status(200).json(healthData);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(200).json({
      status: 'degraded',
      timestamp: new Date().toISOString(),
      service: process.env.APP_NAME || 'SianAgriTech API',
      message: 'API running with database issues',
      error: error.message,
      database: 'disconnected'
    });
  }
});

app.get('/health/connections', async (req, res) => {
  try {
    const connections = await healthService.getActiveConnections();
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      environment: NODE_ENV,
      connections
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/ready', async (req, res) => {
  const db = await connectToDatabase();
  res.status(200).json({
    ready: true,
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    checks: {
      mongodb: {
        ready: !!db,
        readyState: db ? db.readyState : 0
      },
      memory: process.memoryUsage().heapUsed < 500 * 1024 * 1024,
      uptime: process.uptime() > 5
    }
  });
});

// API Documentation
app.get('/', async (req, res) => {
  const db = await connectToDatabase();
  res.json({
    success: true,
    message: `Welcome to ${process.env.APP_NAME || 'SianAgriTech'} API`,
    version: process.env.APP_VERSION || '1.0.0',
    environment: NODE_ENV,
    status: db ? 'operational' : 'degraded',
    timestamp: new Date().toISOString(),
    documentation: {
      health: 'GET /health - Comprehensive health check',
      ready: 'GET /ready - Readiness probe',
      connections: 'GET /health/connections - Active connections',
      metrics: 'GET /metrics - System metrics',
      test: 'GET /test - Test endpoint',
      api: {
        farmers: {
          login: 'POST /api/farmers/login - Farmer authentication',
          register: 'POST /api/farmers/register - Farmer registration',
          profile: 'GET /api/farmers/profile - Farmer profile'
        },
        iot: {
          sensors: 'GET /api/iot/sensors - List all sensors',
          data: 'GET /api/iot/data/:sensorId - Sensor data'
        }
      }
    },
    database: db ? 'connected' : 'disconnected',
    serverTime: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())} seconds`,
    platform: 'Vercel Serverless'
  });
});

// Core endpoints
app.get('/test', async (req, res) => {
  logger.info('Test endpoint accessed');
  const db = await connectToDatabase();
  
  res.json({
    success: true,
    message: 'SianAgriTech API is working!',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    database: db ? 'Connected' : 'Disconnected',
    server: {
      host: HOST,
      port: PORT,
      uptime: `${Math.floor(process.uptime())}s`,
      platform: 'Vercel Serverless'
    }
  });
});

app.get('/metrics', async (req, res) => {
  const db = await connectToDatabase();
  const memory = process.memoryUsage();
  const heapUsedMB = Math.round(memory.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memory.heapTotal / 1024 / 1024);
  const usagePercentage = ((memory.heapUsed / memory.heapTotal) * 100).toFixed(1);
  
  res.json({
    timestamp: new Date().toISOString(),
    system: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      pid: process.pid
    },
    memory: {
      rss: `${Math.round(memory.rss / 1024 / 1024)}MB`,
      heapTotal: `${heapTotalMB}MB`,
      heapUsed: `${heapUsedMB}MB`,
      external: `${Math.round(memory.external / 1024 / 1024)}MB`,
      usagePercentage: `${usagePercentage}%`,
      status: heapUsedMB > heapTotalMB * 0.8 ? 'warning' : 'healthy'
    },
    process: {
      uptime: `${Math.floor(process.uptime())}s`,
      cpuUsage: process.cpuUsage(),
      memoryUsage: memory
    },
    database: {
      connected: !!db,
      readyState: db ? db.readyState : 0,
      cached: !!cachedDb,
      collections: db ? (await db.db.listCollections().toArray()).length : 0
    }
  });
});

// Farmer endpoints - Updated for serverless
app.get('/api/farmers/test', async (req, res) => {
  logger.info('Farmers test endpoint accessed');
  const db = await connectToDatabase();
  
  res.json({
    success: true,
    message: 'Farmers API is working',
    data: {
      farmers: [],
      total: 0,
      endpoint: '/api/farmers/test',
      timestamp: new Date().toISOString(),
      database: db ? 'connected' : 'disconnected'
    }
  });
});

app.post('/api/farmers/login', async (req, res) => {
  const { phone, password } = req.body;
  const db = await connectToDatabase();
  
  logger.info(`Login attempt for phone: ${phone}, DB: ${db ? 'connected' : 'disconnected'}`);
  
  if (!phone || !password) {
    logger.warn('Login failed: Missing credentials');
    return res.status(400).json({
      success: false,
      error: 'Phone number and password are required',
      timestamp: new Date().toISOString()
    });
  }
  
  // If DB is connected, you would query real data here
  // For now, return mock data
  const mockUser = {
    id: 'farmer_' + Date.now(),
    name: db ? 'Real Farmer' : 'Demo Farmer',
    phone: phone,
    email: 'farmer@example.com',
    farmSize: 5.5,
    location: 'Nairobi, Kenya',
    crops: ['Maize', 'Beans', 'Coffee'],
    joinedDate: new Date().toISOString(),
    database: db ? 'real' : 'mock'
  };
  
  logger.info(`Login successful for: ${phone}`);
  
  res.json({
    success: true,
    message: db ? 'Login successful (real DB)' : 'Login successful (mock mode)',
    token: `jwt_token_${Date.now()}`,
    user: mockUser,
    timestamp: new Date().toISOString(),
    expiresIn: '24h',
    database: db ? 'connected' : 'disconnected'
  });
});

app.post('/api/farmers/register', async (req, res) => {
  const { name, phone, email, password, farmSize, location } = req.body;
  const db = await connectToDatabase();
  
  logger.info(`Registration attempt: ${name} (${phone}), DB: ${db ? 'connected' : 'disconnected'}`);
  
  if (!name || !phone || !password) {
    return res.status(400).json({
      success: false,
      error: 'Name, phone, and password are required',
      timestamp: new Date().toISOString()
    });
  }
  
  // If DB is connected, you would save to real database here
  // For now, return mock response
  
  res.json({
    success: true,
    message: db ? 'Registration successful (real DB)' : 'Registration successful (mock mode)',
    user: {
      id: 'farmer_' + Date.now(),
      name,
      phone,
      email: email || null,
      farmSize: farmSize || 0,
      location: location || 'Unknown',
      status: 'active',
      createdAt: new Date().toISOString(),
      database: db ? 'real' : 'mock'
    },
    timestamp: new Date().toISOString(),
    database: db ? 'connected' : 'disconnected'
  });
});

// IoT endpoints
app.get('/api/iot/sensors', async (req, res) => {
  logger.info('IoT sensors endpoint accessed');
  const db = await connectToDatabase();
  
  const sensors = [
    { 
      id: 'temp_001', 
      type: 'temperature', 
      value: 25.5, 
      unit: '°C', 
      status: 'active',
      location: 'Field A',
      lastUpdated: new Date().toISOString(),
      battery: 85
    },
    { 
      id: 'humid_001', 
      type: 'humidity', 
      value: 65, 
      unit: '%', 
      status: 'active',
      location: 'Field A',
      lastUpdated: new Date().toISOString(),
      battery: 90
    },
    { 
      id: 'soil_001', 
      type: 'soil_moisture', 
      value: 42, 
      unit: '%', 
      status: 'active',
      location: 'Field B',
      lastUpdated: new Date().toISOString(),
      battery: 75
    },
    { 
      id: 'ph_001', 
      type: 'ph_level', 
      value: 6.5, 
      unit: 'pH', 
      status: 'active',
      location: 'Field C',
      lastUpdated: new Date().toISOString(),
      battery: 95
    }
  ];
  
  res.json({
    success: true,
    count: sensors.length,
    sensors,
    timestamp: new Date().toISOString(),
    database: db ? 'connected' : 'disconnected'
  });
});

app.get('/api/iot/data/:sensorId', async (req, res) => {
  const { sensorId } = req.params;
  const db = await connectToDatabase();
  logger.info(`IoT data requested for sensor: ${sensorId}, DB: ${db ? 'connected' : 'disconnected'}`);
  
  const data = Array.from({ length: 24 }, (_, i) => ({
    timestamp: new Date(Date.now() - (23 - i) * 3600000).toISOString(),
    value: 20 + Math.random() * 10,
    unit: '°C'
  }));
  
  res.json({
    success: true,
    sensorId,
    data,
    unit: '°C',
    timeframe: '24h',
    timestamp: new Date().toISOString(),
    database: db ? 'connected' : 'disconnected'
  });
});

// Weather endpoint
app.get('/api/weather', async (req, res) => {
  const db = await connectToDatabase();
  logger.info('Weather endpoint accessed');
  
  res.json({
    success: true,
    location: 'Nairobi, Kenya',
    temperature: 24,
    humidity: 65,
    conditions: 'Partly Cloudy',
    forecast: [
      { day: 'Today', high: 26, low: 18, condition: 'Sunny' },
      { day: 'Tomorrow', high: 25, low: 17, condition: 'Partly Cloudy' },
      { day: 'Day 3', high: 24, low: 16, condition: 'Light Rain' }
    ],
    timestamp: new Date().toISOString(),
    database: db ? 'connected' : 'disconnected'
  });
});

// Debug endpoints
app.get('/debug/mongo', async (req, res) => {
  const db = await connectToDatabase();
  const mongoURI = process.env.MONGODB_URI;
  const maskedURI = mongoURI ? mongoURI.replace(/:\/\/[^@]+@/, '://***@') : 'null';
  
  if (db) {
    res.json({
      success: true,
      connected: true,
      uriPresent: !!mongoURI,
      maskedURI,
      host: db.host,
      database: db.db.databaseName,
      readyState: db.readyState,
      cached: !!cachedDb,
      connectionAttempts
    });
  } else {
    res.json({
      success: false,
      connected: false,
      error: 'MongoDB connection failed',
      uriPresent: !!mongoURI,
      maskedURI,
      readyState: 0,
      cached: false,
      connectionAttempts
    });
  }
});

app.get('/debug/env', (req, res) => {
  const mongoURI = process.env.MONGODB_URI;
  res.json({
    hasMongoURI: !!mongoURI,
    uriStartsWith: mongoURI ? mongoURI.substring(0, 30) + '...' : 'null',
    env: process.env.NODE_ENV,
    port: process.env.PORT,
    nodeEnv: process.env.NODE_ENV,
    platform: 'Vercel Serverless'
  });
});

// ==================== ERROR HANDLING ====================

// 404 Handler
app.use((req, res) => {
  logger.warn(`404 - ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    availableEndpoints: [
      'GET  /',
      'GET  /health',
      'GET  /ready',
      'GET  /metrics',
      'GET  /test',
      'GET  /api/farmers/test',
      'POST /api/farmers/login',
      'POST /api/farmers/register',
      'GET  /api/iot/sensors',
      'GET  /api/iot/data/:sensorId',
      'GET  /api/weather',
      'GET  /debug/mongo',
      'GET  /debug/env'
    ]
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', {
    message: err.message,
    stack: err.stack,
    path: req.originalUrl,
    method: req.method
  });
  
  res.status(err.status || 500).json({
    success: false,
    error: isProduction ? 'Internal server error' : err.message,
    stack: isProduction ? undefined : err.stack,
    timestamp: new Date().toISOString(),
    path: req.originalUrl
  });
});

// ==================== START SERVER ====================
const startServer = async () => {
  logger.info('Initializing SianAgriTech Backend Server for Vercel...');
  
  console.log('\nChecking Vercel Serverless Configuration...');
  console.log(`MONGODB_URI configured: ${process.env.MONGODB_URI ? 'Yes' : 'No'}`);
  console.log(`Environment: ${NODE_ENV}`);
  console.log(`Platform: Vercel Serverless`);
  console.log(`Connection Caching: Enabled`);
  
  // Attempt initial database connection
  if (process.env.MONGODB_URI) {
    console.log('\nInitializing MongoDB connection for Vercel Serverless...');
    const db = await connectToDatabase();
    
    if (db) {
      console.log('MongoDB connected successfully for Vercel Serverless!');
      console.log(`Database: ${db.db.databaseName}`);
      console.log(`Host: ${db.host}`);
    } else {
      console.log('Running in mock mode without MongoDB connection');
      console.log('For Vercel Serverless MongoDB connection:');
      console.log('   1. Check MongoDB Atlas Network Access (0.0.0.0/0)');
      console.log('   2. Verify connection string in Vercel environment variables');
      console.log('   3. Ensure "maxPoolSize: 1" in connection options');
    }
  } else {
    console.log('MONGODB_URI not found in Vercel environment variables');
  }
  
  // In Vercel Serverless, we don't call app.listen()
  // The app is exported for Vercel to handle
  console.log(`
SIAN AGRITECH PLATFORM - VERCELL SERVERLESS
===========================================
Application configured for Vercel Serverless
Connection caching enabled
Environment: ${NODE_ENV.toUpperCase()}                    
Database: ${cachedDb ? 'CACHED' : 'NOT CONNECTED'}   
Time: ${new Date().toLocaleString()}                      

APPLICATION READY FOR VERCELL DEPLOYMENT
   `);
};

// ==================== VERCELL EXPORT ====================
// Export the app for Vercel Serverless
export default app;

// Start the server initialization
startServer().catch((error) => {
  logger.error('Failed to initialize server:', error);
  // Don't exit in serverless environment
});