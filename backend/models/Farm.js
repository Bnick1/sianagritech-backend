import mongoose from 'mongoose';

const FarmSchema = new mongoose.Schema({
  // Link to farmer
  farmerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Farmer',
    required: true,
    index: true
  },
  
  // Farm details
  name: {
    type: String,
    required: true
  },
  size: {
    type: Number, // in acres
    required: true,
    min: 0.1
  },
  
  // Location
  location: {
    district: {
      type: String,
      required: true
    },
    subcounty: String,
    parish: String,
    village: String,
    coordinates: {
      type: [Number], // [longitude, latitude]
      index: '2dsphere'
    },
    altitude: Number,
    soilType: {
      type: String,
      enum: ['clay', 'loam', 'sandy', 'clay_loam', 'silt_loam', 'other']
    }
  },
  
  // Current activities
  currentCrop: {
    cropType: String,
    variety: String,
    plantingDate: Date,
    expectedHarvestDate: Date,
    area: Number, // acres
    status: {
      type: String,
      enum: ['planted', 'germinated', 'vegetative', 'flowering', 'fruiting', 'mature', 'harvested']
    }
  },
  
  // Infrastructure
  hasIrrigation: {
    type: Boolean,
    default: false
  },
  irrigationType: {
    type: String,
    enum: ['drip', 'sprinkler', 'flood', 'none']
  },
  storageCapacity: Number, // in kg
  equipment: [{
    type: String,
    name: String,
    condition: String
  }],
  
  // Production history
  productionHistory: [{
    season: String,
    crop: String,
    yield: Number, // in kg
    revenue: Number,
    costs: {
      seeds: Number,
      fertilizer: Number,
      labor: Number,
      other: Number
    }
  }],
  
  // IoT Sensors
  sensors: [{
    sensorId: String,
    type: {
      type: String,
      enum: ['soil_moisture', 'temperature', 'humidity', 'rainfall', 'camera']
    },
    lastReading: Date,
    batteryLevel: Number,
    status: {
      type: String,
      enum: ['active', 'inactive', 'maintenance']
    }
  }],
  
  // Offline sync
  syncStatus: {
    lastSynced: Date,
    offlineCreated: Boolean,
    pendingUpdates: [{
      field: String,
      value: mongoose.Schema.Types.Mixed,
      timestamp: Date
    }]
  },
  
  // Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'abandoned', 'leased'],
    default: 'active'
  },
  
  // Metadata
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp on save
FarmSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for total revenue
FarmSchema.virtual('totalRevenue').get(function() {
  return this.productionHistory.reduce((sum, season) => sum + (season.revenue || 0), 0);
});

// Virtual for average yield
FarmSchema.virtual('averageYield').get(function() {
  if (this.productionHistory.length === 0) return 0;
  const totalYield = this.productionHistory.reduce((sum, season) => sum + (season.yield || 0), 0);
  return totalYield / this.productionHistory.length;
});

// Indexes
FarmSchema.index({ 'location.coordinates': '2dsphere' });
FarmSchema.index({ farmerId: 1, status: 1 });
FarmSchema.index({ 'currentCrop.status': 1 });

// Static method to find farms by location
FarmSchema.statics.findNearby = function(coordinates, maxDistance = 5000) {
  return this.find({
    'location.coordinates': {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: coordinates
        },
        $maxDistance: maxDistance // meters
      }
    },
    status: 'active'
  });
};

// Static method to get farm analytics
FarmSchema.statics.getFarmAnalytics = async function(farmerId) {
  return await this.aggregate([
    {
      $match: { farmerId: mongoose.Types.ObjectId(farmerId) }
    },
    {
      $group: {
        _id: null,
        totalFarms: { $sum: 1 },
        totalArea: { $sum: '$size' },
        activeCrops: {
          $sum: {
            $cond: [{ $ne: ['$currentCrop.cropType', null] }, 1, 0]
          }
        },
        averageYield: { $avg: '$productionHistory.yield' },
        totalRevenue: { $sum: '$productionHistory.revenue' }
      }
    }
  ]);
};

export default mongoose.model('Farm', FarmSchema);