import express from 'express';
import { Exporter, FarmCompliance, ExportBatch, Payment } from '../modules/compliance/models/index.js';
import { validateFarmAgainstUKStandards } from '../modules/compliance/ukStandards.js';
import { generateComplianceReport, generateCertificate } from '../modules/compliance/pdfGenerator.js';
import { generateBatchReport } from '../modules/compliance/batchReport.js';
import { apiKeyAuth } from '../middleware/apiKeyAuth.js';
import paymentRoutes from '../modules/compliance/routes/paymentRoutes.js';

const router = express.Router();

// Health check
router.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'Compliance' });
});

// Farm compliance
router.post('/farm/:farmId/validate', async (req, res) => {
    try {
        const { farmId } = req.params;
        const result = await validateFarmAgainstUKStandards({ farmId });
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Generate compliance report
router.post('/farm/:farmId/report', async (req, res) => {
    try {
        const { farmId } = req.params;
        const report = await generateComplianceReport({ farmId });
        res.json({ success: true, data: report });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Generate certificate
router.post('/farm/:farmId/certificate', async (req, res) => {
    try {
        const { farmId } = req.params;
        const certificate = await generateCertificate(farmId);
        res.json({ success: true, data: certificate });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Batch report
router.post('/batch/:batchId/report', async (req, res) => {
    try {
        const { batchId } = req.params;
        const report = await generateBatchReport(batchId);
        res.json({ success: true, data: report });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Payment routes
router.use('/payments', paymentRoutes);

// Exporters
router.get('/exporters', async (req, res) => {
    try {
        const exporters = await Exporter.find();
        res.json({ success: true, data: exporters });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Farm compliance records
router.get('/farms', async (req, res) => {
    try {
        const records = await FarmCompliance.find();
        res.json({ success: true, data: records });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
