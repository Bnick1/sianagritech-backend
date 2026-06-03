import express from 'express';
import { Exporter, FarmCompliance, ExportBatch, Payment } from '../modules/compliance/models/index.js';
import { validateFarmAgainstUKStandards } from '../modules/compliance/ukStandards.js';
import pdfGenerator from '../modules/compliance/pdfGenerator.js';
import { generateBatchReport } from '../modules/compliance/batchReport.js';
import { apiKeyAuth } from '../middleware/apiKeyAuth.js';

// Import payment routes
import paymentRoutes from '../modules/compliance/routes/paymentRoutes.js';

const router = express.Router();

// ==================== PAYMENT ROUTES ====================
router.use('/payments', paymentRoutes);

// ==================== EXPORTER ENDPOINTS ====================

// Get all exporters
router.get('/exporters', apiKeyAuth, async (req, res) => {
  try {
    const exporters = await Exporter.find().sort({ createdAt: -1 });
    res.json({ success: true, exporters });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single exporter
router.get('/exporters/:id', apiKeyAuth, async (req, res) => {
  try {
    const exporter = await Exporter.findById(req.params.id);
    if (!exporter) {
      return res.status(404).json({ success: false, error: 'Exporter not found' });
    }
    res.json({ success: true, exporter });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new exporter
router.post('/exporters', apiKeyAuth, async (req, res) => {
  try {
    const exporter = new Exporter(req.body);
    await exporter.save();
    res.status(201).json({ success: true, exporter });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Update exporter
router.put('/exporters/:id', apiKeyAuth, async (req, res) => {
  try {
    const exporter = await Exporter.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!exporter) {
      return res.status(404).json({ success: false, error: 'Exporter not found' });
    }
    res.json({ success: true, exporter });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Delete exporter
router.delete('/exporters/:id', apiKeyAuth, async (req, res) => {
  try {
    const exporter = await Exporter.findByIdAndDelete(req.params.id);
    if (!exporter) {
      return res.status(404).json({ success: false, error: 'Exporter not found' });
    }
    res.json({ success: true, message: 'Exporter deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== FARM COMPLIANCE ENDPOINTS ====================

// Get farms for an exporter
router.get('/exporters/:exporterId/farms', apiKeyAuth, async (req, res) => {
  try {
    const farms = await FarmCompliance.find({ exporterId: req.params.exporterId });
    res.json({ success: true, farms });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add farm to exporter
router.post('/exporters/:exporterId/farms', apiKeyAuth, async (req, res) => {
  try {
    const farmData = {
      ...req.body,
      exporterId: req.params.exporterId
    };
    
    const farm = new FarmCompliance(farmData);
    await farm.save();
    
    // Add farm reference to exporter
    await Exporter.findByIdAndUpdate(req.params.exporterId, {
      $push: {
        farmers: {
          farmerId: farm._id,
          farmName: farm.farmName,
          location: farm.location
        }
      }
    });
    
    res.status(201).json({ success: true, farm });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get farm compliance details
router.get('/farms/:farmId', apiKeyAuth, async (req, res) => {
  try {
    const farm = await FarmCompliance.findById(req.params.farmId);
    if (!farm) {
      return res.status(404).json({ success: false, error: 'Farm not found' });
    }
    
    // Run UK standards check
    const complianceCheck = validateFarmAgainstUKStandards(farm);
    
    res.json({ 
      success: true, 
      farm,
      complianceCheck
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update farm compliance
router.put('/farms/:farmId', apiKeyAuth, async (req, res) => {
  try {
    const farm = await FarmCompliance.findByIdAndUpdate(
      req.params.farmId,
      req.body,
      { new: true, runValidators: true }
    );
    if (!farm) {
      return res.status(404).json({ success: false, error: 'Farm not found' });
    }
    res.json({ success: true, farm });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ==================== BATCH EXPORT ENDPOINTS ====================

// Get all batches for an exporter
router.get('/exporters/:exporterId/batches', apiKeyAuth, async (req, res) => {
  try {
    const batches = await ExportBatch.find({ exporterId: req.params.exporterId })
      .sort({ createdAt: -1 });
    res.json({ success: true, batches });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new export batch
router.post('/exporters/:exporterId/batches', apiKeyAuth, async (req, res) => {
  try {
    const batchData = {
      ...req.body,
      exporterId: req.params.exporterId
    };
    
    const batch = new ExportBatch(batchData);
    await batch.save();
    
    res.status(201).json({ success: true, batch });
  } catch (error) {
    console.error('Batch creation error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get batch details
router.get('/batches/:batchId', apiKeyAuth, async (req, res) => {
  try {
    const batch = await ExportBatch.findById(req.params.batchId)
      .populate('exporterId')
      .populate('farmsIncluded.farmId');
      
    if (!batch) {
      return res.status(404).json({ success: false, error: 'Batch not found' });
    }
    
    res.json({ success: true, batch });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Generate compliance report for batch
router.post('/batches/:batchId/generate-report', apiKeyAuth, async (req, res) => {
  try {
    const batch = await ExportBatch.findById(req.params.batchId)
      .populate('exporterId')
      .populate('farmsIncluded.farmId');
    
    if (!batch) {
      return res.status(404).json({ success: false, error: 'Batch not found' });
    }
    
    // Get all farms in the batch
    const farms = await FarmCompliance.find({
      _id: { $in: batch.farmsIncluded.map(f => f.farmId) }
    });
    
    // Generate PDF report
    const pdfBuffer = await generateBatchReport(
      batch.exporterId,
      batch,
      farms
    );
    
    // For MVP, return base64
    const reportBase64 = pdfBuffer.toString('base64');
    
    // Update batch with report reference
    batch.complianceReport = {
      url: `data:application/pdf;base64,${reportBase64}`,
      generatedAt: new Date()
    };
    await batch.save();
    
    res.json({
      success: true,
      report: reportBase64,
      batchId: batch.batchId
    });
  } catch (error) {
    console.error('Report generation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== COMPLIANCE CHECK ENDPOINTS ====================

// Check farm against UK standards
router.post('/check-farm/:farmId', apiKeyAuth, async (req, res) => {
  try {
    const farm = await FarmCompliance.findById(req.params.farmId);
    if (!farm) {
      return res.status(404).json({ success: false, error: 'Farm not found' });
    }
    
    const checklist = validateFarmAgainstUKStandards(farm);
    const passedCount = checklist.filter(c => c.passed).length;
    const complianceScore = Math.round((passedCount / checklist.length) * 100);
    
    // Update farm compliance flags
    farm.ukCompliant = complianceScore >= 80;
    farm.lastComplianceCheck = new Date();
    await farm.save();
    
    res.json({
      success: true,
      complianceScore,
      compliant: farm.ukCompliant,
      checklist,
      summary: {
        passed: passedCount,
        total: checklist.length,
        percent: complianceScore
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== DASHBOARD STATS ====================

router.get('/dashboard/:exporterId', apiKeyAuth, async (req, res) => {
  try {
    const exporter = await Exporter.findById(req.params.exporterId);
    if (!exporter) {
      return res.status(404).json({ success: false, error: 'Exporter not found' });
    }
    
    const farms = await FarmCompliance.find({ exporterId: req.params.exporterId });
    const batches = await ExportBatch.find({ exporterId: req.params.exporterId });
    
    // Get all payments for this exporter
    const payments = await Payment.find({ 
      exporterId: req.params.exporterId,
      status: 'completed'
    });
    
    const compliantFarms = farms.filter(f => f.ukCompliant).length;
    const pendingBatches = batches.filter(b => b.status === 'pending' || b.status === 'draft').length;
    const shippedBatches = batches.filter(b => b.status === 'shipped' || b.status === 'delivered').length;
    
    // Calculate revenue from payments (more accurate than batch.paymentStatus)
    const totalRevenue = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    
    // Get pending payments
    const pendingPayments = await Payment.find({
      exporterId: req.params.exporterId,
      status: { $in: ['pending', 'processing'] }
    });
    const pendingRevenue = pendingPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    
    // Get recent payments with batch details
    const recentPayments = await Payment.find({ exporterId: req.params.exporterId })
      .populate('batchId')
      .sort({ createdAt: -1 })
      .limit(5);
    
    res.json({
      success: true,
      dashboard: {
        exporterName: exporter.companyName,
        exporterId: exporter._id,
        stats: {
          totalFarms: farms.length,
          compliantFarms,
          complianceRate: farms.length ? Math.round((compliantFarms / farms.length) * 100) : 0,
          totalBatches: batches.length,
          pendingBatches,
          shippedBatches,
          totalRevenue,
          pendingRevenue,
          totalPayments: payments.length,
          averagePayment: payments.length ? Math.round(totalRevenue / payments.length) : 0
        },
        recentBatches: batches.slice(0, 5).map(b => ({
          batchId: b.batchId,
          cropType: b.cropType,
          quantity: b.quantity,
          destination: b.destinationCountry,
          paymentStatus: b.paymentStatus,
          amount: b.paymentAmount || b.totalAmount,
          status: b.status,
          createdAt: b.createdAt
        })),
        recentPayments: recentPayments.map(p => ({
          paymentId: p.paymentId,
          amount: p.amount,
          status: p.status,
          date: p.paymentDate,
          method: p.paymentMethod,
          batchId: p.batchId?.batchId
        })),
        complianceAlerts: farms.filter(f => !f.ukCompliant).slice(0, 5).map(f => ({
          farmName: f.farmName,
          location: f.location,
          missingDocs: f.ukCompliant ? 0 : 1
        }))
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;