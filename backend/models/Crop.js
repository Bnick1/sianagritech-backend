// backend/models/Crop.js
import mongoose from 'mongoose';

const cropSchema = new mongoose.Schema({
  farmer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Farmer',
    required: true,
    index: true
  },
  farm: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Farm',
    index: true
  },
  
  // Crop Details
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: [
      'maize', 'coffee', 'tea', 'bananas', 'beans', 'rice', 'wheat',
      'sorghum', 'millet', 'potatoes', 'tomatoes', 'onions',
      'cabbage', 'carrots', 'sugarcane', 'cotton', 'other'
    ]
  },
  variety: String,
  
  // Planting Information
  plantingDate: {
    type: Date,
    required: true
  },
  area: {
    type: Number, // in acres
    required: true,
    min: 0.01,
    max: 1000
  },
  seedSource: String,
  seedQuantity: Number,
  seedUnit: {
    type: String,
    enum: ['kg', 'bags', 'liters', 'units']
  },
  
  // Growth Cycle
  growthStage: {
    type: String,
    enum: [
      'planting', 'germination', 'vegetative', 'flowering',
      'fruiting', 'maturation', 'harvesting', 'post-harvest'
    ],
    default: 'planting'
  },
  expectedHarvestDate: Date,
  actualHarvestDate: Date,
  
  // Inputs (Fertilizers, Pesticides)
  inputs: [{
    type: {
      type: String,
      enum: ['fertilizer', 'pesticide', 'herbicide', 'fungicide', 'other']
    },
    name: String,
    quantity: Number,
    unit: String,
    applicationDate: Date,
    cost: Number
  }],
  
  // Irrigation
  irrigationSchedule: {
    frequency: String,
    amount: Number,
    unit: String,
    lastIrrigation: Date,
    nextIrrigation: Date
  },
  
  // Yield Information
  expectedYield: {
    quantity: Number,
    unit: {
      type: String,
      enum: ['kg', 'tons', 'bags', 'bunches', 'crates']
    },
    estimatedRevenue: Number
  },
  actualYield: {
    quantity: Number,
    unit: String,
    revenue: Number,
    harvestDate: Date,
    quality: {
      type: String,
      enum: ['excellent', 'good', 'fair', 'poor']
    }
  },
  
  // Costs
  totalCost: {
    type: Number,
    default: 0
  },
  costs: {
    seeds: Number,
    fertilizers: Number,
    pesticides: Number,
    labor: Number,
    irrigation: Number,
    other: Number
  },
  
  // Status
  status: {
    type: String,
    enum: ['planned', 'planted', 'growing', 'harvesting', 'harvested', 'failed', 'abandoned'],
    default: 'planned'
  },
  
  // Monitoring
  lastInspection: Date,
  nextInspection: Date,
  issues: [{
    type: String,
    enum: ['pests', 'disease', 'nutrient-deficiency', 'water-stress', 'weather-damage', 'other']
  }],
  
  // Notes & Images
  notes: String,
  images: [{
    url: String,
    caption: String,
    stage: String,
    date: Date
  }],
  
  // Sensor Data Reference
  sensorReadings: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SensorReading'
  }],
  
  // Weather Alerts
  weatherAlerts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WeatherAlert'
  }]
}, {
  timestamps: true
});

// Indexes
cropSchema.index({ farmer: 1, status: 1 });
cropSchema.index({ farm: 1 });
cropSchema.index({ type: 1 });
cropSchema.index({ plantingDate: 1 });
cropSchema.index({ expectedHarvestDate: 1 });
cropSchema.index({ status: 1, growthStage: 1 });

// Virtual for crop age in days
cropSchema.virtual('ageInDays').get(function() {
  if (!this.plantingDate) return 0;
  const today = new Date();
  const diffTime = Math.abs(today - this.plantingDate);
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for days to harvest
cropSchema.virtual('daysToHarvest').get(function() {
  if (!this.expectedHarvestDate) return null;
  const today = new Date();
  const diffTime = Math.abs(this.expectedHarvestDate - today);
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
});

// Pre-save middleware
cropSchema.pre('save', function(next) {
  // Update growth stage based on age
  if (this.plantingDate) {
    const ageInDays = this.ageInDays;
    
    if (ageInDays < 7) this.growthStage = 'germination';
    else if (ageInDays < 30) this.growthStage = 'vegetative';
    else if (ageInDays < 60) this.growthStage = 'flowering';
    else if (ageInDays < 90) this.growthStage = 'fruiting';
    else if (ageInDays < 120) this.growthStage = 'maturation';
    else if (this.actualHarvestDate) this.growthStage = 'post-harvest';
    
    // Auto-update status based on dates
    if (this.actualHarvestDate) {
      this.status = 'harvested';
    } else if (this.expectedHarvestDate && new Date() > this.expectedHarvestDate) {
      this.status = 'harvesting';
    } else if (this.plantingDate) {
      this.status = 'planted';
    }
  }
  
  // Calculate total cost
  if (this.costs) {
    this.totalCost = Object.values(this.costs).reduce((sum, cost) => sum + (cost || 0), 0);
  }
  
  next();
});

const Crop = mongoose.model('Crop', cropSchema);

export default Crop;