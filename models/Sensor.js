// backend/models/Sensor.js
import mongoose from 'mongoose';

const sensorSchema = new mongoose.Schema({
  // Sensor Identity
  sensorId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: [
      'temperature', 'soil-moisture', 'humidity', 'ph', 'nutrient',
      'rainfall', 'wind-speed', 'wind-direction', 'solar-radiation',
      'leaf-wetness', 'multi-parameter'
    ]
  },
  model: String,
  manufacturer: String,
  serialNumber: String,
  
  // Location & Assignment
  farm: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Farm',
    index: true
  },
  farmer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Farmer',
    required: true,
    index: true
  },
  location: {
    coordinates: {
      type: [Number], // [longitude, latitude]
      index: '2dsphere'
    },
    altitude: Number,
    description: String
  },
  
  // Specifications
  specifications: {
    measurementRange: {
      min: Number,
      max: Number
    },
    accuracy: String,
    resolution: String,
    unit: String,
    samplingRate: String, // e.g., "every 15 minutes"
    batteryType: String,
    batteryLife: Number // in days
  },
  
  // Connectivity
  connectivity: {
    type: {
      type: String,
      enum: ['cellular', 'wifi', 'lorawan', 'sigfox', 'bluetooth', 'other']
    },
    networkOperator: String,
    simNumber: String,
    signalStrength: Number, // 0-100%
    lastConnection: Date
  },
  
  // Status & Health
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance', 'faulty', 'offline'],
    default: 'active'
  },
  batteryLevel: {
    type: Number,
    min: 0,
    max: 100
  },
  lastReading: Date,
  readingCount: {
    type: Number,
    default: 0
  },
  
  // Calibration
  lastCalibration: Date,
  nextCalibration: Date,
  calibrationHistory: [{
    date: Date,
    technician: String,
    readings: mongoose.Schema.Types.Mixed,
    notes: String
  }],
  
  // Configuration
  configuration: {
    samplingInterval: Number, // seconds
    uploadInterval: Number, // seconds
    thresholds: mongoose.Schema.Types.Mixed, // e.g., {temperature: {min: 10, max: 35}}
    alertsEnabled: Boolean
  },
  
  // Metadata
  installationDate: Date,
  installedBy: String,
  warrantyExpiry: Date,
  notes: String,
  
  // Statistics
  stats: {
    uptime: Number, // percentage
    dailyReadings: Number,
    avgBatteryConsumption: Number,
    lastMaintenance: Date
  }
}, {
  timestamps: true
});

// Indexes
sensorSchema.index({ sensorId: 1 });
sensorSchema.index({ farmer: 1, status: 1 });
sensorSchema.index({ farm: 1 });
sensorSchema.index({ type: 1 });
sensorSchema.index({ 'location.coordinates': '2dsphere' });
sensorSchema.index({ status: 1, lastConnection: 1 });

// Pre-save middleware for sensor ID format
sensorSchema.pre('save', function(next) {
  if (!this.sensorId.startsWith('SEN_')) {
    this.sensorId = `SEN_${this.sensorId}`;
  }
  this.sensorId = this.sensorId.toUpperCase();
  next();
});

// Method to get sensor health status
sensorSchema.methods.getHealthStatus = function() {
  const now = new Date();
  const hoursSinceLastReading = (now - this.lastReading) / (1000 * 60 * 60);
  
  let health = 'healthy';
  let issues = [];
  
  if (hoursSinceLastReading > 24) {
    health = 'offline';
    issues.push('No readings for over 24 hours');
  } else if (hoursSinceLastReading > 4) {
    health = 'warning';
    issues.push('Delayed readings');
  }
  
  if (this.batteryLevel < 20) {
    health = health === 'healthy' ? 'warning' : health;
    issues.push('Low battery');
  }
  
  if (this.status !== 'active') {
    health = 'faulty';
    issues.push(`Sensor status: ${this.status}`);
  }
  
  return {
    health,
    issues,
    batteryLevel: this.batteryLevel,
    lastReading: this.lastReading,
    uptime: this.stats?.uptime || 0
  };
};

const Sensor = mongoose.model('Sensor', sensorSchema);

export default Sensor;