import jwt from 'jsonwebtoken';
import Farmer from '../models/Farmer.js';

export const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if farmer exists
    const farmer = await Farmer.findById(decoded.farmerId);
    if (!farmer) {
      return res.status(401).json({
        success: false,
        message: 'Farmer not found'
      });
    }
    
    // Add farmer to request
    req.farmerId = farmer._id;
    req.farmer = farmer;
    req.universalId = decoded.universalId;
    
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
    
    res.status(500).json({
      success: false,
      message: 'Authentication failed',
      error: error.message
    });
  }
};

export const authorize = (roles = []) => {
  return async (req, res, next) => {
    try {
      const farmer = await Farmer.findById(req.farmerId);
      
      if (!farmer) {
        return res.status(404).json({
          success: false,
          message: 'Farmer not found'
        });
      }
      
      // Check if farmer has required role
      if (roles.length > 0 && !roles.includes(farmer.role)) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
      }
      
      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Authorization failed',
        error: error.message
      });
    }
  };
};

// Optional: Add rate limiting
export const rateLimit = (limit = 100, windowMs = 15 * 60 * 1000) => {
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