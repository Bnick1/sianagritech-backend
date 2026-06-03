import mongoose from 'mongoose';

const farmSchema = new mongoose.Schema({
  // CHANGE: farmer -> farmerId to match your controller
  farmerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Farmer',
    required: true,
    index: true
  },
  
  // Farm Identity
  name: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    unique: true,
    trim: true,
    uppercase: true
  },
  
  // Location
  location: {
    district: String,
    subCounty: String,
    village: String,
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
      index: '2dsphere'
    },
    altitude: Number,
    accuracy: Number, // GPS accuracy in meters
    address: String
  },
  
  // Farm Details
  size: {
    type: Number, // in acres
    required: true,
    min: 0.1,
    max: 10000
  },
  soilType: {
    type: String,
    enum: ['clay', 'sandy', 'loamy', 'silt', 'peat', 'chalky', 'other']
  },
  irrigationType: {
    type: String,
    enum: ['rainfed', 'drip', 'sprinkler', 'flood', 'manual', 'none']
  },
  
  // Crops (current crops on the farm)
  crops: [{
    crop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Crop'
    },
    area: Number, // acres for this specific crop
    plantingDate: Date,
    expectedHarvest: Date
  }],
  
  // Infrastructure
  infrastructure: {
    storage: Boolean,
    irrigationSystem: Boolean,
    fencing: Boolean,
    greenhouse: Boolean,
    sheds: Boolean
  },
  
  // Resources
  waterSources: [{
    type: String,
    enum: ['borehole', 'well', 'river', 'lake', 'rainwater', 'municipal']
  }],
  
  // Sensors
  sensors: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sensor'
  }],
  
  // Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'abandoned', 'leased'],
    default: 'active'
  },
  
  // Metadata
  notes: String,
  images: [{
    url: String,
    caption: String,
    uploadedAt: Date
  }],
  
  // Statistics (calculated fields)
  stats: {
    totalYield: Number,
    averageYield: Number,
    lastHarvest: Date,
    sensorCount: Number,
    lastReading: Date
  }
}, {
  timestamps: true
});

// Indexes - UPDATE: farmer -> farmerId
farmSchema.index({ farmerId: 1, status: 1 });
farmSchema.index({ code: 1 });
farmSchema.index({ 'location.coordinates': '2dsphere' });
farmSchema.index({ 'location.district': 1 });
farmSchema.index({ status: 1 });

// Pre-save middleware to generate farm code
farmSchema.pre('save', async function(next) {
  if (!this.code) {
    const count = await this.constructor.countDocuments();
    this.code = `FARM${(count + 1).toString().padStart(6, '0')}`;
  }
  next();
});

// Method to get farm summary
farmSchema.methods.getSummary = function() {
  return {
    id: this._id,
    name: this.name,
    code: this.code,
    size: this.size,
    location: this.location.district,
    status: this.status,
    cropCount: this.crops.length,
    sensorCount: this.sensors.length
  };
};

// Method to associate farm with farmer (two-way relationship)
farmSchema.methods.associateWithFarmer = async function() {
  const Farmer = mongoose.model('Farmer');
  await Farmer.findByIdAndUpdate(this.farmerId, {
    $addToSet: { farms: this._id }
  });
};

// Post-save hook to maintain two-way relationship
farmSchema.post('save', async function(doc) {
  try {
    await doc.associateWithFarmer();
  } catch (error) {
    console.error('Error associating farm with farmer:', error);
  }
});

const Farm = mongoose.model('Farm', farmSchema);

export default Farm;