// backend/models/WeatherRecord.js
import mongoose from 'mongoose';

const weatherRecordSchema = new mongoose.Schema({
  farmId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Farm',
    required: true,
    index: true
  },
  location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    elevation: Number,
    accuracy: Number
  },
  period: {
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    days: { type: Number, default: 7 }
  },
  sources: [{
    name: String,
    type: { type: String, enum: ['satellite', 'ground_station', 'api', 'sensor'] },
    confidence: Number
  }],
  data: {
    current: {
      temperature: Number,
      humidity: Number,
      pressure: Number,
      windSpeed: Number,
      windDirection: Number,
      precipitation: Number,
      solarRadiation: Number,
      condition: String,
      feelsLike: Number,
      dewPoint: Number,
      visibility: Number,
      cloudCover: Number,
      uvIndex: Number
    },
    historical: [{
      date: Date,
      temperature_avg: Number,
      temperature_min: Number,
      temperature_max: Number,
      humidity: Number,
      precipitation: Number,
      solar_radiation: Number,
      wind_speed: Number
    }],
    forecast: [{
      date: Date,
      temperature: {
        min: Number,
        max: Number,
        day: Number,
        night: Number,
        morn: Number,
        eve: Number
      },
      humidity: Number,
      pressure: Number,
      windSpeed: Number,
      windDirection: Number,
      precipitation: {
        total: Number,
        probability: Number,
        type: String
      },
      condition: String,
      sunrise: Date,
      sunset: Date,
      moonPhase: Number,
      uvIndex: Number
    }],
    climate: {
      zone: String,
      classification: String,
      annual_rainfall: Number,
      rainy_season: {
        start: String,
        end: String,
        months: [String]
      },
      dry_season: {
        start: String,
        end: String,
        months: [String]
      },
      temperature_range: {
        min_annual: Number,
        max_annual: Number,
        avg_annual: Number
      }
    },
    agroforestry: {
      suitable_species: [String],
      planting_density: String,
      intercrop_recommendations: [String],
      rainfall_requirement: String
    }
  },
  insights: {
    planting_window: {
      optimal: Boolean,
      start_date: Date,
      end_date: Date,
      confidence: Number,
      recommended_crops: [String]
    },
    irrigation_needs: {
      required: Boolean,
      amount_mm: Number,
      frequency: String,
      next_irrigation: Date
    },
    pest_risk: {
      level: { type: String, enum: ['low', 'medium', 'high', 'severe'] },
      pests: [String],
      conditions: String,
      prevention: [String]
    },
    harvest_timing: {
      optimal_window: {
        start: Date,
        end: Date
      },
      quality_indicators: [String],
      storage_conditions: String
    },
    crop_suitability: [{
      crop: String,
      score: Number,
      season: String,
      limitations: [String],
      recommendations: [String]
    }],
    warnings: [{
      type: String,
      severity: { type: String, enum: ['info', 'warning', 'alert', 'critical'] },
      message: String,
      period: {
        start: Date,
        end: Date
      },
      impact: String,
      actions: [String]
    }],
    recommendations: [{
      type: String,
      priority: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
      action: String,
      timing: String,
      resources_needed: [String],
      expected_impact: String
    }]
  },
  processingTime: Number,
  dataQuality: {
    score: Number,
    sources_count: Number,
    completeness: Number,
    freshness: Number,
    issues: [String]
  },
  syncStatus: {
    type: String,
    enum: ['pending', 'synced', 'failed'],
    default: 'synced'
  },
  metadata: {
    version: { type: String, default: '1.0' },
    algorithm: String,
    fusion_method: String,
    lastUpdated: { type: Date, default: Date.now }
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
weatherRecordSchema.index({ farmId: 1, createdAt: -1 });
weatherRecordSchema.index({ 'location.lat': 1, 'location.lng': 1 });
weatherRecordSchema.index({ 'insights.warnings.severity': 1 });
weatherRecordSchema.index({ 'data.climate.zone': 1 });

// Pre-save middleware to calculate data quality
weatherRecordSchema.pre('save', function(next) {
  if (this.data) {
    this.dataQuality = this.calculateDataQuality();
  }
  next();
});

// Method to calculate data quality score
weatherRecordSchema.methods.calculateDataQuality = function() {
  let score = 0;
  let completeness = 0;
  const totalFields = 10; // Example: 10 important fields
  
  if (this.data.current) completeness += 3;
  if (this.data.forecast && this.data.forecast.length > 0) completeness += 2;
  if (this.data.historical && this.data.historical.length > 0) completeness += 2;
  if (this.data.climate) completeness += 1;
  if (this.sources && this.sources.length > 0) completeness += 1;
  if (this.insights) completeness += 1;
  
  const completenessScore = (completeness / totalFields) * 100;
  
  // Freshness (more recent = higher score)
  const ageHours = (new Date() - this.createdAt) / (1000 * 60 * 60);
  const freshnessScore = Math.max(0, 100 - (ageHours * 2));
  
  // Source diversity
  const sourceScore = Math.min(this.sources?.length * 20, 100);
  
  // Final score weighted average
  score = (completenessScore * 0.4) + (freshnessScore * 0.3) + (sourceScore * 0.3);
  
  return {
    score: Math.round(score),
    completeness: Math.round(completenessScore),
    freshness: Math.round(freshnessScore),
    sources_count: this.sources?.length || 0,
    issues: score < 70 ? ['Low data quality'] : []
  };
};

export default mongoose.models.WeatherRecord || 
  mongoose.model('WeatherRecord', weatherRecordSchema);