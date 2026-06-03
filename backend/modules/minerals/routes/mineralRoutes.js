import express from 'express';
import MineralBatch from '../models/MineralBatch.js';
import geoIntegration from '../services/geoIntegration.js';
import fintechIntegration from '../services/fintechIntegration.js';
import { apiKeyAuth } from '../../../middleware/apiKeyAuth.js';

const router = express.Router();

// Create new mineral batch
router.post('/batches', apiKeyAuth, async (req, res) => {
  try {
    const batch = new MineralBatch(req.body);
    
    // Auto-generate batch ID
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    batch.batchId = `MIN-${year}${month}-${random}`;
    
    await batch.save();
    res.status(201).json({ success: true, batch });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Verify mine location with SianGeo
router.post('/batches/:batchId/verify-location', apiKeyAuth, async (req, res) => {
  try {
    const batch = await MineralBatch.findById(req.params.batchId);
    if (!batch) {
      return res.status(404).json({ success: false, error: 'Batch not found' });
    }
    
    const verification = await geoIntegration.verifyMineLocation(
      batch.mineOrigin.coordinates,
      batch.mineOrigin.licenseNumber
    );
    
    if (verification.success) {
      batch.mineOrigin.geoVerified = verification.verified;
      batch.mineOrigin.geoVerifiedDate = new Date();
      batch.mineOrigin.satelliteImageUrl = verification.satelliteImage;
      await batch.save();
    }
    
    res.json({ success: true, verification, batch });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Process royalty payment via SianFinTech
router.post('/batches/:batchId/process-royalty', apiKeyAuth, async (req, res) => {
  try {
    const batch = await MineralBatch.findById(req.params.batchId);
    if (!batch) {
      return res.status(404).json({ success: false, error: 'Batch not found' });
    }
    
    const royaltyData = {
      amount: batch.financial.royaltyAmount,
      exporterId: batch.exporterId,
      governmentEntityId: 'MEMD', // Ministry of Energy and Mineral Development
      reference: batch.batchId,
      batchId: batch.batchId,
      mineralType: batch.mineralType,
      quantity: batch.quantity
    };
    
    const payment = await fintechIntegration.processRoyaltyPayment(royaltyData);
    
    if (payment.success) {
      batch.financial.royaltyPaid = true;
      batch.financial.royaltyPaymentId = payment.paymentId;
      await batch.save();
    }
    
    res.json({ success: true, payment, batch });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Generate compliance report
router.get('/batches/:batchId/report', apiKeyAuth, async (req, res) => {
  try {
    const batch = await MineralBatch.findById(req.params.batchId)
      .populate('exporterId');
    
    if (!batch) {
      return res.status(404).json({ success: false, error: 'Batch not found' });
    }
    
    // Generate mineral export report (similar to agricultural report)
    // This would create a PDF with all traceability data
    
    res.json({
      success: true,
      batch,
      reportAvailable: true,
      downloadUrl: `/api/minerals/batches/${batch._id}/download`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;