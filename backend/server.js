// backend/server.js
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES Module fix for __dirname - Windows compatible
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// FIX: Load environment variables from ROOT folder (one level up)
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Also try current directory as fallback
if (!process.env.MONGODB_URI) {
  dotenv.config();
}

// Windows-compatible path for logs
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  //fs.mkdirSync(logDir, { recursive: true });
}

const app = express();
const port = process.env.PORT || 3003; // Use 3003 as in your .env
const isProduction = process.env.NODE_ENV === 'production';

// Log loaded environment (for debugging)
console.log(`📁 .env loaded from: ${path.join(__dirname, '..', '.env')}`);
console.log(`🔍 Checking env vars: MONGODB_URI=${!!process.env.MONGODB_URI}, MTN_API_KEY=${!!process.env.MTN_API_KEY}`);

// ==================== SECURITY MIDDLEWARE ====================
app.use(helmet({
  contentSecurityPolicy: isProduction ? {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
    }
  } : false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS Configuration
const corsOrigin = process.env.CORS_ORIGIN;
app.use(cors({
  origin: corsOrigin ? 
    (corsOrigin.includes(',') ? corsOrigin.split(',') : corsOrigin) : '*',
  credentials: process.env.CORS_CREDENTIALS === 'true',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '15') * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false
});

app.use('/api/', limiter);

// ==================== LOGGING ====================
if (isProduction) {
  const accessLogStream = fs.createWriteStream(
    path.join(logDir, 'access.log'),
    { flags: 'a' }
  );
  app.use(morgan('combined', { stream: accessLogStream }));
} else {
  app.use(morgan('dev'));
}

// ==================== REQUEST PARSING ====================
app.use(express.json({ 
  limit: process.env.MAX_REQUEST_SIZE || '10mb'
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: process.env.MAX_REQUEST_SIZE || '10mb' 
}));

// ==================== DATABASE INITIALIZATION ====================
let db = null;
let databaseInitialized = false;

const initializeDatabase = async () => {
  if (databaseInitialized) return db;
  
  try {
    // Windows-compatible path check
    const dbConfigPath = path.join(__dirname, 'config', 'database.js');
    
    // Check if file exists
    if (!fs.existsSync(dbConfigPath)) {
      console.log('⚠️ Database config not found at:', dbConfigPath);
      console.log('⚠️ Running without database');
      return null;
    }

    // Windows-compatible import - use file:// URL
    const dbConfigUrl = new URL(`file://${dbConfigPath}`).href;
    const databaseModule = await import(dbConfigUrl);
    db = databaseModule.default || databaseModule;
    
    if (db && typeof db.initializeDatabases === 'function') {
      await db.initializeDatabases();
      databaseInitialized = true;
      console.log('✅ Databases initialized successfully');
    } else {
      console.log('⚠️ Database module loaded but no initializeDatabases method');
    }
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    
    // Don't crash in production if database fails
    if (!isProduction) {
      console.log('⚠️ Running in development mode without database');
      db = null;
    } else {
      console.error('💥 Critical database error in production');
      // In production, you might want to exit
      // process.exit(1);
    }
  }
  
  return db;
};

// ==================== ROUTES ====================
const routeStatus = {
  gateway: false,
  farmers: false,
  iot: false
};

// Windows-compatible route loading
const loadRoutes = async () => {
  const routes = [
    { path: './routes/gateway.js', key: 'gateway', basePath: '/api/gateway' },
    { path: './routes/farmerRoutes.js', key: 'farmers', basePath: '/api/agritech/farmers' },
    { path: './routes/iotRoutes.js', key: 'iot', basePath: '/api/iot' }
  ];

  for (const route of routes) {
    try {
      const routePath = path.join(__dirname, route.path);
      
      // Check if route file exists
      if (!fs.existsSync(routePath)) {
        console.warn(`⚠️ ${route.key} routes file not found: ${route.path}`);
        continue;
      }

      // Windows-compatible import
      const routeUrl = new URL(`file://${routePath}`).href;
      const routeModule = await import(routeUrl);
      
      if (routeModule.default || routeModule) {
        app.use(route.basePath, routeModule.default || routeModule);
        routeStatus[route.key] = true;
        console.log(`✅ ${route.key} routes loaded`);
      }
    } catch (error) {
      console.warn(`⚠️ ${route.key} routes failed to load:`, error.message);
    }
  }
};

// ==================== HEALTH CHECK ====================
app.get('/health', async (req, res) => {
  try {
    let dbHealth = { 
      mongodb: { status: 'not_configured' }, 
      postgresql: { status: 'not_configured' }
    };
    
    if (db && typeof db.getDatabaseHealth === 'function') {
      try {
        dbHealth = await db.getDatabaseHealth();
      } catch (dbError) {
        dbHealth = {
          mongodb: { status: 'error', message: dbError.message },
          postgresql: { status: 'error', message: dbError.message }
        };
      }
    }

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: process.env.APP_NAME || 'SianAgriTech API',
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      databases: dbHealth,
      routes: routeStatus,
      features: {
        ussd: !!process.env.MTN_API_KEY,
        sms: !!process.env.AT_API_KEY,
        iot: !!process.env.THINGSPEAK_API_KEY
      },
      envLoaded: {
        mongodb: !!process.env.MONGODB_URI,
        mtn: !!process.env.MTN_API_KEY,
        at: !!process.env.AT_API_KEY,
        thingspeak: !!process.env.THINGSPEAK_API_KEY
      }
    };

    // Simple health check
    const allHealthy = true; // Assume healthy unless critical failure
    health.status = allHealthy ? 'healthy' : 'degraded';

    res.status(allHealthy ? 200 : 503).json(health);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// ==================== READINESS CHECK ====================
app.get('/ready', (req, res) => {
  const ready = databaseInitialized || process.env.REQUIRE_DB !== 'true';
  res.status(ready ? 200 : 503).json({
    ready,
    timestamp: new Date().toISOString(),
    databaseInitialized,
    routes: routeStatus
  });
});

// ==================== ROOT ENDPOINT ====================
app.get('/', (req, res) => {
  res.json({
    message: `Welcome to ${process.env.APP_NAME || 'SianAgriTech'} API`,
    description: 'Agricultural platform for small-scale farmers with IoT integration',
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    status: 'operational',
    endpoints: {
      gateway: routeStatus.gateway ? '✅ Available' : '⚠️ Disabled',
      farmers: routeStatus.farmers ? '✅ Available' : '⚠️ Disabled',
      iot: routeStatus.iot ? '✅ Available' : '⚠️ Disabled',
      system: {
        health: 'GET /health',
        readiness: 'GET /ready',
        metrics: 'GET /metrics'
      }
    },
    environment: {
      node: process.version,
      platform: process.platform,
      port: port
    }
  });
});

// ==================== METRICS ENDPOINT ====================
app.get('/metrics', (req, res) => {
  const memory = process.memoryUsage();
  res.json({
    timestamp: new Date().toISOString(),
    process: {
      uptime: Math.round(process.uptime()) + 's',
      memory: {
        rss: Math.round(memory.rss / 1024 / 1024) + 'MB',
        heapTotal: Math.round(memory.heapTotal / 1024 / 1024) + 'MB',
        heapUsed: Math.round(memory.heapUsed / 1024 / 1024) + 'MB'
      }
    },
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    env: {
      mongodb: !!process.env.MONGODB_URI,
      mtn: !!process.env.MTN_API_KEY,
      at: !!process.env.AT_API_KEY
    }
  });
});

// ==================== ERROR HANDLING ====================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    documentation: '/'
  });
});

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const isServerError = statusCode >= 500;
  
  console.error('Error:', {
    message: err.message,
    url: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  const clientMessage = isServerError && isProduction
    ? 'Internal server error'
    : err.message;

  res.status(statusCode).json({
    success: false,
    message: clientMessage,
    statusCode
  });
});

