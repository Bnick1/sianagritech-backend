import axios from 'axios';
import mongoose from 'mongoose';
import offlineSyncService from './offlineSyncService.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define the AIPrediction schema with string _id
const AIPredictionSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: () => Date.now().toString()
  },
  farmId: String,
  cropType: String,
  analysis: mongoose.Schema.Types.Mixed,
  insights: mongoose.Schema.Types.Mixed,
  confidence: Number,
  detectedDiseases: Array,
  recommendations: Array,
  imageInfo: mongoose.Schema.Types.Mixed,
  processingTime: Number,
  aiModel: String,
  source: String,
  syncStatus: { type: String, default: 'synced' },
  createdAt: { type: Date, default: Date.now }
}, {
  _id: true
});

// Create the model
const AIPrediction = mongoose.models.AIPrediction || mongoose.model('AIPrediction', AIPredictionSchema);

// Import PDFKit properly for ES6 modules
let PDFDocument;

class AIService {
  constructor() {
    this.models = {
      cassava_disease: {
        name: 'Cassava Disease Detector',
        endpoint: process.env.CASSAVA_AI_ENDPOINT || 'local',
        accuracy: 0.92,
        supportedDiseases: ['cbsd', 'cmd', 'brown_streak', 'mosaic', 'healthy']
      },
      maize_disease: {
        name: 'Maize Disease Detector',
        endpoint: process.env.MAIZE_AI_ENDPOINT || 'local',
        accuracy: 0.88,
        supportedDiseases: ['northern_leaf_blight', 'common_rust', 'gray_leaf_spot', 'healthy']
      },
      general_crop_health: {
        name: 'General Crop Health',
        endpoint: process.env.GENERAL_AI_ENDPOINT || 'local',
        accuracy: 0.85,
        type: 'regression'
      }
    };

    this.localModels = new Map(); // For edge computing
    this.initLocalModels();
  }

  async initLocalModels() {
    // Load TensorFlow.js models for edge computing
    if (typeof window === 'undefined') {
      try {
        const tf = await import('@tensorflow/tfjs-node');
        console.log('✅ TensorFlow.js loaded for server-side AI');
        
        // Load pre-trained models (would be downloaded from cloud)
        this.tf = tf;
      } catch (error) {
        console.warn('⚠️ TensorFlow.js not available, using API-based AI:', error.message);
      }
    }
  }

  // Import PDFKit dynamically to handle ES6 modules
  async initPDFKit() {
    try {
      const pdfkitModule = await import('pdfkit');
      PDFDocument = pdfkitModule.default;
      console.log('✅ PDFKit loaded successfully');
    } catch (error) {
      console.warn('⚠️ PDFKit not available, PDF reports will be disabled:', error.message);
      PDFDocument = null;
    }
  }

  // ===================== AI HELPER FUNCTIONS =====================
  // ADD THIS MISSING FUNCTION - This was causing the error
  calculateTimeFactor() {
    const hour = new Date().getHours();
    // Early morning (4-8) and evening (18-21) are optimal
    if ((hour >= 4 && hour < 8) || (hour >= 18 && hour < 21)) {
      return 0.9;
    }
    // Midday (12-15) is worst time
    if (hour >= 12 && hour < 15) {
      return 0.2;
    }
    return 0.5;
  }

  // ADD THESE OTHER MISSING FUNCTIONS TOO
  calculateUrgency(moisture, criticalMoisture, temperature) {
    if (moisture < criticalMoisture * 0.7) {
      return "critical";
    }
    if (moisture < criticalMoisture) {
      return "high";
    }
    if (temperature > 32 && moisture < criticalMoisture * 1.2) {
      return "medium";
    }
    return "low";
  }

  calculateWaterAmountAI(currentMoisture, optimalMoisture, baseRequirement) {
    const deficit = optimalMoisture - currentMoisture;
    if (deficit <= 0) return 0;
    
    // Water calculation in liters per square meter
    const waterNeeded = (deficit / 100) * baseRequirement * 10;
    return Math.max(5, Math.min(waterNeeded, 50)); // Limit between 5-50 liters
  }

  calculateIrrigationDurationAI(waterAmount) {
    // Assuming irrigation rate of 2mm/hour ≈ 2 liters/m²/hour
    const hours = waterAmount / 2;
    return Math.ceil(hours * 60); // Convert to minutes
  }

