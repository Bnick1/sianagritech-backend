// backend/models/SensorReading.js
import mongoose from 'mongoose';

const sensorReadingSchema = new mongoose.Schema({
  sensor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sensor',
    required: true,
    index: true
  },
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
  
  // Reading Data
  timestamp: {
    type: Date,
    required: true,
    index: true,
    default: Date.now
  },
  receivedAt: {
    type: Date,
    default: Date.now
  },
  
  // Measurement Values
  readings: {
    temperature: {
      value: Number,
      unit: {
        type: String,
        default: '°C'
      }
    },
    soilMoisture: {
      value: Number,
      unit: {
        type: String,
        default: '%'
      }
    },
    humidity: {
      value: Number,
      unit: {
        type: String,
        default: '%'
      }
    },
    phLevel: {
      value: Number,
      unit: {
        type: String,
        default: 'pH'
      }
    },
    nitrogen: {
      value: Number,
      unit: {
        type: String,
        default: 'ppm'
      }
    },
    phosphorus: {
      value: Number,
      unit: {
        type: String,
        default: 'ppm'
      }
    },
    potassium: {
      value: Number,
      unit: {
        type: String,
        default: 'ppm'
      }
    },
    rainfall: {
      value: Number,
      unit: {
        type: String,
        default: 'mm'
      }
    },
    windSpeed: {
      value: Number,
      unit: {
        type: String,
        default: 'm/s'
      }
    },
    windDirection: {
      value: Number,
      unit: {
        type: String,
        default: 'degrees'
      }
    },
    solarRadiation: {
      value: Number,
      unit: {
        type: String,
        default: 'W/m²'
      }
    },
    leafWetness: {
      value: Number,
      unit: {
        type: String,
        default: '%'
      }
    }
  },
  
  // Location at time of reading
  location: {
    coordinates: {
      type: [Number], // [longitude, latitude]
      index: '2dsphere'
    },
    accuracy: Number
  },
  
  // Sensor Status at reading time
  sensorStatus: {
    batteryLevel: Number,
    signalStrength: Number,
    firmwareVersion: String
  },
  
  // Quality Flags
  quality: {
    isValid: {
      type: Boolean,
      default: true
    },
    confidence: Number, // 0-100%
    flags: [String] // e.g., ['out_of_range', 'spike', 'missing_data']
  },
  
  // Derived Data
  derived: {
    evapotranspiration: Number,
    dewPoint: Number,
    heatIndex: Number,
    soilTemperature: Number
  },
  
  // Alerts generated from this reading
  alerts: [{
    type: String,
    enum: [
      'high_temperature', 'low_temperature', 'dry_soil', 'wet_soil',
      'low_ph', 'high_ph', 'nutrient_deficiency', 'heavy_rain',
      'strong_wind', 'frost_risk'
    ]
  }],
  
  // Processing Metadata
  processed: {
    type: Boolean,
    default: false
  },
  processedAt: Date,
  
  // Raw data from sensor (if different)
  rawData: mongoose.Schema.Types.Mixed
}, {
  timestamps: true
});

// Indexes for efficient querying
sensorReadingSchema.index({ sensor: 1, timestamp: -1 });
sensorReadingSchema.index({ farm: 1, timestamp: -1 });
sensorReadingSchema.index({ farmer: 1, timestamp: -1 });
sensorReadingSchema.index({ timestamp: -1 });
sensorReadingSchema.index({ 'readings.temperature.value': 1 });
sensorReadingSchema.index({ 'readings.soilMoisture.value': 1 });
sensorReadingSchema.index({ alerts: 1 });

// Compound indexes for common queries
sensorReadingSchema.index({ 
  farm: 1, 
  timestamp: -1, 
  'readings.temperature.value': 1 
});

