import Farmer from '../models/Farmer.js';
import Farm from '../models/Farm.js';
import UniversalIdentity from '../models/UniversalIdentity.js';
import OfflineSyncService from '../services/OfflineSyncService.js';
import EdgeComputingService from '../services/EdgeComputingService.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

class FarmerController {
  // ==================== REGISTRATION & AUTH ====================
  
  async registerFarmer(req, res) {
    try {
      const { phone, name, district, village, farmSize } = req.body;
      
      // Check if farmer already exists
      const existingFarmer = await Farmer.findOne({ phone });
      if (existingFarmer) {
        return res.status(400).json({
          success: false,
          message: 'Farmer already registered'
        });
      }
      
      // Check/create universal identity
      let universalId;
      const existingIdentity = await UniversalIdentity.findOne({ primaryPhone: phone });
      
      if (existingIdentity) {
        universalId = existingIdentity.universalId;
        // Enroll in agritech service
        await existingIdentity.enrollInService('agritech', null);
      } else {
        // Create new universal identity
        const identity = new UniversalIdentity({
          primaryPhone: phone,
          kycStatus: 'pending'
        });
        await identity.save();
        universalId = identity.universalId;
      }
      
      // Create farmer
      const farmer = new Farmer({
        universalId,
        phone,
        name,
        farmSize,
        location: {
          district,
          village
        },
        status: 'active'
      });
      
      await farmer.save();
      
      // Update identity with farmer ID
      await UniversalIdentity.findOneAndUpdate(
        { universalId },
        { $set: { 'services.agritech.profileId': farmer._id.toString() } }
      );
      
      // Generate token
      const token = jwt.sign(
        { farmerId: farmer._id, universalId },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );
      
      res.status(201).json({
        success: true,
        message: 'Farmer registered successfully',
        data: {
          farmer: {
            id: farmer._id,
            universalId,
            phone: farmer.phone,
            name: farmer.name
          },
          token
        }
      });
      
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Registration failed',
        error: error.message
      });
    }
  }
  
  async loginFarmer(req, res) {
    try {
      const { phone, deviceId } = req.body;
      
      const farmer = await Farmer.findOne({ phone });
      if (!farmer) {
        return res.status(404).json({
          success: false,
          message: 'Farmer not found'
        });
      }
      
      // Update device ID for offline sync
      if (deviceId) {
        farmer.deviceId = deviceId;
        await farmer.save();
      }
      
      // Generate token
      const token = jwt.sign(
        { farmerId: farmer._id, universalId: farmer.universalId },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );
      
      // Check for pending sync
      const syncStatus = OfflineSyncService.getSyncStatus();
      
      res.json({
        success: true,
        data: {
          farmer: {
            id: farmer._id,
            universalId: farmer.universalId,
            phone: farmer.phone,
            name: farmer.name
          },
          token,
          syncStatus
        }
      });
      
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Login failed',
        error: error.message
      });
    }
  }
  
  async verifyPhone(req, res) {
    try {
      const { phone } = req.body;
      
      const identity = await UniversalIdentity.findOne({ primaryPhone: phone });
      const farmer = await Farmer.findOne({ phone });
      
      res.json({
        success: true,
        data: {
          exists: !!identity,
          registeredAsFarmer: !!farmer,
          universalId: identity?.universalId,
          kycStatus: identity?.kycStatus
        }
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Verification failed',
        error: error.message
      });
    }
  }
  
  // ==================== PROFILE MANAGEMENT ====================
  
  async getProfile(req, res) {
    try {
      const farmer = await Farmer.findById(req.farmerId)
        .select('-__v')
        .populate('farms', 'name size location currentCrop');
      
      if (!farmer) {
        return res.status(404).json({
          success: false,
          message: 'Farmer not found'
        });
      }
      
      // Get identity info
      const identity = await UniversalIdentity.findOne({ universalId: farmer.universalId });
      
      res.json({
        success: true,
        data: {
          farmer,
          identity: {
            universalId: identity?.universalId,
            kycStatus: identity?.kycStatus,
            services: identity?.services
          }
        }
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch profile',
        error: error.message
      });
    }
  }
  
  async updateProfile(req, res) {
    try {
      const updates = req.body;
      const farmer = await Farmer.findByIdAndUpdate(
        req.farmerId,
        { $set: updates },
        { new: true, runValidators: true }
      );
      
      // Queue offline sync if needed
      if (OfflineSyncService.offlineMode) {
        await OfflineSyncService.queueOperation({
          type: 'update_farmer',
          data: {
            farmerId: farmer._id,
            updates
          }
        });
      }
      
      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: { farmer }
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Update failed',
        error: error.message
      });
    }
  }
  
  async getFarmerStats(req, res) {
    try {
      const farmer = await Farmer.findById(req.farmerId);
      const farms = await Farm.find({ farmerId: req.farmerId });
      
      const stats = {
        totalFarms: farms.length,
        totalArea: farms.reduce((sum, farm) => sum + (farm.size || 0), 0),
        activeCrops: farms.filter(farm => farm.currentCrop).length,
        totalYield: farms.reduce((sum, farm) => {
          const history = farm.productionHistory || [];
          return sum + history.reduce((s, season) => s + (season.yield || 0), 0);
        }, 0),
        totalRevenue: farms.reduce((sum, farm) => {
          const history = farm.productionHistory || [];
          return sum + history.reduce((s, season) => s + (season.revenue || 0), 0);
        }, 0)
      };
      
      res.json({
        success: true,
        data: stats
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get stats',
        error: error.message
      });
    }
  }
  
  // ==================== FARM MANAGEMENT ====================
  
  async addFarm(req, res) {
    try {
      const farmData = {
        ...req.body,
        farmerId: req.farmerId
      };
      
      let farm;
      
      if (OfflineSyncService.offlineMode) {
        // Queue for offline sync
        const operationId = await OfflineSyncService.queueOperation({
          type: 'create_farm',
          data: farmData
        });
        
        farm = {
          ...farmData,
          _id: operationId,
          _local: true,
          _syncStatus: 'pending'
        };
      } else {
        // Create directly
        farm = new Farm(farmData);
        await farm.save();
        
        // Update farmer's farm list
        await Farmer.findByIdAndUpdate(req.farmerId, {
          $addToSet: { farms: farm._id }
        });
      }
      
      res.status(201).json({
        success: true,
        message: 'Farm added successfully',
        data: { farm }
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to add farm',
        error: error.message
      });
    }
  }
  
  async getFarms(req, res) {
    try {
      const farms = await Farm.find({ farmerId: req.farmerId })
        .sort({ createdAt: -1 });
      
      // Process any local farms from offline queue
      let localFarms = [];
      if (typeof localStorage !== 'undefined') {
        const localData = JSON.parse(localStorage.getItem('agritech_farms') || '[]');
        localFarms = localData.filter(farm => farm._local && farm.farmerId === req.farmerId);
      }
      
      res.json({
        success: true,
        data: {
          serverFarms: farms,
          localFarms: localFarms,
          total: farms.length + localFarms.length
        }
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch farms',
        error: error.message
      });
    }
  }
  
  async getFarm(req, res) {
    try {
      const { farmId } = req.params;
      
      let farm;
      
      // Check if it's a local ID (starts with 'local_')
      if (farmId.startsWith('local_')) {
        if (typeof localStorage !== 'undefined') {
          const localFarms = JSON.parse(localStorage.getItem('agritech_farms') || '[]');
          farm = localFarms.find(f => f._id === farmId);
        }
      } else {
        farm = await Farm.findOne({ _id: farmId, farmerId: req.farmerId });
      }
      
      if (!farm) {
        return res.status(404).json({
          success: false,
          message: 'Farm not found'
        });
      }
      
      // Get crop health analysis if available
      let cropHealth = null;
      if (farm.currentCrop) {
        try {
          cropHealth = await EdgeComputingService.analyzeCropHealth(farm.currentCrop);
        } catch (error) {
          console.warn('Crop health analysis failed:', error);
        }
      }
      
      res.json({
        success: true,
        data: {
          farm,
          analytics: {
            cropHealth,
            yieldPrediction: farm.currentCrop ? 
              await EdgeComputingService.predictYield({
                area: farm.size,
                cropType: farm.currentCrop.cropType,
                ...farm.location
              }) : null
          }
        }
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch farm',
        error: error.message
      });
    }
  }
  
  // Add this method anywhere in your FarmerController class
