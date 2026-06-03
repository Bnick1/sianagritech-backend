// backend/models/CropObservation.js
import mongoose from 'mongoose';

const cropObservationSchema = new mongoose.Schema({
  farmId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Farm',
    required: true,
    index: true
  },
  cropId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Crop',
    required: true
  },
  observationType: {
    type: String,
    enum: ['visual', 'sensor', 'ai_analysis', 'manual_entry', 'photo'],
    required: true
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  location: {
    lat: Number,
    lng: Number,
    accuracy: Number
  },
  // Visual observations
  visualSymptoms: [{
    part: { type: String, enum: ['leaf', 'stem', 'root', 'fruit', 'flower', 'whole_plant'] },
    symptom: String,
    severity: { type: String, enum: ['none', 'mild', 'moderate', 'severe'] },
    percentage: Number, // Percentage affected
    description: String,
    photoUrl: String
  }],
  
  // Sensor data at time of observation
  sensorReadings: {
    soilMoisture: Number,
    temperature: Number,
    humidity: Number,
    ph: Number,
    nutrientLevel: String,
    conductivity: Number
  },
  
  // AI Analysis results
  aiAnalysis: {
    performed: Boolean,
    modelUsed: String,
    confidence: Number,
    detectedDiseases: [{
      name: String,
      confidence: Number,
      severity: String,
      recommendedAction: String
    }],
    healthScore: Number,
    imageUrl: String,
    analysisRaw: mongoose.Schema.Types.Mixed
  },
  
  // Growth metrics
  growthStage: {
    type: String,
    enum: ['planting', 'germination', 'seedling', 'vegetative', 'flowering', 'fruiting', 'maturity', 'harvest']
  },
  height: Number, // cm
  canopyWidth: Number, // cm
  stemDiameter: Number, // mm
  leafCount: Number,
  fruitCount: Number,
  
  // Stress indicators
  stressFactors: [{
    type: { type: String, enum: ['water', 'nutrient', 'pest', 'disease', 'weather', 'weed'] },
    level: { type: String, enum: ['low', 'medium', 'high'] },
    description: String
  }],
  
  // Recommendations
  recommendations: [{
    type: String,
    priority: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
    action: String,
    timeframe: String,
    resources: [String]
  }],
  
  // Yield estimation
  yieldEstimate: {
    amount: Number,
    unit: { type: String, default: 'kg' },
    confidence: Number,
    factors: [String]
  },
  
  // Metadata
  observer: {
    type: String,
    enum: ['farmer', 'extension_officer', 'ai_system', 'sensor_network']
  },
  notes: String,
  photos: [{
    url: String,
    caption: String,
    timestamp: Date,
    gps: {
      lat: Number,
      lng: Number
    }
  }],
  
  // Sync and status
  syncStatus: {
    type: String,
    enum: ['pending', 'synced', 'failed'],
    default: 'synced'
  },
  qualityRating: {
    type: Number,
    min: 1,
    max: 5
  },
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Indexes
cropObservationSchema.index({ farmId: 1, date: -1 });
cropObservationSchema.index({ 'aiAnalysis.detectedDiseases.name': 1 });
cropObservationSchema.index({ observationType: 1 });
cropObservationSchema.index({ growthStage: 1 });

// Virtual for disease presence
cropObservationSchema.virtual('hasDisease').get(function() {
  return this.aiAnalysis?.detectedDiseases?.length > 0 || 
         this.visualSymptoms?.some(s => s.symptom.toLowerCase().includes('disease'));
});

// Method to calculate overall health score
cropObservationSchema.methods.calculateHealthScore = function() {
  let score = 100;
  
  // Deduct for diseases
  if (this.aiAnalysis?.detectedDiseases) {
    this.aiAnalysis.detectedDiseases.forEach(disease => {
      if (disease.severity === 'severe') score -= 30;
      else if (disease.severity === 'moderate') score -= 20;
      else if (disease.severity === 'mild') score -= 10;
    });
  }
  
  // Deduct for stress factors
  if (this.stressFactors) {
    this.stressFactors.forEach(stress => {
      if (stress.level === 'high') score -= 15;
      else if (stress.level === 'medium') score -= 10;
      else if (stress.level === 'low') score -= 5;
    });
  }
  
  // Adjust based on growth stage appropriateness
  if (this.growthStage && this.sensorReadings) {
    const stage = this.growthStage;
    const moisture = this.sensorReadings.soilMoisture;
    
    if (stage === 'flowering' && moisture < 40) score -= 10;
    if (stage === 'fruiting' && moisture < 50) score -= 15;
  }
  
  return Math.max(0, Math.min(100, score));
};

export default mongoose.models.CropObservation || 
  mongoose.model('CropObservation', cropObservationSchema);