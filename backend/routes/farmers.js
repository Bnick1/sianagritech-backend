// backend/routes/farmers.js - WITH AUTHENTICATION & FARM MANAGEMENT
import express from 'express';
import FarmerController from '../controllers/FarmerController.js';
import AuthController from '../controllers/AuthController.js';
import authMiddleware, { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();

// Apply security middleware to all routes
router.use(authMiddleware.securityHeaders);
router.use(authMiddleware.requestLogger);

// Public routes (no authentication required)
router.post('/register', 
  authMiddleware.rateLimiters.auth,
  validate('farmerRegistration'),
  AuthController.register
);

router.post('/login', 
  authMiddleware.rateLimiters.auth,
  validate('farmerLogin'),
  AuthController.login
);

router.post('/verify-phone',
  authMiddleware.rateLimiters.auth,
  validate('phoneVerification'),
  AuthController.verifyPhone
);

router.post('/resend-verification',
  authMiddleware.rateLimiters.auth,
  AuthController.resendVerification
);

router.post('/forgot-password',
  authMiddleware.rateLimiters.auth,
  AuthController.forgotPassword
);

router.post('/reset-password',
  authMiddleware.rateLimiters.auth,
  AuthController.resetPassword
);

router.post('/refresh-token',
  AuthController.refreshToken
);

// Protected routes (authentication required)
router.use(authenticate);

// Farmer profile routes
router.get('/profile',
  FarmerController.getProfile
);

router.put('/profile',
  validate('farmerUpdate'),
  FarmerController.updateProfile
);

router.post('/change-password',
  AuthController.changePassword
);

router.post('/logout',
  AuthController.logout
);

// Farmer stats
router.get('/stats',
  FarmerController.getFarmerStats
);

// Farm management routes
router.post('/farms',
  FarmerController.addFarm
);

router.get('/farms',
  FarmerController.getFarms
);

router.get('/farms/:farmId',
  FarmerController.getFarm
);

router.put('/farms/:farmId',
  FarmerController.updateFarm
);

router.delete('/farms/:farmId',
  FarmerController.deleteFarm
);

// Crop management routes
router.post('/farms/:farmId/crops',
  FarmerController.addCrop
);

router.get('/farms/:farmId/crops',
  FarmerController.getCrops
);

router.delete('/farms/:farmId/crops/:cropId',
  FarmerController.removeCrop
);

// Harvest management
router.post('/farms/:farmId/harvest',
  FarmerController.recordHarvest
);

// Financial integration
router.post('/link-fintech',
  FarmerController.linkFintechAccount
);

router.get('/loan-eligibility',
  FarmerController.checkLoanEligibility
);

// IoT & Sensor data
router.post('/sensor-data',
  FarmerController.uploadSensorData
);

router.get('/sensor-data/:sensorId',
  FarmerController.getSensorData
);

// Offline sync
router.post('/sync',
  FarmerController.syncOfflineData
);

router.get('/sync-status',
  FarmerController.getSyncStatus
);

// Market connections
router.get('/market-prices',
  FarmerController.getMarketPrices
);

// Admin routes (protected by role)
router.get('/all',
  authorize(['admin', 'agent']),
  FarmerController.getAllFarmers
);

router.get('/admin-stats',
  authorize(['admin']),
  FarmerController.getAdminStats
);

// Apply rate limiting to all API routes
router.use(authMiddleware.rateLimiters.api);

export default router;