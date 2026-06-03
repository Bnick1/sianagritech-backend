import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import aiService from '../services/aiService.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/images');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'disease-scan-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (jpeg, jpg, png, gif)'));
    }
  }
});

// Report generation endpoint
router.get('/report/:analysisId', async (req, res) => {
  try {
    const { analysisId } = req.params;
    const { format = 'pdf' } = req.query;
    
    console.log(`Generating report for ${analysisId} in ${format} format`);
    
    const result = await aiService.generateReport(analysisId, format);
    
    if (!result.success) {
      console.error('Report generation failed:', result.error);
      return res.status(500).json(result);
    }
    
    // Set proper headers for download
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', 
      `attachment; filename="${result.filename}"`);
    res.setHeader('Cache-Control', 'no-cache');
    
    // Send the report
    res.send(result.report);
    
    console.log(`✅ Report generated successfully: ${result.filename}`);
    
  } catch (error) {
    console.error('Report endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate report',
      message: error.message
    });
  }
});

// Base64 image analysis (for camera capture) - FIXED VERSION
router.post('/detect-disease-base64', async (req, res) => {
  try {
    const { imageBase64, cropType = 'maize', farmId = null } = req.body;
    
    if (!imageBase64) {
      return res.status(400).json({
        success: false,
        error: 'No image data provided'
      });
    }

    // Save base64 image temporarily
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const uploadDir = path.join(__dirname, '../uploads/images');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    const filename = `camera-capture-${uniqueSuffix}.jpg`;
    const imagePath = path.join(uploadDir, filename);
    
    // Remove data URL prefix if present
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    await fs.promises.writeFile(imagePath, buffer);
    const imageUrl = `/uploads/images/${filename}`;

    // Use AI service for analysis
    const analysis = await aiService.analyzeCropImage({
      base64: imageBase64,
      path: imagePath,
      url: imageUrl,
      size: buffer.length,
      mimetype: 'image/jpeg'
    }, cropType, farmId);

    // Create response
    const response = {
      success: true,
      message: 'Camera image analysis completed',
      data: analysis.record || analysis,
    };

    // Add reportId if available
    if (analysis.record && analysis.record._id) {
      response.reportId = analysis.record._id.toString();
    } else {
      // Generate a mock ID for testing
      response.reportId = Date.now().toString();
    }

    res.json(response);

  } catch (error) {
    console.error('Base64 analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Disease detection from uploaded image - FIXED VERSION
router.post('/detect-disease', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file uploaded'
      });
    }

    const { cropType = 'maize', farmId = null } = req.body;
    const imagePath = req.file.path;
    const imageUrl = `/uploads/images/${req.file.filename}`;

    // Use AI service for analysis
    const analysis = await aiService.analyzeCropImage({
      path: imagePath,
      url: imageUrl,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    }, cropType, farmId);

    // Create response
    const response = {
      success: true,
      message: 'Disease analysis completed',
      data: analysis.record || analysis,
    };

    // Add reportId if available
    if (analysis.record && analysis.record._id) {
      response.reportId = analysis.record._id.toString();
    } else {
      // Generate a mock ID for testing
      response.reportId = Date.now().toString();
    }

    res.json(response);

  } catch (error) {
    console.error('Disease detection error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Storage health endpoint
router.get('/storage-health', (req, res) => {
  try {
    // This endpoint would normally check database storage
    // For now, return mock data
    res.json({
      success: true,
      storage: {
        database: {
          status: 'healthy',
          usedSpace: '1.2GB',
          freeSpace: '8.8GB',
          totalSpace: '10GB'
        },
        fileSystem: {
          uploads: {
            count: 42,
            totalSize: '45MB',
            averageSize: '1.1MB'
          }
        },
        recommendations: [
          'Storage is healthy',
          'Consider archiving old reports after 1 year'
        ]
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Storage cleanup endpoint
router.post('/storage/cleanup', async (req, res) => {
  try {
    const { keepLast = 100, analysisType = 'all' } = req.body;
    
    // In production, this would clean up old files and database records
    const uploadDir = path.join(__dirname, '../uploads/images');
    
    if (fs.existsSync(uploadDir)) {
      const files = fs.readdirSync(uploadDir);
      const oldFiles = files.filter(file => {
        const filePath = path.join(uploadDir, file);
        const stats = fs.statSync(filePath);
        const ageInDays = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
        return ageInDays > 30; // Older than 30 days
      });
      
      // Delete old files
      oldFiles.forEach(file => {
        const filePath = path.join(uploadDir, file);
        fs.unlinkSync(filePath);
      });
      
      res.json({
        success: true,
        message: `Cleaned up ${oldFiles.length} old files`,
        details: {
          totalFilesBefore: files.length,
          filesDeleted: oldFiles.length,
          filesRemaining: files.length - oldFiles.length
        }
      });
    } else {
      res.json({
        success: true,
        message: 'No uploads directory found',
        details: { uploadsDir: uploadDir }
      });
    }
  } catch (error) {
    console.error('Storage cleanup error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// AI analysis endpoint (existing - keep for compatibility)
router.post('/analyze', (req, res) => {
  const { image, soilData, cropType } = req.body;
  
  // Mock AI analysis
  const analysis = {
    soilHealth: Math.random() * 100,
    cropHealth: Math.random() * 100,
    pestRisk: Math.random() * 100,
    recommendations: [
      'Add nitrogen fertilizer',
      'Irrigate soon',
      'Monitor for pests'
    ],
    confidence: Math.random() * 100
  };
  
  res.json({
    success: true,
    data: analysis,
    message: 'AI analysis completed'
  });
});

// Get analysis history for a farmer
router.get('/history/:farmerId', async (req, res) => {
  try {
    const { farmerId } = req.params;
    const { limit = 10 } = req.query;
    
    // Mock history data
    const history = Array.from({ length: Math.min(limit, 5) }, (_, i) => ({
      id: `analysis_${Date.now() - i * 86400000}`,
      farmerId,
      type: i % 2 === 0 ? 'disease_detection' : 'soil_analysis',
      cropType: ['maize', 'coffee', 'bananas'][i % 3],
      date: new Date(Date.now() - i * 86400000).toISOString(),
      result: i % 2 === 0 ? 'Disease detected' : 'Soil health good',
      confidence: 70 + Math.random() * 25,
      imageUrl: i % 2 === 0 ? `/uploads/images/sample-${i}.jpg` : null,
      hasReport: true,
      reportFormats: ['pdf', 'html', 'json']
    }));
    
    res.json({
      success: true,
      data: {
        farmerId,
        analyses: history,
        total: history.length,
        lastAnalysis: history.length > 0 ? history[0].date : null,
        storageSummary: {
          totalScans: history.length,
          lastCleanup: new Date(Date.now() - 7 * 86400000).toISOString(),
          nextCleanup: new Date(Date.now() + 23 * 86400000).toISOString()
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;