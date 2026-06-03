// backend/config/database.js
import mongoose from 'mongoose';
import { Sequelize } from 'sequelize';

class DatabaseService {
  constructor() {
    this.mongoConnection = null;
    this.postgresConnection = null;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.modelsLoaded = false;
    this.postgresModels = null;
  }

  async connectMongoDB() {
    if (this.mongoConnection) {
      return this.mongoConnection;
    }

    try {
      let mongoURI = process.env.MONGODB_URI;

      // If no MONGODB_URI in env, use default for local development
      if (!mongoURI) {
        console.warn('⚠️ MONGODB_URI not found in .env, using default');
        mongoURI = 'mongodb://localhost:27017/sianagritech';
      }

      console.log('🔗 Connecting to MongoDB...');

      // Updated options for MongoDB Driver v4+ (removed deprecated options)
      const options = {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
        retryWrites: true,
        retryReads: true,
        w: 'majority'
      };

      const connection = await mongoose.connect(mongoURI, options);

      this.mongoConnection = connection;
      this.retryCount = 0;

      const dbInfo = connection.connection;
      console.log(`✅ MongoDB Connected:
        Host: ${dbInfo.host}
        Database: ${dbInfo.name}
        Port: ${dbInfo.port}
        State: ${dbInfo.readyState === 1 ? 'Connected' : 'Disconnected'}`);

      // Event listeners
      mongoose.connection.on('error', (err) => {
        console.error('❌ MongoDB connection error:', err.message);
      });

      mongoose.connection.on('disconnected', () => {
        console.warn('⚠️ MongoDB disconnected. Attempting to reconnect...');
        this.mongoConnection = null;
        setTimeout(() => this.connectMongoDB(), 5000);
      });

      mongoose.connection.on('reconnected', () => {
        console.log('🔄 MongoDB reconnected');
      });

      return connection;
    } catch (error) {
      console.error('❌ MongoDB connection failed:', error.message);

      // Retry logic for production
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        const delay = Math.min(1000 * Math.pow(2, this.retryCount), 10000);
        console.log(`🔄 Retry ${this.retryCount}/${this.maxRetries} in ${delay}ms...`);
        setTimeout(() => this.connectMongoDB(), delay);
      } else {
        console.error('💥 Max retries reached. Please check MongoDB configuration.');
        throw error;
      }
    }
  }

  async connectPostgreSQL() {
    if (this.postgresConnection) {
      return this.postgresConnection;
    }

    try {
      // Skip if environment variables contain template placeholders
      if (process.env.POSTGRES_HOST && process.env.POSTGRES_HOST.includes('${')) {
        console.log('📝 PostgreSQL: Template variables detected, skipping');
        return null;
      }

      // PostgreSQL for IoT sensor data (optional)
      if (!process.env.POSTGRES_HOST || process.env.POSTGRES_HOST === '') {
        console.log('📝 PostgreSQL: Not configured, skipping');
        return null;
      }

      console.log('🔗 Connecting to PostgreSQL...');

      const sequelize = new Sequelize(
        process.env.POSTGRES_DB || 'sianagritech',
        process.env.POSTGRES_USER || 'postgres',
        process.env.POSTGRES_PASSWORD || '',
        {
          host: process.env.POSTGRES_HOST,
          port: process.env.POSTGRES_PORT || 5432,
          dialect: 'postgres',
          logging: process.env.NODE_ENV === 'development' ? console.log : false,
          pool: {
            max: 10,
            min: 0,
            acquire: 30000,
            idle: 10000
          },
          dialectOptions: {
            ssl: process.env.NODE_ENV === 'production' && process.env.POSTGRES_SSL !== 'false' 
              ? { require: true, rejectUnauthorized: false }
              : false
          }
        }
      );

      await sequelize.authenticate();
      this.postgresConnection = sequelize;

      console.log('✅ PostgreSQL connected successfully');
      return sequelize;
    } catch (error) {
      console.warn('⚠️ PostgreSQL connection failed:', error.message);
      return null;
    }
  }

  async loadMongoModels() {
    if (this.modelsLoaded) {
      console.log('📦 MongoDB models already loaded');
      return;
    }

    console.log('📦 Loading MongoDB models...');
    
    // ==================== CORE MODELS ====================
    
    // Farmer Model
    if (!mongoose.models.Farmer) {
      const farmerSchema = new mongoose.Schema({
        firstName: { type: String, required: true },
        lastName: { type: String, required: true },
        phone: { 
          type: String, 
          required: true, 
          unique: true
        },
        pinHash: { type: String, required: true },
        email: { type: String, lowercase: true },
        location: {
          district: String,
          subcounty: String,
          village: String,
          coordinates: {
            lat: Number,
            lng: Number
          }
        },
        farms: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Farm' }],
        language: { type: String, default: 'en' },
        lastLogin: Date,
        status: { 
          type: String, 
          enum: ['active', 'inactive', 'suspended'],
          default: 'active'
        },
        preferences: {
          smsAlerts: { type: Boolean, default: true },
          weatherAlerts: { type: Boolean, default: true },
          marketPriceAlerts: { type: Boolean, default: true },
          language: { type: String, default: 'en' }
        },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
      });
      
      // Removed duplicate index declarations
      mongoose.model('Farmer', farmerSchema);
      console.log('   👨‍🌾 Farmer model loaded');
    }

    // Farm Model
    if (!mongoose.models.Farm) {
      const farmSchema = new mongoose.Schema({
        farmerId: { 
          type: mongoose.Schema.Types.ObjectId, 
          ref: 'Farmer',
          required: true
        },
        name: { type: String, required: true },
        location: {
          lat: { type: Number, required: true },
          lng: { type: Number, required: true },
          accuracy: Number,
          address: String
        },
        size: { type: Number, required: true },
        soilType: { 
          type: String, 
          enum: ['clay', 'sandy', 'loamy', 'clay_loam', 'sandy_loam', 'unknown']
        },
        crops: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Crop' }],
        waterSource: {
          type: String,
          enum: ['rainfed', 'irrigation', 'mixed', 'unknown']
        },
        status: { 
          type: String, 
          enum: ['active', 'inactive', 'fallow'],
          default: 'active'
        },
        sensors: [{
          sensorId: String,
          type: String,
          lastReading: Date,
          status: String
        }],
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
      });
      
      mongoose.model('Farm', farmSchema);
      console.log('   🚜 Farm model loaded');
    }

    // Crop Model
    if (!mongoose.models.Crop) {
      const cropSchema = new mongoose.Schema({
        farmId: { 
          type: mongoose.Schema.Types.ObjectId, 
          ref: 'Farm',
          required: true
        },
        type: { 
          type: String, 
          required: true,
          enum: ['maize', 'cassava', 'beans', 'coffee', 'banana', 'vegetables', 'other']
        },
        variety: String,
        plantingDate: { type: Date, required: true },
        expectedHarvestDate: Date,
        area: Number,
        status: { 
          type: String, 
          enum: ['planted', 'growing', 'flowering', 'fruiting', 'ready', 'harvested'],
          default: 'planted'
        },
        observations: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CropObservation' }],
        yieldEstimate: {
          amount: Number,
          unit: { type: String, default: 'kg' },
          confidence: Number
        },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
      });
      
      mongoose.model('Crop', cropSchema);
      console.log('   🌱 Crop model loaded');
    }

    // ==================== THESIS MODELS ====================
    
    // CropObservation Model
    if (!mongoose.models.CropObservation) {
      const cropObservationSchema = new mongoose.Schema({
        cropId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Crop',
          required: true
        },
        farmId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Farm',
          required: true
        },
        observationType: {
          type: String,
          enum: ['visual', 'sensor', 'ai_analysis', 'manual_entry', 'photo'],
          required: true
        },
        date: {
          type: Date,
          required: true
        },
        location: {
          lat: Number,
          lng: Number,
          accuracy: Number
        },
        visualSymptoms: [{
          part: { type: String, enum: ['leaf', 'stem', 'root', 'fruit', 'flower', 'whole_plant'] },
          symptom: String,
          severity: { type: String, enum: ['none', 'mild', 'moderate', 'severe'] },
          percentage: Number,
          description: String,
          photoUrl: String
        }],
        sensorReadings: {
          soilMoisture: Number,
          temperature: Number,
          humidity: Number,
          ph: Number,
          nutrientLevel: String,
          conductivity: Number
        },
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
        growthStage: {
          type: String,
          enum: ['planting', 'germination', 'seedling', 'vegetative', 'flowering', 'fruiting', 'maturity', 'harvest']
        },
        height: Number,
        canopyWidth: Number,
        stemDiameter: Number,
        leafCount: Number,
        fruitCount: Number,
        stressFactors: [{
          type: { type: String, enum: ['water', 'nutrient', 'pest', 'disease', 'weather', 'weed'] },
          level: { type: String, enum: ['low', 'medium', 'high'] },
          description: String
        }],
        recommendations: [{
          type: String,
          priority: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
          action: String,
          timeframe: String,
          resources: [String]
        }],
        yieldEstimate: {
          amount: Number,
          unit: { type: String, default: 'kg' },
          confidence: Number,
          factors: [String]
        },
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
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
      });
      
      cropObservationSchema.virtual('hasDisease').get(function() {
        return this.aiAnalysis?.detectedDiseases?.length > 0 || 
               this.visualSymptoms?.some(s => s.symptom.toLowerCase().includes('disease'));
      });
      
      mongoose.model('CropObservation', cropObservationSchema);
      console.log('   🔍 CropObservation model loaded');
    }

    // WeatherRecord Model
    if (!mongoose.models.WeatherRecord) {
      const weatherRecordSchema = new mongoose.Schema({
        farmId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Farm',
          required: true
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
      
      weatherRecordSchema.pre('save', function(next) {
        if (this.data) {
          this.dataQuality = this.calculateDataQuality();
        }
        next();
      });
      
      weatherRecordSchema.methods.calculateDataQuality = function() {
        let score = 0;
        let completeness = 0;
        const totalFields = 10;
        
        if (this.data.current) completeness += 3;
        if (this.data.forecast && this.data.forecast.length > 0) completeness += 2;
        if (this.data.historical && this.data.historical.length > 0) completeness += 2;
        if (this.data.climate) completeness += 1;
        if (this.sources && this.sources.length > 0) completeness += 1;
        if (this.insights) completeness += 1;
        
        const completenessScore = (completeness / totalFields) * 100;
        const ageHours = (new Date() - this.createdAt) / (1000 * 60 * 60);
        const freshnessScore = Math.max(0, 100 - (ageHours * 2));
        const sourceScore = Math.min(this.sources?.length * 20, 100);
        
        score = (completenessScore * 0.4) + (freshnessScore * 0.3) + (sourceScore * 0.3);
        
        return {
          score: Math.round(score),
          completeness: Math.round(completenessScore),
          freshness: Math.round(freshnessScore),
          sources_count: this.sources?.length || 0,
          issues: score < 70 ? ['Low data quality'] : []
        };
      };
      
      mongoose.model('WeatherRecord', weatherRecordSchema);
      console.log('   🌤️ WeatherRecord model loaded');
    }

    // AIPrediction Model
    if (!mongoose.models.AIPrediction) {
      const aiPredictionSchema = new mongoose.Schema({
        farmId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Farm',
          required: true
        },
        cropId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Crop'
        },
        cropType: {
          type: String,
          required: true,
          enum: ['maize', 'cassava', 'beans', 'coffee', 'banana', 'vegetables', 'other']
        },
        type: {
          type: String,
          enum: ['disease_detection', 'yield_prediction', 'irrigation_recommendation', 'pest_risk'],
          required: true
        },
        modelUsed: {
          name: String,
          version: String,
          accuracy: Number
        },
        input: {
          images: [String],
          sensorData: mongoose.Schema.Types.Mixed,
          weatherData: mongoose.Schema.Types.Mixed,
          cropData: mongoose.Schema.Types.Mixed
        },
        output: {
          diseases: [{
            name: String,
            confidence: Number,
            severity: String,
            affectedArea: Number,
            recommendations: [String]
          }],
          healthScore: Number,
          yieldPrediction: {
            amount: Number,
            unit: { type: String, default: 'kg/ha' },
            confidence: Number,
            range: {
              low: Number,
              high: Number
            }
          },
          recommendations: [{
            type: String,
            priority: String,
            action: String,
            timeframe: String,
            resources: [String]
          }],
          confidence: Number,
          processingTime: Number
        },
        source: {
          type: String,
          enum: ['cloud_api', 'edge_computing', 'manual'],
          default: 'cloud_api'
        },
        syncStatus: {
          type: String,
          enum: ['pending', 'synced', 'failed'],
          default: 'synced'
        },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
      });
      
      mongoose.model('AIPrediction', aiPredictionSchema);
      console.log('   🤖 AIPrediction model loaded');
    }

    // ==================== SUPPORTING MODELS ====================
    
    // SensorReading Model
    if (!mongoose.models.SensorReading) {
      const sensorReadingSchema = new mongoose.Schema({
        sensorId: { type: String, required: true },
        farmId: { 
          type: mongoose.Schema.Types.ObjectId, 
          ref: 'Farm'
        },
        type: { 
          type: String, 
          required: true,
          enum: ['soil_moisture', 'temperature', 'humidity', 'rainfall', 'ph', 'nutrient', 'wind_speed']
        },
        value: { type: Number, required: true },
        unit: String,
        location: {
          lat: Number,
          lng: Number
        },
        timestamp: { type: Date, default: Date.now },
        source: { 
          type: String, 
          enum: ['thingspeak', 'direct_sensor', 'simulated'],
          default: 'direct_sensor'
        },
        syncStatus: { 
          type: String, 
          enum: ['pending', 'synced', 'failed'],
          default: 'synced'
        }
      });
      
      mongoose.model('SensorReading', sensorReadingSchema);
      console.log('   📡 SensorReading model loaded');
    }

    // Task Model
    if (!mongoose.models.Task) {
      const taskSchema = new mongoose.Schema({
        farmerId: { 
          type: mongoose.Schema.Types.ObjectId, 
          ref: 'Farmer',
          required: true
        },
        farmId: { 
          type: mongoose.Schema.Types.ObjectId, 
          ref: 'Farm'
        },
        cropId: { 
          type: mongoose.Schema.Types.ObjectId, 
          ref: 'Crop'
        },
        type: { 
          type: String, 
          required: true,
          enum: ['planting', 'watering', 'fertilizing', 'pest_control', 'harvesting', 'pruning', 'weeding', 'inspection']
        },
        title: { type: String, required: true },
        description: String,
        dueDate: { type: Date, required: true },
        priority: { 
          type: String, 
          enum: ['low', 'medium', 'high', 'critical'],
          default: 'medium'
        },
        status: { 
          type: String, 
          enum: ['pending', 'in_progress', 'completed', 'overdue', 'cancelled'],
          default: 'pending'
        },
        completedAt: Date,
        completedBy: String,
        notes: String,
        photos: [String],
        syncStatus: { 
          type: String, 
          enum: ['pending', 'synced', 'failed'],
          default: 'synced'
        },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
      });
      
      mongoose.model('Task', taskSchema);
      console.log('   ✅ Task model loaded');
    }

    // Alert Model
    if (!mongoose.models.Alert) {
      const alertSchema = new mongoose.Schema({
        farmerId: { 
          type: mongoose.Schema.Types.ObjectId, 
          ref: 'Farmer',
          required: true
        },
        type: { 
          type: String, 
          required: true,
          enum: ['weather', 'pest', 'disease', 'irrigation', 'market', 'system', 'reminder']
        },
        title: { type: String, required: true },
        message: { type: String, required: true },
        priority: { 
          type: String, 
          enum: ['low', 'medium', 'high', 'critical'],
          default: 'medium'
        },
        read: { type: Boolean, default: false },
        actionRequired: { type: Boolean, default: false },
        actions: [{
          label: String,
          action: String,
          url: String
        }],
        data: mongoose.Schema.Types.Mixed,
        source: String,
        expiresAt: Date,
        createdAt: { type: Date, default: Date.now }
      });
      
      mongoose.model('Alert', alertSchema);
      console.log('   🔔 Alert model loaded');
    }

    // Session Model
    if (!mongoose.models.Session) {
      const sessionSchema = new mongoose.Schema({
        farmerId: { 
          type: mongoose.Schema.Types.ObjectId, 
          ref: 'Farmer',
          required: true
        },
        token: { type: String, required: true, unique: true },
        deviceInfo: {
          deviceId: String,
          platform: String,
          appVersion: String,
          osVersion: String,
          model: String
        },
        lastActivity: { type: Date, default: Date.now },
        expiresAt: { type: Date, required: true },
        syncState: {
          lastSync: Date,
          pendingOperations: Number,
          offlineDataSize: Number
        },
        createdAt: { type: Date, default: Date.now }
      });
      
      mongoose.model('Session', sessionSchema);
      console.log('   🔐 Session model loaded');
    }

    // OfflineOperation Model
    if (!mongoose.models.OfflineOperation) {
      const offlineOperationSchema = new mongoose.Schema({
        operationId: { type: String, required: true, unique: true },
        farmerId: { 
          type: mongoose.Schema.Types.ObjectId, 
          ref: 'Farmer'
        },
        type: { 
          type: String, 
          required: true,
          enum: [
            'create_farm', 
            'update_farm', 
            'crop_observation', 
            'task_completion', 
            'sensor_data', 
            'weather_data',
            'ai_prediction',
            'farmer_feedback'
          ]
        },
        data: mongoose.Schema.Types.Mixed,
        status: { 
          type: String, 
          enum: ['pending', 'processing', 'completed', 'failed', 'conflict'],
          default: 'pending'
        },
        retries: { type: Number, default: 0 },
        priority: { 
          type: String, 
          enum: ['low', 'normal', 'high', 'critical'],
          default: 'normal'
        },
        metadata: {
          deviceId: String,
          offline: Boolean,
          uploadedAt: Date,
          originalTimestamp: Date
        },
        error: String,
        conflictData: mongoose.Schema.Types.Mixed,
        syncedAt: Date,
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
      });
      
      mongoose.model('OfflineOperation', offlineOperationSchema);
      console.log('   🔄 OfflineOperation model loaded');
    }

    // SMSLog Model
    if (!mongoose.models.SMSLog) {
      const smsLogSchema = new mongoose.Schema({
        farmerId: { 
          type: mongoose.Schema.Types.ObjectId, 
          ref: 'Farmer'
        },
        phone: { type: String, required: true },
        message: { type: String, required: true },
        provider: { 
          type: String, 
          enum: ['africas_talking', 'mtn_uganda', 'twilio', 'vonage'],
          required: true
        },
        messageId: String,
        status: { 
          type: String, 
          enum: ['queued', 'sent', 'delivered', 'failed', 'unknown'],
          default: 'unknown'
        },
        cost: Number,
        direction: { 
          type: String, 
          enum: ['outgoing', 'incoming'],
          default: 'outgoing'
        },
        ussdSessionId: String,
        response: mongoose.Schema.Types.Mixed,
        createdAt: { type: Date, default: Date.now }
      });
      
      mongoose.model('SMSLog', smsLogSchema);
      console.log('   📨 SMSLog model loaded');
    }

    // Payment Model
    if (!mongoose.models.Payment) {
      const paymentSchema = new mongoose.Schema({
        farmerId: { 
          type: mongoose.Schema.Types.ObjectId, 
          ref: 'Farmer',
          required: true
        },
        transactionId: { type: String, required: true, unique: true },
        provider: { 
          type: String, 
          enum: ['flutterwave', 'stripe', 'mpesa', 'airtel_money', 'mtn_momo'],
          required: true
        },
        amount: { type: Number, required: true },
        currency: { type: String, default: 'USD' },
        purpose: { 
          type: String, 
          enum: ['subscription', 'product_purchase', 'service', 'donation', 'other']
        },
        status: { 
          type: String, 
          enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
          default: 'pending'
        },
        metadata: {
          productId: String,
          subscriptionPlan: String,
          paymentMethod: String,
          customerEmail: String
        },
        providerResponse: mongoose.Schema.Types.Mixed,
        completedAt: Date,
        createdAt: { type: Date, default: Date.now }
      });
      
      mongoose.model('Payment', paymentSchema);
      console.log('   💳 Payment model loaded');
    }

    // MarketPrice Model
    if (!mongoose.models.MarketPrice) {
      const marketPriceSchema = new mongoose.Schema({
        crop: { 
          type: String, 
          required: true,
          enum: ['maize', 'cassava', 'beans', 'coffee', 'banana', 'tomatoes', 'onions', 'potatoes']
        },
        market: { type: String, required: true },
        region: { type: String, required: true },
        price: { type: Number, required: true },
        unit: { type: String, default: 'kg' },
        currency: { type: String, default: 'UGX' },
        quality: { 
          type: String, 
          enum: ['grade_a', 'grade_b', 'grade_c', 'mixed'],
          default: 'mixed'
        },
        source: { 
          type: String, 
          enum: ['government', 'association', 'trader', 'farmer', 'api'],
          default: 'trader'
        },
        trend: { 
          type: String, 
          enum: ['rising', 'falling', 'stable', 'unknown'],
          default: 'unknown'
        },
        changePercentage: Number,
        validFrom: { type: Date, required: true },
        validTo: Date,
        notes: String,
        syncStatus: { 
          type: String, 
          enum: ['pending', 'synced', 'failed'],
          default: 'synced'
        },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
      });
      
      mongoose.model('MarketPrice', marketPriceSchema);
      console.log('   📊 MarketPrice model loaded');
    }

    console.log(`✅ Total MongoDB models loaded: ${Object.keys(mongoose.models).length}`);
    this.modelsLoaded = true;
  }

  async loadPostgreSQLModels() {
    if (!this.postgresConnection) {
      console.log('📝 PostgreSQL: No connection available, skipping model loading');
      return;
    }

    console.log('📦 Loading PostgreSQL models...');

    try {
      const rawSensorData = this.postgresConnection.define('raw_sensor_data', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        device_id: {
          type: Sequelize.STRING,
          allowNull: false
        },
        farm_id: {
          type: Sequelize.STRING,
          allowNull: true
        },
        sensor_type: {
          type: Sequelize.ENUM(
            'soil_moisture',
            'temperature',
            'humidity',
            'rainfall',
            'ph',
            'nutrient_level',
            'wind_speed',
            'wind_direction',
            'solar_radiation',
            'pressure'
          ),
          allowNull: false
        },
        value: {
          type: Sequelize.DECIMAL(10, 4),
          allowNull: false
        },
        unit: {
          type: Sequelize.STRING(20),
          defaultValue: ''
        },
        latitude: {
          type: Sequelize.DECIMAL(10, 8),
          allowNull: true
        },
        longitude: {
          type: Sequelize.DECIMAL(11, 8),
          allowNull: true
        },
        accuracy: {
          type: Sequelize.DECIMAL(6, 2),
          allowNull: true
        },
        battery_level: {
          type: Sequelize.DECIMAL(5, 2),
          allowNull: true
        },
        signal_strength: {
          type: Sequelize.INTEGER,
          allowNull: true
        },
        metadata: {
          type: Sequelize.JSONB,
          defaultValue: {}
        },
        created_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW
        }
      }, {
        tableName: 'raw_sensor_data',
        timestamps: false
      });

      const aggregatedSensorData = this.postgresConnection.define('aggregated_sensor_data', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        device_id: {
          type: Sequelize.STRING,
          allowNull: false
        },
        farm_id: {
          type: Sequelize.STRING,
          allowNull: true
        },
        sensor_type: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        aggregation_period: {
          type: Sequelize.ENUM('hourly', 'daily', 'weekly', 'monthly'),
          allowNull: false
        },
        period_start: {
          type: Sequelize.DATE,
          allowNull: false
        },
        period_end: {
          type: Sequelize.DATE,
          allowNull: false
        },
        avg_value: {
          type: Sequelize.DECIMAL(10, 4),
          allowNull: false
        },
        min_value: {
          type: Sequelize.DECIMAL(10, 4),
          allowNull: false
        },
        max_value: {
          type: Sequelize.DECIMAL(10, 4),
          allowNull: false
        },
        std_dev: {
          type: Sequelize.DECIMAL(10, 4),
          allowNull: true
        },
        sample_count: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        unit: {
          type: Sequelize.STRING(20),
          defaultValue: ''
        },
        metadata: {
          type: Sequelize.JSONB,
          defaultValue: {}
        },
        created_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW
        }
      }, {
        tableName: 'aggregated_sensor_data',
        timestamps: false
      });

      const deviceRegistry = this.postgresConnection.define('device_registry', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        device_id: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true
        },
        farm_id: {
          type: Sequelize.STRING,
          allowNull: true
        },
        device_type: {
          type: Sequelize.ENUM(
            'weather_station',
            'soil_sensor',
            'camera_trap',
            'irrigation_controller',
            'gateway',
            'drone'
          ),
          allowNull: false
        },
        manufacturer: {
          type: Sequelize.STRING(100),
          allowNull: true
        },
        model: {
          type: Sequelize.STRING(100),
          allowNull: true
        },
        firmware_version: {
          type: Sequelize.STRING(50),
          allowNull: true
        },
        capabilities: {
          type: Sequelize.JSONB,
          defaultValue: []
        },
        location: {
          type: Sequelize.JSONB,
          defaultValue: {}
        },
        install_date: {
          type: Sequelize.DATE,
          allowNull: true
        },
        last_seen: {
          type: Sequelize.DATE,
          allowNull: true
        },
        status: {
          type: Sequelize.ENUM('active', 'inactive', 'maintenance', 'offline'),
          defaultValue: 'active'
        },
        health_metrics: {
          type: Sequelize.JSONB,
          defaultValue: {}
        },
        configuration: {
          type: Sequelize.JSONB,
          defaultValue: {}
        },
        metadata: {
          type: Sequelize.JSONB,
          defaultValue: {}
        },
        created_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW
        }
      }, {
        tableName: 'device_registry',
        timestamps: false
      });

      const alertRules = this.postgresConnection.define('alert_rules', {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        name: {
          type: Sequelize.STRING(200),
          allowNull: false
        },
        device_id: {
          type: Sequelize.STRING,
          allowNull: true
        },
        farm_id: {
          type: Sequelize.STRING,
          allowNull: true
        },
        sensor_type: {
          type: Sequelize.STRING(50),
          allowNull: true
        },
        condition_type: {
          type: Sequelize.ENUM('threshold', 'rate_of_change', 'pattern', 'missing_data'),
          allowNull: false
        },
        condition_params: {
          type: Sequelize.JSONB,
          allowNull: false
        },
        severity: {
          type: Sequelize.ENUM('low', 'medium', 'high', 'critical'),
          defaultValue: 'medium'
        },
        notification_channels: {
          type: Sequelize.JSONB,
          defaultValue: ['email', 'sms']
        },
        enabled: {
          type: Sequelize.BOOLEAN,
          defaultValue: true
        },
        cooldown_minutes: {
          type: Sequelize.INTEGER,
          defaultValue: 30
        },
        last_triggered: {
          type: Sequelize.DATE,
          allowNull: true
        },
        metadata: {
          type: Sequelize.JSONB,
          defaultValue: {}
        },
        created_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW
        }
      }, {
        tableName: 'alert_rules',
        timestamps: false
      });

      console.log('   📱 PostgreSQL models loaded');
      
      this.postgresModels = {
        rawSensorData,
        aggregatedSensorData,
        deviceRegistry,
        alertRules
      };

    } catch (error) {
      console.error('❌ Failed to load PostgreSQL models:', error);
      throw error;
    }
  }

  async runMigrations() {
    console.log('🔄 Running database migrations...');
    
    try {
      await this.createMongoIndexes();
      
      if (this.postgresConnection) {
        await this.syncPostgresTables();
      }
      
      console.log('✅ Database migrations completed');
    } catch (error) {
      console.error('❌ Database migrations failed:', error);
      throw error;
    }
  }

  async createMongoIndexes() {
    console.log('   📊 Creating MongoDB indexes...');
    
    try {
      // Wait for connection to be ready
      if (mongoose.connection.readyState !== 1) {
        await new Promise(resolve => mongoose.connection.once('connected', resolve));
      }

      // Create indexes only once
      const models = mongoose.models;
      for (const [modelName, model] of Object.entries(models)) {
        try {
          await model.createIndexes();
          console.log(`     ✅ Indexes created for ${modelName}`);
        } catch (error) {
          if (!error.message.includes('index with name')) {
            console.warn(`     ⚠️ Failed to create indexes for ${modelName}:`, error.message);
          }
        }
      }
      
      console.log('   ✅ MongoDB indexes creation complete');
    } catch (error) {
      console.error('   ❌ MongoDB index creation failed:', error);
    }
  }

  async syncPostgresTables() {
    if (!this.postgresConnection) {
      return;
    }
    
    console.log('   💾 Synchronizing PostgreSQL tables...');
    
    try {
      const syncOptions = process.env.NODE_ENV === 'development' 
        ? { alter: true } 
        : { force: false };
      
      await this.postgresConnection.sync(syncOptions);
      console.log('   ✅ PostgreSQL tables synchronized');
    } catch (error) {
      console.error('   ❌ PostgreSQL table sync failed:', error);
    }
  }

  async initializeDatabases() {
    try {
      console.log('🚀 Initializing databases...');
      
      const mongoConn = await this.connectMongoDB();
      await this.loadMongoModels();
      
      const postgresConn = await this.connectPostgreSQL();
      if (postgresConn) {
        await this.loadPostgreSQLModels();
      }
      
      await this.runMigrations();
      
      console.log('✅ Databases initialized successfully');
      
      return {
        mongoDB: mongoConn,
        postgreSQL: postgresConn,
        mongoModels: mongoose.models,
        postgresModels: this.postgresModels || {}
      };
    } catch (error) {
      console.error('💥 Database initialization failed:', error);
      throw error;
    }
  }

  async closeConnections() {
    console.log('🔌 Closing database connections...');
    
    try {
      if (this.mongoConnection) {
        await mongoose.disconnect();
        this.mongoConnection = null;
        console.log('✅ MongoDB connection closed');
      }
      
      if (this.postgresConnection) {
        await this.postgresConnection.close();
        this.postgresConnection = null;
        console.log('✅ PostgreSQL connection closed');
      }
      
      this.modelsLoaded = false;
    } catch (error) {
      console.error('❌ Error closing database connections:', error);
    }
  }

  async healthCheck() {
    const health = {
      mongodb: 'disconnected',
      postgresql: 'disconnected',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };
    
    try {
      if (this.mongoConnection && mongoose.connection.readyState === 1) {
        health.mongodb = 'connected';
        health.mongodb_details = {
          host: mongoose.connection.host,
          database: mongoose.connection.name,
          collections: Object.keys(mongoose.connection.collections).length
        };
      }
      
      if (this.postgresConnection) {
        try {
          await this.postgresConnection.authenticate();
          health.postgresql = 'connected';
          health.postgresql_details = {
            database: this.postgresConnection.config.database,
            host: this.postgresConnection.config.host
          };
        } catch (error) {
          health.postgresql = 'disconnected';
          health.postgresql_error = error.message;
        }
      }
      
      return health;
    } catch (error) {
      health.error = error.message;
      return health;
    }
  }

  getMongoModel(name) {
    if (!mongoose.models[name]) {
      throw new Error(`Model ${name} not found. Did you load the models first?`);
    }
    return mongoose.models[name];
  }

  getPostgresModel(name) {
    if (!this.postgresModels || !this.postgresModels[name]) {
      throw new Error(`PostgreSQL model ${name} not found or PostgreSQL not connected`);
    }
    return this.postgresModels[name];
  }
}

const databaseService = new DatabaseService();
export default databaseService;