async removeCrop(req, res) {
  try {
    const { farmId, cropId } = req.params;
    
    res.json({
      success: true,
      message: 'Crop removal endpoint - to be implemented',
      farmId,
      cropId
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to remove crop',
      error: error.message
    });
  }
}
  async updateFarm(req, res) {
    try {
      const { farmId } = req.params;
      const updates = req.body;
      
      let farm;
      
      if (farmId.startsWith('local_')) {
        // Update local farm
        if (typeof localStorage !== 'undefined') {
          const localFarms = JSON.parse(localStorage.getItem('agritech_farms') || '[]');
          const farmIndex = localFarms.findIndex(f => f._id === farmId);
          
          if (farmIndex !== -1) {
            localFarms[farmIndex] = { ...localFarms[farmIndex], ...updates, updatedAt: new Date() };
            localStorage.setItem('agritech_farms', JSON.stringify(localFarms));
            farm = localFarms[farmIndex];
          }
        }
      } else {
        // Update server farm
        farm = await Farm.findOneAndUpdate(
          { _id: farmId, farmerId: req.farmerId },
          { $set: updates },
          { new: true, runValidators: true }
        );
      }
      
      if (!farm) {
        return res.status(404).json({
          success: false,
          message: 'Farm not found'
        });
      }
      
      // Queue for offline sync if needed
      if (OfflineSyncService.offlineMode && !farmId.startsWith('local_')) {
        await OfflineSyncService.queueOperation({
          type: 'update_farm',
          data: { farmId, updates }
        });
      }
      
      res.json({
        success: true,
        message: 'Farm updated successfully',
        data: { farm }
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to update farm',
        error: error.message
      });
    }
  }
  
  async deleteFarm(req, res) {
    try {
      const { farmId } = req.params;
      
      if (farmId.startsWith('local_')) {
        // Remove local farm
        if (typeof localStorage !== 'undefined') {
          const localFarms = JSON.parse(localStorage.getItem('agritech_farms') || '[]');
          const updatedFarms = localFarms.filter(f => f._id !== farmId);
          localStorage.setItem('agritech_farms', JSON.stringify(updatedFarms));
        }
      } else {
        // Delete server farm
        await Farm.findOneAndDelete({ _id: farmId, farmerId: req.farmerId });
        
        // Remove from farmer's list
        await Farmer.findByIdAndUpdate(req.farmerId, {
          $pull: { farms: farmId }
        });
      }
      
      res.json({
        success: true,
        message: 'Farm deleted successfully'
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to delete farm',
        error: error.message
      });
    }
  }
  
  // ==================== CROP MANAGEMENT ====================
  
  async addCrop(req, res) {
    try {
      const { farmId } = req.params;
      const cropData = req.body;
      
      const farm = await Farm.findOne({ _id: farmId, farmerId: req.farmerId });
      if (!farm) {
        return res.status(404).json({
          success: false,
          message: 'Farm not found'
        });
      }
      
      // Add crop
      if (!farm.crops) farm.crops = [];
      farm.crops.push(cropData);
      
      // Set as current crop if first one
      if (!farm.currentCrop) {
        farm.currentCrop = cropData;
      }
      
      await farm.save();
      
      res.status(201).json({
        success: true,
        message: 'Crop added successfully',
        data: { crop: cropData }
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to add crop',
        error: error.message
      });
    }
  }
  
  async getCrops(req, res) {
    try {
      const { farmId } = req.params;
      
      const farm = await Farm.findOne({ _id: farmId, farmerId: req.farmerId });
      if (!farm) {
        return res.status(404).json({
          success: false,
          message: 'Farm not found'
        });
      }
      
      res.json({
        success: true,
        data: {
          crops: farm.crops || [],
          currentCrop: farm.currentCrop
        }
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch crops',
        error: error.message
      });
    }
  }
  
  // ==================== HARVEST MANAGEMENT ====================
  
  async recordHarvest(req, res) {
    try {
      const { farmId } = req.params;
      const harvestData = req.body;
      
      const farm = await Farm.findOne({ _id: farmId, farmerId: req.farmerId });
      if (!farm) {
        return res.status(404).json({
          success: false,
          message: 'Farm not found'
        });
      }
      
      // Add to production history
      if (!farm.productionHistory) farm.productionHistory = [];
      farm.productionHistory.push({
        ...harvestData,
        recordedAt: new Date()
      });
      
      // Clear current crop if this is the harvest
      if (farm.currentCrop && farm.currentCrop.cropId === harvestData.cropId) {
        farm.currentCrop = null;
      }
      
      await farm.save();
      
      // Queue for offline sync if needed
      if (OfflineSyncService.offlineMode) {
        await OfflineSyncService.queueOperation({
          type: 'record_harvest',
          data: { farmId, harvestData }
        });
      }
      
      res.status(201).json({
        success: true,
        message: 'Harvest recorded successfully',
        data: { harvest: harvestData }
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to record harvest',
        error: error.message
      });
    }
  }
  
  // ==================== FINANCIAL INTEGRATION ====================
  
  async linkFintechAccount(req, res) {
    try {
      const { universalId } = req.body;
      
      const farmer = await Farmer.findById(req.farmerId);
      if (!farmer) {
        return res.status(404).json({
          success: false,
          message: 'Farmer not found'
        });
      }
      
      // Verify universal ID matches
      if (farmer.universalId !== universalId) {
        return res.status(400).json({
          success: false,
          message: 'Universal ID does not match'
        });
      }
      
      // Update farmer record
      farmer.fintechLinked = true;
      await farmer.save();
      
      // Update identity service
      await UniversalIdentity.findOneAndUpdate(
        { universalId },
        { $set: { 'services.fintech.enrolled': true } }
      );
      
      res.json({
        success: true,
        message: 'FinTech account linked successfully',
        data: { fintechLinked: true }
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to link FinTech account',
        error: error.message
      });
    }
  }
  
  async checkLoanEligibility(req, res) {
    try {
      const farmer = await Farmer.findById(req.farmerId);
      if (!farmer) {
        return res.status(404).json({
          success: false,
          message: 'Farmer not found'
        });
      }
      
      // Get farm data for assessment
      const farms = await Farm.find({ farmerId: req.farmerId });
      
      // Calculate eligibility based on:
      // 1. Farm size and productivity
      // 2. Harvest history
      // 3. Current crop status
      
      const totalArea = farms.reduce((sum, farm) => sum + (farm.size || 0), 0);
      const avgYield = farms.length > 0 ? 
        farms.reduce((sum, farm) => {
          const history = farm.productionHistory || [];
          const farmYield = history.reduce((s, season) => s + (season.yield || 0), 0);
          return sum + (farmYield / history.length || 0);
        }, 0) / farms.length : 0;
      
      // Simple eligibility calculation
      const eligibilityScore = Math.min(
        (totalArea * 10) + (avgYield * 0.1),
        100
      );
      
      const eligible = eligibilityScore >= 30;
      
      res.json({
        success: true,
        data: {
          eligible,
          eligibilityScore: Math.round(eligibilityScore),
          factors: {
            farmCount: farms.length,
            totalArea,
            averageYield: Math.round(avgYield),
            hasActiveCrops: farms.some(farm => farm.currentCrop)
          },
          recommendedLoan: eligible ? totalArea * 500000 : 0, // 500,000 UGX per acre
          message: eligible ? 
            'Eligible for agricultural loan' : 
            'Need more farming history or larger farm size'
        }
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to check loan eligibility',
        error: error.message
      });
    }
  }
  
  // ==================== IOT & SENSOR DATA ====================
  
  async uploadSensorData(req, res) {
    try {
      const sensorData = req.body;
      
      // Process with edge computing
      const processedData = await EdgeComputingService.processSensorData(sensorData);
      
      // Store in cache
      EdgeComputingService.cacheSensorData(sensorData.sensorId, processedData);
      
      // Queue for cloud sync if needed
      if (OfflineSyncService.offlineMode) {
        await OfflineSyncService.queueOperation({
          type: 'sensor_data',
          data: processedData
        });
      }
      
      res.status(201).json({
        success: true,
        message: 'Sensor data processed and stored',
        data: { 
          processedData,
          storedLocally: OfflineSyncService.offlineMode
        }
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to process sensor data',
        error: error.message
      });
    }
  }
  
  async getSensorData(req, res) {
    try {
      const { sensorId } = req.params;
      const { limit = 50 } = req.query;
      
      const cachedData = EdgeComputingService.getCachedSensorData(sensorId, parseInt(limit));
      
      res.json({
        success: true,
        data: {
          sensorId,
          readings: cachedData,
          count: cachedData.length,
          lastReading: cachedData.length > 0 ? cachedData[cachedData.length - 1].timestamp : null
        }
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch sensor data',
        error: error.message
      });
    }
  }
  
  // ==================== OFFLINE SYNC ====================
  
  async syncOfflineData(req, res) {
    try {
      await OfflineSyncService.manualSync();
      const status = OfflineSyncService.getSyncStatus();
      
      res.json({
        success: true,
        message: 'Sync completed',
        data: { status }
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Sync failed',
        error: error.message
      });
    }
  }
  
  async getSyncStatus(req, res) {
    try {
      const status = OfflineSyncService.getSyncStatus();
      
      res.json({
        success: true,
        data: { status }
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get sync status',
        error: error.message
      });
    }
  }
  
  // ==================== MARKET CONNECTIONS ====================
  
  async getMarketPrices(req, res) {
    try {
      const farmer = await Farmer.findById(req.farmerId);
      
      // This would connect to external market API
      // For now, return mock data
      const mockPrices = [
        { crop: 'Maize', price: 1200, unit: 'kg', market: 'Kampala', date: new Date() },
        { crop: 'Beans', price: 3500, unit: 'kg', market: 'Jinja', date: new Date() },
        { crop: 'Coffee', price: 8000, unit: 'kg', market: 'Mbale', date: new Date() }
      ];
      
      res.json({
        success: true,
        data: {
          prices: mockPrices,
          lastUpdated: new Date(),
          source: 'Uganda Commodity Exchange'
        }
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch market prices',
        error: error.message
      });
    }
  }
  
  // ==================== ADMIN FUNCTIONS ====================
  
  async getAllFarmers(req, res) {
    try {
      const { page = 1, limit = 20, district } = req.query;
      
      const query = {};
      if (district) query['location.district'] = district;
      
      const farmers = await Farmer.find(query)
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 });
      
      const total = await Farmer.countDocuments(query);
      
      res.json({
        success: true,
        data: {
          farmers,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch farmers',
        error: error.message
      });
    }
  }
  
  async getAdminStats(req, res) {
    try {
      const totalFarmers = await Farmer.countDocuments();
      const farmersByDistrict = await Farmer.aggregate([
        { $group: { _id: '$location.district', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);
      
      const totalFarms = await Farm.countDocuments();
      const activeCrops = await Farm.countDocuments({ 'currentCrop': { $exists: true } });
      
      res.json({
        success: true,
        data: {
          totalFarmers,
          farmersByDistrict,
          totalFarms,
          activeCrops
        }
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get admin stats',
        error: error.message
      });
    }
  }
}

export default new FarmerController();