// backend/middleware/auth.js
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Farmer from '../models/Farmer.js';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import crypto from 'crypto';

class AuthMiddleware {
  constructor() {
    this.JWT_SECRET = process.env.JWT_SECRET || 'sian-agritech-secret-key-change-in-production';
    this.JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';
    this.REFRESH_SECRET = process.env.REFRESH_SECRET || 'sian-agritech-refresh-secret-change-in-production';
    this.tokenBlacklist = new Set();
    this.initializeSecurity();
  }

  initializeSecurity() {
    // Security headers middleware (simplified from your existing rateLimit)
    this.securityHeaders = helmet({
      contentSecurityPolicy: false, // Disable CSP for now to avoid issues
      hsts: false // Disable HSTS for development
    });

    // Enhanced rate limiting using express-rate-limit (more reliable than custom Map)
    this.rateLimiters = {
      auth: rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5,
        message: 'Too many login attempts, please try again later',
        skipSuccessfulRequests: true,
        standardHeaders: true,
        legacyHeaders: false
      }),
      
      api: rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 100,
        message: 'Too many requests, please try again later',
        standardHeaders: true,
        legacyHeaders: false
      }),
      
      sensitive: rateLimit({
        windowMs: 60 * 60 * 1000,
        max: 10,
        message: 'Too many sensitive operations, please try again later',
        standardHeaders: true,
        legacyHeaders: false
      })
    };
  }

  // Keep your existing authenticate function but enhance it
  authenticate = async (req, res, next) => {
    try {
      // Get token from header (support both 'Authorization' and 'authorization')
      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          message: 'Access denied. No token provided.'
        });
      }

      const token = authHeader.split(' ')[1];

      // Check if token is blacklisted (logout)
      if (this.tokenBlacklist.has(token)) {
        return res.status(401).json({
          success: false,
          message: 'Token has been invalidated. Please login again.'
        });
      }

      // Verify token
      const decoded = jwt.verify(token, this.JWT_SECRET);
      
      // Check token type if exists
      if (decoded.type && decoded.type !== 'access') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token type'
        });
      }

      // Check if farmer exists
      const farmer = await Farmer.findById(decoded.farmerId || decoded.userId);
      if (!farmer) {
        return res.status(401).json({
          success: false,
          message: 'Farmer not found'
        });
      }

      // Check if account is active
      if (farmer.status !== 'active') {
        return res.status(403).json({
          success: false,
          message: 'Account is not active. Please verify your account.'
        });
      }

      // Add farmer info to request (keeping your existing structure)
      req.farmerId = farmer._id;
      req.farmer = farmer;
      req.universalId = decoded.universalId || decoded.userId;
      req.user = { // Add user object for compatibility
        id: farmer._id,
        phone: farmer.phone,
        role: farmer.role || 'farmer'
      };

      // Store token for possible logout
      req.token = token;

      next();
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token'
        });
      }
      
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expired'
        });
      }
      
      console.error('Authentication error:', error);
      res.status(500).json({
        success: false,
        message: 'Authentication failed',
        error: error.message
      });
    }
  };

  // Enhanced authorize function with role checking
  authorize = (roles = []) => {
    return async (req, res, next) => {
      try {
        if (!req.farmer) {
          return res.status(401).json({
            success: false,
            message: 'Authentication required'
          });
        }

        // Check if farmer has required role
        if (roles.length > 0) {
          const farmerRole = req.farmer.role || 'farmer';
          if (!roles.includes(farmerRole)) {
            return res.status(403).json({
              success: false,
              message: 'Insufficient permissions'
            });
          }
        }

        next();
      } catch (error) {
        console.error('Authorization error:', error);
        res.status(500).json({
          success: false,
          message: 'Authorization failed',
          error: error.message
        });
      }
    };
  };

  // Password hashing utility
  async hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
  }

  // Password verification utility
  async verifyPassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
  }

  // Token generation (enhanced from your existing token creation)
  generateToken(farmer, type = 'access') {
    const payload = {
      farmerId: farmer._id,
      universalId: farmer._id, // Keep for backward compatibility
      phone: farmer.phone,
      role: farmer.role || 'farmer',
      type: type
    };

    const secret = type === 'refresh' ? this.REFRESH_SECRET : this.JWT_SECRET;
    const expiry = type === 'refresh' ? '30d' : this.JWT_EXPIRY;

    return jwt.sign(payload, secret, { expiresIn: expiry });
  }

  // Generate refresh token
  async generateRefreshToken(farmer) {
    return this.generateToken(farmer, 'refresh');
  }

  // Refresh access token
  async refreshAccessToken(refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, this.REFRESH_SECRET);
      
      // Check if it's a refresh token
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      const farmer = await Farmer.findById(decoded.farmerId);
      if (!farmer) {
        throw new Error('Farmer not found');
      }

      const newAccessToken = this.generateToken(farmer, 'access');

      return {
        success: true,
        accessToken: newAccessToken,
        expiresIn: this.JWT_EXPIRY
      };
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  // Blacklist token (for logout)
  blacklistToken(token) {
    try {
      const decoded = jwt.decode(token);
      if (decoded && decoded.exp) {
        this.tokenBlacklist.add(token);
        
        // Schedule cleanup after token expiry
        const expiryTime = decoded.exp * 1000 - Date.now();
        if (expiryTime > 0) {
          setTimeout(() => {
            this.tokenBlacklist.delete(token);
          }, expiryTime);
        }
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  // Generate OTP for phone verification
  generateOTP(length = 6) {
    const digits = '0123456789';
    let OTP = '';
    for (let i = 0; i < length; i++) {
      OTP += digits[Math.floor(Math.random() * 10)];
    }
    return OTP;
  }

  // Generate API key
  generateApiKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  // Validate API key (optional feature)
  validateApiKey = () => {
    return async (req, res, next) => {
      const apiKey = req.headers['x-api-key'];
      
      if (!apiKey) {
        return res.status(401).json({
          success: false,
          message: 'API key required'
        });
      }

      // In production, validate against database
      // For now, just check if it's a valid format
      if (apiKey.length !== 64) {
        return res.status(401).json({
          success: false,
          message: 'Invalid API key'
        });
      }

      req.apiKey = apiKey;
      next();
    };
  };

  // Request logging middleware (enhanced)
  requestLogger = (req, res, next) => {
    const start = Date.now();
    
    // Log request start
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - Start`);
    
    // Capture the original send function
    const originalSend = res.send;
    
    res.send = function (body) {
      const duration = Date.now() - start;
      const farmerId = req.farmerId || 'anonymous';
      const status = res.statusCode;
      
      // Log the completion
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${status} (${duration}ms) - Farmer: ${farmerId}`);
      
      // Call original send
      return originalSend.call(this, body);
    };
    
    next();
  };

  // Error handler middleware
  errorHandler = (err, req, res, next) => {
    console.error('Auth Error:', err);

    if (err.name === 'UnauthorizedError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token or no token provided'
      });
    }

    if (err.name === 'ForbiddenError') {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next(err);
  };

  // Convenience methods for common role checks
  authorizeFarmer = () => {
    return this.authorize(['farmer', 'agent', 'admin']);
  };

  authorizeAdmin = () => {
    return this.authorize(['admin']);
  };

  authorizeAgent = () => {
    return this.authorize(['agent', 'admin']);
  };

  // Check if user can access specific farmer data
  canAccessFarmerData = () => {
    return async (req, res, next) => {
      try {
        const farmerId = req.params.id || req.body.farmerId;
        
        if (!req.farmer) {
          return res.status(401).json({
            success: false,
            message: 'Authentication required'
          });
        }

        // Admins can access all data
        if (req.farmer.role === 'admin') {
          return next();
        }
        
        // Agents can access farmers in their assigned region
        if (req.farmer.role === 'agent') {
          // In production, check if farmer is in agent's region
          // For now, allow access
          return next();
        }
        
        // Farmers can only access their own data
        if (req.farmer.role === 'farmer' && req.farmer._id.toString() === farmerId) {
          return next();
        }
        
        return res.status(403).json({
          success: false,
          message: 'Access denied to this resource'
        });
      } catch (error) {
        console.error('Data access check error:', error);
        next(error);
      }
    };
  };

  // CORS middleware (optional)
  corsOptions = {
    origin: function (origin, callback) {
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:3001',
        'https://sianagritech.com',
        'https://api.sianagritech.com'
      ];
      
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    optionsSuccessStatus: 200
  };

  // Simple rate limiter for compatibility (your existing implementation)
  simpleRateLimit = (limit = 100, windowMs = 15 * 60 * 1000) => {
    const requests = new Map();
    
    return (req, res, next) => {
      const ip = req.ip || req.connection.remoteAddress;
      const now = Date.now();
      
      if (!requests.has(ip)) {
        requests.set(ip, []);
      }
      
      const windowStart = now - windowMs;
      const ipRequests = requests.get(ip).filter(time => time > windowStart);
      
      if (ipRequests.length >= limit) {
        return res.status(429).json({
          success: false,
          message: 'Too many requests, please try again later'
        });
      }
      
      ipRequests.push(now);
      requests.set(ip, ipRequests);
      
      // Clean up old entries periodically
      if (Math.random() < 0.01) { // 1% chance to clean up
        for (const [key, times] of requests) {
          const validTimes = times.filter(time => time > windowStart);
          if (validTimes.length === 0) {
            requests.delete(key);
          } else {
            requests.set(key, validTimes);
          }
        }
      }
      
      next();
    };
  };
}

// Export singleton instance
const authMiddleware = new AuthMiddleware();
export default authMiddleware;

// Export individual functions for backward compatibility
export const authenticate = authMiddleware.authenticate;
export const authorize = authMiddleware.authorize;
export const simpleRateLimit = authMiddleware.simpleRateLimit;