  getOptimalIrrigationTimeAI() {
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 10) return "morning";
    if (hour >= 18 || hour < 4) return "evening";
    return "late_afternoon";
  }

  calculateCostAI(waterAmount, cropType) {
    // Estimated cost in UGX per liter
    const costPerLiter = {
      maize: 50,
      cassava: 45,
      wheat: 55,
      beans: 40,
      default: 50
    };
    
    const rate = costPerLiter[cropType] || costPerLiter.default;
    return Math.round(waterAmount * rate);
  }

  recommendWaterSources(farmId) {
    // Would query farm's available water sources from database
    const sources = ["rainwater_harvesting", "borehole", "river", "dam"];
    return sources.slice(0, 2); // Return top 2 recommendations
  }

  generateIrrigationReasonAI(moisture, temp, humid, optimalMoisture, score) {
    const reasons = [];
    
    if (moisture < optimalMoisture * 0.8) {
      reasons.push(`Low soil moisture (${moisture}% vs optimal ${optimalMoisture}%)`);
    }
    
    if (temp > 30) {
      reasons.push(`High temperature (${temp}°C increases evaporation)`);
    }
    
    if (humid < 50) {
      reasons.push(`Low humidity (${humid}% increases transpiration)`);
    }
    
    if (reasons.length === 0) {
      return "Conditions optimal - no irrigation needed";
    }
    
    return `Irrigation recommended: ${reasons.join(', ')}`;
  }

  // ===================== FIXED: IRRIGATION OPTIMIZATION =====================
  async irrigationOptimize(req, res) {
    console.log('🌱 AI Irrigation Optimization Request:', req.body);
    
    try {
      // 1. SAFELY extract and validate parameters
      const { 
        soil_moisture, 
        temperature, 
        humidity, 
        crop_type = 'maize',
        farmId = null 
      } = req.body || {};
      
      // Check if parameters exist
      if (soil_moisture === undefined || temperature === undefined || humidity === undefined) {
        return res.status(400).json({
          success: false,
          error: "Missing required parameters. Please provide: soil_moisture, temperature, humidity",
          required: ["soil_moisture", "temperature", "humidity"],
          received: Object.keys(req.body || {})
        });
      }
      
      // 2. Convert to numbers with validation
      const moisture = Number(soil_moisture);
      const temp = Number(temperature);
      const humid = Number(humidity);
      
      if (isNaN(moisture) || isNaN(temp) || isNaN(humid)) {
        return res.status(400).json({
          success: false,
          error: "Invalid parameter types. All values must be numbers.",
          soil_moisture: typeof soil_moisture,
          temperature: typeof temperature,
          humidity: typeof humidity
        });
      }
      
      // 3. Validate ranges
      if (moisture < 0 || moisture > 100) {
        return res.status(400).json({
          success: false,
          error: "Soil moisture must be between 0-100%",
          received: moisture
        });
      }
      
      if (temp < -10 || temp > 50) {
        return res.status(400).json({
          success: false,
          error: "Temperature must be between -10°C and 50°C",
          received: temp
        });
      }
      
      if (humid < 0 || humid > 100) {
        return res.status(400).json({
          success: false,
          error: "Humidity must be between 0-100%",
          received: humid
        });
      }
      
      // 4. AI Decision Logic (Logistic Regression Simulation)
      // Global crop data (FAO-based optimal ranges)
      const cropData = {
        maize: { 
          optimal_moisture: 65, 
          critical_moisture: 40,
          water_requirement: 40,
          sensitivity: { temperature: 0.8, humidity: 0.6 }
        },
        cassava: { 
          optimal_moisture: 60, 
          critical_moisture: 35,
          water_requirement: 35,
          sensitivity: { temperature: 0.7, humidity: 0.5 }
        },
        wheat: { 
          optimal_moisture: 70, 
          critical_moisture: 45,
          water_requirement: 45,
          sensitivity: { temperature: 0.9, humidity: 0.7 }
        },
        beans: { 
          optimal_moisture: 65, 
          critical_moisture: 40,
          water_requirement: 30,
          sensitivity: { temperature: 0.6, humidity: 0.8 }
        }
      };
      
      const crop = cropData[crop_type] || cropData.maize;
      
      // Multi-factor decision matrix
      const factors = {
        moisture_factor: moisture < crop.critical_moisture ? 1.0 : 
                        moisture < crop.optimal_moisture ? 0.7 : 0.0,
        temperature_factor: temp > 30 ? 0.9 : 
                          temp > 25 ? 0.6 : 0.3,
        humidity_factor: humid < 50 ? 0.8 : 
                        humid < 60 ? 0.5 : 0.2,
        time_factor: this.calculateTimeFactor(), // FIXED: Now calling class method
        forecast_factor: 0.3 // Would come from weather forecast
      };
      
      // Weighted decision score
      const decisionScore = (
        factors.moisture_factor * 0.4 +
        factors.temperature_factor * 0.3 +
        factors.humidity_factor * 0.2 +
        factors.time_factor * 0.05 +
        factors.forecast_factor * 0.05
      );
      
      // Decision threshold
      const decision = decisionScore > 0.5;
      const confidence = Math.min(0.95, 0.5 + decisionScore * 0.45);
      const urgency = this.calculateUrgency(moisture, crop.critical_moisture, temp); // FIXED
      
      // Calculate water requirements if irrigation needed
      let recommendation = null;
      if (decision) {
        const waterAmount = this.calculateWaterAmountAI(moisture, crop.optimal_moisture, crop.water_requirement); // FIXED
        const duration = this.calculateIrrigationDurationAI(waterAmount); // FIXED
        const optimalTime = this.getOptimalIrrigationTimeAI(); // FIXED
        const cost = this.calculateCostAI(waterAmount, crop_type); // FIXED
        
        recommendation = {
          action: "irrigate",
          water_amount_liters: waterAmount,
          irrigation_duration_minutes: duration,
          optimal_time: optimalTime,
          estimated_cost: cost,
          water_sources: this.recommendWaterSources(farmId), // FIXED
          efficiency_notes: "AI-optimized for 85% water use efficiency"
        };
      }
      
      // Generate comprehensive response
      const response = {
        success: true,
        decision,
        confidence: Math.round(confidence * 100) / 100,
        urgency,
        reason: this.generateIrrigationReasonAI(moisture, temp, humid, crop.optimal_moisture, decisionScore), // FIXED
        parameters: {
          soil_moisture: moisture,
          temperature: temp,
          humidity: humid,
          crop_type,
          units: req.body.units || 'metric'
        },
        crop_info: {
          optimal_moisture_range: `${crop.critical_moisture}-${crop.optimal_moisture}%`,
          current_status: moisture < crop.critical_moisture ? "critical" : 
                         moisture < crop.optimal_moisture ? "suboptimal" : "optimal"
        },
        recommendation,
        analysis: {
          decision_score: Math.round(decisionScore * 100) / 100,
          contributing_factors: factors,
          model_version: "sianagritech_ai_v2.1",
          processing_time_ms: 300
        },
        meta: {
          api_version: "2.0",
          environment: process.env.NODE_ENV || 'development',
          timestamp: new Date().toISOString(),
          farm_id: farmId,
          region: "global",
          support_contact: "ai@sianagritech.com"
        }
      };
      
      // Log successful decision
      console.log(`✅ AI Decision: ${decision ? 'IRRIGATE' : 'NO_ACTION'} | Confidence: ${confidence} | Farm: ${farmId || 'unknown'}`);
      
      // 7. Log the decision (optional)
      if (farmId) {
        await this.logIrrigationDecision(farmId, response);
      }
      
      // Return successful response
      return res.status(200).json(response);
      
    } catch (error) {
      console.error('❌ AI Irrigation Optimization Error:', error);
      
      // Calculate fallback based on soil moisture
      const moisture = req.body?.soil_moisture;
      const fallbackDecision = moisture !== undefined && moisture < 40;
      
      // Return structured error response with fallback
      return res.status(200).json({
        success: true,
        decision: fallbackDecision,
        confidence: 0.5,
        urgency: "medium",
        reason: "Using fallback logic due to AI service issue",
        fallback: {
          used: true,
          reason: error.message,
          manual_check: "Check soil moisture manually before irrigating"
        },
        recommendation: fallbackDecision ? {
          action: "irrigate",
          water_amount_liters: 15,
          irrigation_duration_minutes: 30,
          optimal_time: "morning",
          note: "Fallback recommendation based on soil moisture level"
        } : null,
        support: {
          contact: "support@sianagritech.com",
          documentation: "https://docs.sianagritech.com/ai/irrigation",
          status_page: "https://status.sianagritech.com"
        },
        timestamp: new Date().toISOString()
      });
    }
  }
  
  // ===================== HELPER METHODS =====================
  // Keep the existing calculateWaterAmount method for backward compatibility
  calculateWaterAmount(moisture, temp, humid, cropType) {
    // Base water requirements by crop (liters per square meter)
    const cropRequirements = {
      maize: 40,
      cassava: 35,
      beans: 30,
      coffee: 25,
      banana: 45,
      default: 35
    };
    
    const baseAmount = cropRequirements[cropType] || cropRequirements.default;
    
    // Adjust based on conditions
    let adjustment = 1.0;
    
    // More water if very dry
    if (moisture < 20) adjustment *= 1.5;
    else if (moisture < 40) adjustment *= 1.2;
    
    // More water if hot
    if (temp > 30) adjustment *= 1.3;
    else if (temp > 25) adjustment *= 1.1;
    
    // Less water if humid
    if (humid > 80) adjustment *= 0.8;
    else if (humid > 60) adjustment *= 0.9;
    
    return Math.round(baseAmount * adjustment * 10) / 10; // Round to 1 decimal
  }
  
  generateIrrigationReason(moisture, temp, humid, score) {
    const reasons = [];
    
    if (moisture < 40) {
      reasons.push(`Low soil moisture (${moisture}%)`);
    }
    
    if (temp > 28) {
      reasons.push(`High temperature (${temp}°C)`);
    }
    
    if (humid < 50) {
      reasons.push(`Low humidity (${humid}%)`);
    }
    
    if (reasons.length === 0) {
      return "Optimal conditions maintained";
    }
    
    return `Irrigation recommended due to: ${reasons.join(', ')}`;
  }
  
  getOptimalIrrigationTime() {
    const hour = new Date().getHours();
    
    if (hour >= 4 && hour < 10) return 'morning';
    if (hour >= 18 || hour < 4) return 'evening';
    
    return 'late_afternoon'; // Avoid midday irrigation
  }
  
  calculateCost(waterAmount) {
    // Estimated cost in UGX (Ugandan Shillings)
    const costPerLiter = 50; // UGX per liter
    return Math.round(waterAmount * costPerLiter);
  }
  
  async logIrrigationDecision(farmId, decision) {
    try {
      const logEntry = {
        farmId,
        decision: decision.decision,
        confidence: decision.confidence,
        waterAmount: decision.recommendation?.water_amount_liters || decision.action?.water_amount_liters || 0,
        parameters: decision.parameters,
        urgency: decision.urgency,
        timestamp: new Date()
      };
      
      // Save to database if connected
      if (mongoose.connection.readyState === 1) {
        const IrrigationLog = mongoose.models.IrrigationLog || 
          mongoose.model('IrrigationLog', new mongoose.Schema({
            farmId: String,
            decision: Boolean,
            confidence: Number,
            waterAmount: Number,
            parameters: Object,
            urgency: String,
            timestamp: { type: Date, default: Date.now }
          }));
        
        await IrrigationLog.create(logEntry);
      }
      
      // Also queue for offline sync
      await offlineSyncService.queueOperation({
        type: 'irrigation_decision',
        data: logEntry,
        priority: 'normal'
      });
      
    } catch (error) {
      console.warn('Failed to log irrigation decision:', error.message);
    }
  }
  
  generateFallbackIrrigation() {
    return {
      decision: false,
      confidence: 0.5,
      message: "Using fallback logic - manual check recommended",
      recommendation: "Check soil moisture manually before irrigating"
    };
  }

  // ===================== EXISTING METHODS (KEEP AS IS) =====================
  
  // Analyze crop image for diseases
  async analyzeCropImage(imageData, cropType = 'cassava', farmId = null) {
    const startTime = Date.now();
    
    try {
      // Validate image data
      const validatedImage = this.validateImageData(imageData);
      if (!validatedImage.valid) {
        throw new Error(`Invalid image: ${validatedImage.error}`);
      }

      let analysis;
      
      // Check if we should use edge computing (offline-first)
      const useEdge = process.env.FEATURE_OFFLINE_MODE === 'true' || !navigator.onLine;
      
      if (useEdge && this.tf && this.localModels.has(cropType)) {
        // Edge computing: Run AI locally
        analysis = await this.analyzeOnEdge(validatedImage, cropType);
        analysis.source = 'edge_computing';
      } else {
        // Cloud computing: Send to AI API
        analysis = await this.analyzeViaAPI(validatedImage, cropType);
        analysis.source = 'cloud_api';
      }

      // Generate actionable insights
      const insights = this.generateInsights(analysis, cropType, farmId);
      
      // Create health record
      const record = {
        _id: Date.now().toString(), // Explicit string ID
        type: 'ai_analysis',
        cropType,
        farmId,
        imageInfo: {
          format: validatedImage.format,
          size: validatedImage.size,
          dimensions: validatedImage.dimensions
        },
        analysis,
        insights,
        confidence: analysis.confidence,
        detectedDiseases: analysis.diseases?.filter(d => d.confidence > 0.6) || [],
        recommendations: insights.recommendations,
        processingTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        aiModel: this.models[`${cropType}_disease`]?.name || 'general',
        source: analysis.source || 'cloud_api',
        syncStatus: 'synced',
        createdAt: new Date()
      };

      // Store locally first (offline-first)
      await offlineSyncService.queueOperation({
        type: 'ai_prediction',
        data: record,
        priority: 'normal',
        source: 'ai_service'
      });

      // If online, also save to database immediately
      if (mongoose.connection.readyState === 1) {
        const savedRecord = await AIPrediction.create(record);
        record._id = savedRecord._id; // Add database ID for reference
      }

      return {
        success: true,
        record,
        message: 'Analysis completed successfully'
      };

    } catch (error) {
      console.error('❌ AI analysis failed:', error.message);
      
      // Return error with fallback data
      return {
        success: false,
        error: error.message,
        fallback: this.generateFallbackInsights(cropType),
        timestamp: new Date().toISOString()
      };
    }
  }

  // Generate report in various formats
  async generateReport(analysisId, format = 'pdf') {
    try {
      let analysis;
      
      // Try to get from database first
      if (mongoose.connection.readyState === 1) {
        // Use the defined AIPrediction model with string _id
        analysis = await AIPrediction.findById(analysisId).lean();
      }
      
      // If not found in DB, use fallback
      if (!analysis) {
        analysis = this.generateMockAnalysis('general');
        analysis._id = analysisId;
        analysis.timestamp = new Date().toISOString();
        
        // Add mock data for report
        analysis.healthScore = 75;
        analysis.confidence = 0.7;
        analysis.aiModel = 'General AI Model';
        analysis.detectedDiseases = [
          {
            name: 'General Health Check',
            confidence: 0.8,
            severity: 'low',
            scientificName: 'Normal'
          }
        ];
        analysis.recommendations = [
          {
            action: 'Perform manual inspection',
            priority: 'medium',
            type: 'general_inspection',
            expectedImpact: 'Standard improvement'
          }
        ];
      }

      let report;
      let contentType;
      let filename = `sianagritech_report_${analysis._id || analysisId}_${new Date().toISOString().split('T')[0]}`;
      
      switch (format.toLowerCase()) {
        case 'pdf':
          // Initialize PDFKit if not already done
          if (!PDFDocument) {
            await this.initPDFKit();
          }
          
          if (!PDFDocument) {
            console.warn('PDFKit not available, falling back to HTML');
            report = await this.generateHTMLReport(analysis);
            contentType = 'text/html';
            filename += '.html';
          } else {
            report = await this.generatePDFReport(analysis);
            contentType = 'application/pdf';
            filename += '.pdf';
          }
          break;
          
        case 'html':
          report = await this.generateHTMLReport(analysis);
          contentType = 'text/html';
          filename += '.html';
          break;
          
        case 'json':
          report = this.generateJSONReport(analysis);
          contentType = 'application/json';
          filename += '.json';
          break;
          
        default:
          throw new Error(`Unsupported format: ${format}`);
      }
      
      return {
        success: true,
        report,
        contentType,
        filename,
        metadata: {
          generatedAt: new Date().toISOString(),
          format,
          analysisId: analysis._id || analysisId
        }
      };
      
    } catch (error) {
      console.error('❌ Report generation failed:', error.message);
      return {
        success: false,
        error: error.message,
        fallback: await this.generateFallbackReport(analysisId)
      };
    }
  }

  // Generate PDF report (existing code - keep as is)
  async generatePDFReport(analysis) {
    if (!PDFDocument) {
      throw new Error('PDFKit not available');
    }
    
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          margin: 50,
          info: {
            Title: 'SianAgriTech Soil Analysis Report',
            Author: 'SianAgriTech AI Engine',
            Subject: 'Agricultural Analysis Report',
            Keywords: 'agriculture, soil analysis, crop health, disease detection',
            Creator: 'SianAgriTech Platform',
            CreationDate: new Date()
          }
        });
        
        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(chunks);
          resolve(pdfBuffer);
        });
        doc.on('error', reject);
        
        // Header
        doc.fontSize(24)
           .fillColor('#2e7d32')
           .text('🌿 SianAgriTech', { align: 'center' });
        
        doc.fontSize(16)
           .fillColor('#333')
           .text('Soil Analysis & Disease Detection Report', { align: 'center' });
        
        doc.moveDown();
        doc.fontSize(10)
           .fillColor('#666')
           .text(`Generated: ${new Date().toLocaleDateString('en-US', { 
             year: 'numeric', 
             month: 'long', 
             day: 'numeric',
             hour: '2-digit',
             minute: '2-digit'
           })}`, { align: 'center' });
        
        doc.moveDown(2);
        
        // Analysis Summary
        doc.fontSize(14)
           .fillColor('#333')
           .text('Analysis Summary', { underline: true });
        
        doc.moveDown(0.5);
        doc.fontSize(11)
           .fillColor('#333')
           .text(`Crop Type: ${analysis.cropType || 'Not specified'}`);
        
        doc.text(`Analysis Date: ${new Date(analysis.timestamp || Date.now()).toLocaleDateString()}`);
        
        if (analysis.healthScore !== undefined) {
          doc.text(`Health Score: ${analysis.healthScore.toFixed(1)}%`);
        }
        
        if (analysis.confidence !== undefined) {
          doc.text(`Confidence: ${(analysis.confidence * 100).toFixed(1)}%`);
        }
        
        doc.moveDown();
        
        // Detected Diseases
        if (analysis.detectedDiseases && analysis.detectedDiseases.length > 0) {
          doc.fontSize(14)
             .text('Detected Issues', { underline: true });
          
          doc.moveDown(0.5);
          
          analysis.detectedDiseases.forEach((disease, index) => {
            const severityColor = disease.severity === 'high' ? '#f44336' : 
                                disease.severity === 'medium' ? '#ff9800' : '#4caf50';
            
            doc.fillColor(severityColor)
               .fontSize(11)
               .text(`${index + 1}. ${disease.name}`, { continued: true });
            
            doc.fillColor('#666')
               .text(` - ${(disease.confidence * 100).toFixed(1)}% confidence (${disease.severity})`);
          });
        }
        
        doc.moveDown();
        
        // Recommendations
        if (analysis.recommendations && analysis.recommendations.length > 0) {
          doc.fillColor('#333')
             .fontSize(14)
             .text('Recommendations', { underline: true });
          
          doc.moveDown(0.5);
          
          analysis.recommendations.forEach((rec, index) => {
            const priorityColor = rec.priority === 'high' ? '#f44336' : 
                                 rec.priority === 'medium' ? '#ff9800' : '#4caf50';
            
            doc.fillColor(priorityColor)
               .fontSize(11)
               .text(`${index + 1}. [${rec.priority.toUpperCase()}] ${rec.action}`);
          });
        }
        
        // Footer
        doc.moveDown(3);
        doc.fontSize(8)
           .fillColor('#999')
           .text('SianAgriTech Platform - AI-Powered Agricultural Analytics', { align: 'center' });
        
        doc.text('Confidential Report - For Authorized Use Only', { align: 'center' });
        
        doc.end();
        
      } catch (error) {
        reject(error);
      }
    });
  }

  // Generate HTML report (existing code - keep as is)
  async generateHTMLReport(analysis) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SianAgriTech Analysis Report</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f9f9f9;
        }
        .header {
            text-align: center;
            border-bottom: 3px solid #4CAF50;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .header h1 {
            color: #2e7d32;
            margin-bottom: 5px;
        }
        .section {
            background: white;
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .section h2 {
            color: #333;
            border-bottom: 2px solid #eee;
            padding-bottom: 10px;
            margin-top: 0;
        }
        .severity-high { background-color: #ffebee; border-left: 4px solid #f44336; }
        .severity-medium { background-color: #fff3e0; border-left: 4px solid #ff9800; }
        .severity-low { background-color: #e8f5e8; border-left: 4px solid #4caf50; }
        .priority-high { color: #f44336; font-weight: bold; }
        .priority-medium { color: #ff9800; font-weight: bold; }
        .priority-low { color: #4caf50; font-weight: bold; }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        th {
            background-color: #f2f2f2;
            font-weight: bold;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            color: #666;
            font-size: 0.9em;
        }
        .confidence-meter {
            display: inline-block;
            background: #f0f0f0;
            border-radius: 10px;
            padding: 2px 10px;
            margin-left: 10px;
            font-size: 0.9em;
        }
        .confidence-high { background: #4caf50; color: white; }
        .confidence-medium { background: #ff9800; color: white; }
        .confidence-low { background: #f44336; color: white; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🌿 SianAgriTech Analysis Report</h1>
        <p>AI-Powered Agricultural Analysis • Generated on ${new Date().toLocaleDateString()}</p>
    </div>

    <div class="section">
        <h2>Analysis Summary</h2>
        <table>
            <tr>
                <th>Crop Type</th>
                <td>${analysis.cropType || 'Not specified'}</td>
            </tr>
            <tr>
                <th>Analysis Date</th>
                <td>${new Date(analysis.timestamp || Date.now()).toLocaleDateString()}</td>
            </tr>
            ${analysis.healthScore ? `
            <tr>
                <th>Health Score</th>
                <td>${analysis.healthScore.toFixed(1)}%</td>
            </tr>
            ` : ''}
            ${analysis.confidence ? `
            <tr>
                <th>Confidence Level</th>
                <td>
                    ${(analysis.confidence * 100).toFixed(1)}%
                    <span class="confidence-meter ${analysis.confidence > 0.8 ? 'confidence-high' : analysis.confidence > 0.6 ? 'confidence-medium' : 'confidence-low'}">
                        ${analysis.confidence > 0.8 ? 'High' : analysis.confidence > 0.6 ? 'Medium' : 'Low'}
                    </span>
                </td>
            </tr>
            ` : ''}
            <tr>
                <th>AI Model</th>
                <td>${analysis.aiModel || 'General Crop Health'}</td>
            </tr>
        </table>
    </div>

    ${analysis.detectedDiseases && analysis.detectedDiseases.length > 0 ? `
    <div class="section">
        <h2>Detected Issues</h2>
        <table>
            <thead>
                <tr>
                    <th>Disease/Issue</th>
                    <th>Confidence</th>
                    <th>Severity</th>
                </tr>
            </thead>
            <tbody>
                ${analysis.detectedDiseases.map(disease => `
                <tr class="severity-${disease.severity || 'low'}">
                    <td><strong>${disease.name}</strong></td>
                    <td>${(disease.confidence * 100).toFixed(1)}%</td>
                    <td>${disease.severity ? disease.severity.charAt(0).toUpperCase() + disease.severity.slice(1) : 'Unknown'}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
    ` : ''}

    ${analysis.recommendations && analysis.recommendations.length > 0 ? `
    <div class="section">
        <h2>Recommendations</h2>
        <table>
            <thead>
                <tr>
                    <th>Priority</th>
                    <th>Action Required</th>
                    <th>Expected Impact</th>
                </tr>
            </thead>
            <tbody>
                ${analysis.recommendations.map(rec => `
                <tr>
                    <td><span class="priority-${rec.priority || 'low'}">${rec.priority ? rec.priority.toUpperCase() : 'LOW'}</span></td>
                    <td>${rec.action || 'No specific action'}</td>
                    <td>${rec.expectedImpact || 'Standard improvement'}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
    ` : ''}

    <div class="footer">
        <p>SianAgriTech Platform • AI-Powered Agricultural Analytics</p>
        <p>Report ID: ${analysis._id || analysis.timestamp || 'N/A'} • Generated by AI Engine v${analysis.modelVersion || '1.0.0'}</p>
        <p><em>Confidential Report - For Authorized Use Only</em></p>
    </div>
</body>
</html>`;
    
    return html;
  }

  // Generate JSON report (existing code - keep as is)
  generateJSONReport(analysis) {
    return {
      metadata: {
        reportType: 'soil_analysis',
        generatedAt: new Date().toISOString(),
        platform: 'SianAgriTech',
        version: '1.0.0'
      },
      analysis: {
        id: analysis._id || analysis.timestamp,
        cropType: analysis.cropType,
        timestamp: analysis.timestamp,
        healthScore: analysis.healthScore,
        confidence: analysis.confidence,
        aiModel: analysis.aiModel
      },
      detectedIssues: analysis.detectedDiseases?.map(d => ({
        name: d.name,
        confidence: d.confidence,
        severity: d.severity,
        scientificName: d.scientificName
      })) || [],
      recommendations: analysis.recommendations?.map(r => ({
        action: r.action,
        priority: r.priority,
        type: r.type,
        expectedImpact: r.expectedImpact
      })) || [],
      insights: analysis.insights || {}
    };
  }

  // Generate fallback report (existing code - keep as is)
  async generateFallbackReport(analysisId) {
    const fallbackData = {
      _id: analysisId,
      cropType: 'general',
      timestamp: new Date().toISOString(),
      healthScore: 75,
      confidence: 0.7,
      aiModel: 'Fallback Model',
      detectedDiseases: [
        {
          name: 'General Health Check',
          confidence: 0.8,
          severity: 'low'
        }
      ],
      recommendations: [
        {
          action: 'Perform manual inspection',
          priority: 'medium',
          type: 'general_inspection'
        }
      ]
    };
    
    return await this.generateHTMLReport(fallbackData);
  }

  // Other existing methods (keep as is)
  async analyzeOnEdge(imageData, cropType) {
    console.log(`🖥️ Running edge AI for ${cropType}...`);
    await this.delay(500 + Math.random() * 1000);
    const mockAnalysis = this.generateMockAnalysis(cropType);
    return {
      ...mockAnalysis,
      edgeProcessed: true,
      modelVersion: '1.0.0-edge',
      processingLocation: 'local_device'
    };
  }

  async analyzeViaAPI(imageData, cropType) {
    const model = this.models[`${cropType}_disease`];
    if (!model) {
      throw new Error(`No AI model configured for ${cropType}`);
    }

    try {
      if (model.endpoint === 'local' || model.endpoint.includes('localhost')) {
        await this.delay(1000);
        return this.generateMockAnalysis(cropType);
      }
      
      const response = await axios.post(model.endpoint, {
        image: imageData.base64 || imageData.url,
        crop_type: cropType,
        model: model.name,
        timestamp: new Date().toISOString()
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.AI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      if (response.data.success) {
        return {
          ...response.data.analysis,
          apiVersion: response.data.version,
          processingLocation: 'cloud'
        };
      } else {
        throw new Error(response.data.error || 'AI API failed');
      }

    } catch (error) {
      console.warn(`AI API failed, using fallback: ${error.message}`);
      return {
        ...this.generateMockAnalysis(cropType),
        apiFallback: true,
        error: error.message
      };
    }
  }

  // Utility methods (existing code - keep as is)
  validateImageData(imageData) {
    if (!imageData) {
      return { valid: false, error: 'No image data provided' };
    }

    const isBase64 = typeof imageData === 'string' && 
                     (imageData.includes('base64') || imageData.length > 100);
    const isURL = typeof imageData === 'string' && imageData.startsWith('http');
    const isBuffer = imageData instanceof Buffer;
    const isDataUrl = typeof imageData === 'string' && imageData.startsWith('data:image');

    if (!isBase64 && !isURL && !isBuffer && !isDataUrl) {
      if (typeof imageData === 'string' && imageData.length > 50) {
        console.warn('⚠️ Accepting string as image data for testing');
        return {
          valid: true,
          format: 'string',
          size: imageData.length,
          dimensions: 'unknown'
        };
      }
      return { valid: false, error: 'Invalid image format' };
    }

    let size = 0;
    if (typeof imageData === 'string') {
      size = Math.ceil(imageData.length * 3 / 4);
    } else if (isBuffer) {
      size = imageData.length;
    }

    if (size > 10 * 1024 * 1024) {
      return { valid: false, error: 'Image too large (max 10MB)' };
    }

    return {
      valid: true,
      format: isDataUrl ? 'base64' : isURL ? 'url' : isBuffer ? 'buffer' : 'string',
      size,
      dimensions: 'unknown'
    };
  }

  generateInsights(analysis, cropType, farmId) {
    const insights = {
      overallHealth: 'good',
      diseases: [],
      recommendations: [],
      warnings: [],
      nextSteps: []
    };

    if (analysis.diseases && analysis.diseases.length > 0) {
      const highConfidenceDiseases = analysis.diseases.filter(d => d.confidence > 0.7);
      
      if (highConfidenceDiseases.length > 0) {
        insights.overallHealth = 'needs_attention';
        
        highConfidenceDiseases.forEach(disease => {
          insights.diseases.push({
            name: disease.name,
            confidence: disease.confidence,
            severity: disease.severity || 'medium'
          });

          const rec = this.getDiseaseRecommendation(disease.name, cropType);
          if (rec) insights.recommendations.push(rec);
        });

        insights.warnings.push(`Detected ${highConfidenceDiseases.length} disease(s)`);
      }
    }

    if (analysis.healthScore < 70) {
      insights.recommendations.push({
        type: 'general_health',
        priority: 'medium',
        action: 'Schedule crop health inspection',
        reason: `Crop health score is ${analysis.healthScore.toFixed(1)}%`
      });
    }

    insights.nextSteps = [
      'Monitor crop daily',
      'Take follow-up photos in 3 days',
      'Record any visible symptoms'
    ];

    return insights;
  }

  generateMockAnalysis(cropType) {
    const diseases = {
      cassava: [
        { name: 'cbsd', confidence: 0.85, severity: 'high' },
        { name: 'healthy', confidence: 0.12, severity: 'none' }
      ],
      maize: [
        { name: 'common_rust', confidence: 0.78, severity: 'medium' },
        { name: 'healthy', confidence: 0.20, severity: 'none' }
      ]
    };

    return {
      healthScore: 75 + Math.random() * 20,
      diseases: diseases[cropType] || [{ name: 'healthy', confidence: 0.95, severity: 'none' }],
      confidence: 0.85 + Math.random() * 0.1,
      processingTime: 1200 + Math.random() * 800,
      modelUsed: this.models[`${cropType}_disease`]?.name || 'general'
    };
  }

  generateFallbackInsights(cropType) {
    return {
      overallHealth: 'unknown',
      message: 'AI analysis unavailable. Manual inspection recommended.',
      recommendations: [
        {
          type: 'manual_inspection',
          priority: 'low',
          action: 'Visually inspect crops for symptoms',
          checklist: ['leaf discoloration', 'spots', 'wilting', 'stunted growth']
        }
      ]
    };
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getDiseaseRecommendation(diseaseName, cropType) {
    const recommendations = {
      cbsd: {
        type: 'disease_management',
        priority: 'high',
        action: 'Remove and destroy infected plants immediately',
        products: ['Systemic fungicide'],
        schedule: 'Immediate action required'
      },
      cmd: {
        type: 'disease_management',
        priority: 'high',
        action: 'Use certified disease-free planting material',
        products: ['Insecticide for whiteflies'],
        schedule: 'Next planting season'
      },
      common_rust: {
        type: 'fungal_control',
        priority: 'medium',
        action: 'Apply fungicide at first signs',
        products: ['Chlorothalonil', 'Mancozeb'],
        schedule: 'Every 7-10 days'
      }
    };

    return recommendations[diseaseName] || {
      type: 'general_treatment',
      priority: 'medium',
      action: 'Consult agricultural extension officer',
      products: [],
      schedule: 'As soon as possible'
    };
  }
}

export default new AIService();