// Pre-save middleware to validate readings
sensorReadingSchema.pre('save', function(next) {
  // Set quality flags based on readings
  const flags = [];
  
  // Check temperature range
  if (this.readings.temperature?.value) {
    if (this.readings.temperature.value < -50 || this.readings.temperature.value > 100) {
      flags.push('temperature_out_of_range');
      this.quality.isValid = false;
    }
  }
  
  // Check soil moisture range
  if (this.readings.soilMoisture?.value) {
    if (this.readings.soilMoisture.value < 0 || this.readings.soilMoisture.value > 100) {
      flags.push('soil_moisture_out_of_range');
      this.quality.isValid = false;
    }
  }
  
  // Check pH range
  if (this.readings.phLevel?.value) {
    if (this.readings.phLevel.value < 0 || this.readings.phLevel.value > 14) {
      flags.push('ph_out_of_range');
      this.quality.isValid = false;
    }
  }
  
  this.quality.flags = flags;
  
  // Generate alerts based on thresholds
  this.alerts = this.generateAlerts();
  
  // Calculate derived values
  this.calculateDerivedValues();
  
  next();
});

// Method to generate alerts
sensorReadingSchema.methods.generateAlerts = function() {
  const alerts = [];
  const readings = this.readings;
  
  // Temperature alerts
  if (readings.temperature?.value) {
    if (readings.temperature.value > 35) alerts.push('high_temperature');
    if (readings.temperature.value < 10) alerts.push('low_temperature');
  }
  
  // Soil moisture alerts
  if (readings.soilMoisture?.value) {
    if (readings.soilMoisture.value < 20) alerts.push('dry_soil');
    if (readings.soilMoisture.value > 80) alerts.push('wet_soil');
  }
  
  // pH alerts
  if (readings.phLevel?.value) {
    if (readings.phLevel.value < 5.5) alerts.push('low_ph');
    if (readings.phLevel.value > 7.5) alerts.push('high_ph');
  }
  
  // Rainfall alerts
  if (readings.rainfall?.value && readings.rainfall.value > 50) {
    alerts.push('heavy_rain');
  }
  
  return alerts;
};

// Method to calculate derived values
sensorReadingSchema.methods.calculateDerivedValues = function() {
  const readings = this.readings;
  
  // Calculate dew point if temperature and humidity available
  if (readings.temperature?.value && readings.humidity?.value) {
    const T = readings.temperature.value;
    const RH = readings.humidity.value;
    
    // Magnus formula approximation
    const a = 17.27;
    const b = 237.7;
    const alpha = ((a * T) / (b + T)) + Math.log(RH / 100);
    const dewPoint = (b * alpha) / (a - alpha);
    
    this.derived.dewPoint = parseFloat(dewPoint.toFixed(1));
    
    // Calculate heat index for temperatures above 27°C
    if (T > 27 && RH > 40) {
      const HI = -8.78469475556 +
                (1.61139411 * T) +
                (2.33854883889 * RH) +
                (-0.14611605 * T * RH) +
                (-0.012308094 * T * T) +
                (-0.0164248277778 * RH * RH) +
                (0.002211732 * T * T * RH) +
                (0.00072546 * T * RH * RH) +
                (-0.000003582 * T * T * RH * RH);
      
      this.derived.heatIndex = parseFloat(HI.toFixed(1));
    }
  }
};

// Static method to get reading statistics
sensorReadingSchema.statics.getStatistics = async function(sensorId, startDate, endDate) {
  const pipeline = [
    {
      $match: {
        sensor: mongoose.Types.ObjectId(sensorId),
        timestamp: { $gte: startDate, $lte: endDate },
        'quality.isValid': true
      }
    },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        avgTemperature: { $avg: '$readings.temperature.value' },
        minTemperature: { $min: '$readings.temperature.value' },
        maxTemperature: { $max: '$readings.temperature.value' },
        avgSoilMoisture: { $avg: '$readings.soilMoisture.value' },
        avgHumidity: { $avg: '$readings.humidity.value' }
      }
    }
  ];
  
  return await this.aggregate(pipeline);
};

const SensorReading = mongoose.model('SensorReading', sensorReadingSchema);

export default SensorReading;