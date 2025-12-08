// backend/routes/farmerRoutes.js - SIMPLIFIED WORKING VERSION
import express from 'express';
import FarmerController from '../controllers/FarmerController.js';

const router = express.Router();

// ONLY these 3 basic routes for now
router.post('/register', FarmerController.registerFarmer);
router.post('/login', FarmerController.loginFarmer);
router.post('/verify-phone', FarmerController.verifyPhone);

// Comment out ALL other routes temporarily
// They will be added back one by one as you implement them

export default router;