// ==================== START SERVER ====================
const startServer = async () => {
  try {
    console.log(`
    🚀 ${process.env.APP_NAME || 'SianAgriTech'} Platform
    ${'='.repeat(50)}`);
    
    console.log(`📁 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📡 Port: ${port}`);
    console.log(`🔐 MTN API: ${process.env.MTN_API_KEY ? '✅ Configured' : '❌ Not configured'}`);
    console.log(`🌍 Africa's Talking: ${process.env.AT_API_KEY ? '✅ Configured' : '❌ Not configured'}`);
    console.log(`📡 ThingSpeak IoT: ${process.env.THINGSPEAK_API_KEY ? '✅ Configured' : '❌ Not configured'}`);
    
    // Debug: Show if .env is loading
    console.log(`🔧 MONGODB_URI present: ${!!process.env.MONGODB_URI}`);
    console.log(`🔧 .env location: ${path.join(__dirname, '..', '.env')}`);
    
    // Try to initialize database (but don't crash if it fails)
    try {
      await initializeDatabase();
    } catch (dbError) {
      console.warn('⚠️ Database initialization skipped:', dbError.message);
    }
    
    // Load routes
    await loadRoutes();
    
    // Start server
    const server = app.listen(port, () => {
      console.log(`
  ✅ Server running on port ${port}
  ✅ Time: ${new Date().toLocaleString()}
  
  🎯 Available Endpoints:
  ----------------------
  - GET  /       : API Documentation
  - GET  /health : Health Check
  - GET  /ready  : Readiness Check
  - GET  /metrics: System Metrics
  
  🔌 Gateway: ${routeStatus.gateway ? '✅' : '⚠️'}
  👨‍🌾 Farmers: ${routeStatus.farmers ? '✅' : '⚠️'}
  📡 IoT: ${routeStatus.iot ? '✅' : '⚠️'}
  
  💾 Database: ${databaseInitialized ? '✅ Connected' : '⚠️ Limited Mode'}
  
  🔧 Environment Status:
  ---------------------
  - .env loaded: ${!!process.env.MONGODB_URI ? '✅' : '❌'}
  - MongoDB URI: ${process.env.MONGODB_URI ? 'Present' : 'Missing'}
  - API Keys: ${process.env.MTN_API_KEY && process.env.AT_API_KEY ? '✅' : '⚠️'}
      `);
    });

    // Simple shutdown handler
    const shutdown = () => {
      console.log('\nShutting down...');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
      
      setTimeout(() => {
        console.log('Forcing shutdown');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
};

// Export for testing
export { app };

// Start server
if (process.env.NODE_ENV !== 'test') {
  startServer();
}