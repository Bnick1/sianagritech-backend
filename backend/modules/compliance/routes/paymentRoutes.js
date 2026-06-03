import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ExportBatch from '../models/ExportBatch.js';
import { Exporter, FarmCompliance } from '../models/index.js';
import Payment from '../models/Payment.js';
import walletService from '../services/walletService.js';
import { generateBatchReport } from '../batchReport.js';
import { apiKeyAuth } from '../../../middleware/apiKeyAuth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Ensure export directory exists
const exportDir = path.join(__dirname, '../../../../../exports');
if (!fs.existsSync(exportDir)) {
  fs.mkdirSync(exportDir, { recursive: true });
  console.log(`📁 Created export directory: ${exportDir}`);
}

// Calculate price for a batch
router.get('/price/:batchId', apiKeyAuth, async (req, res) => {
  try {
    const batch = await ExportBatch.findById(req.params.batchId);
    if (!batch) {
      return res.status(404).json({ success: false, error: 'Batch not found' });
    }

    const price = walletService.calculatePrice(batch);
    
    res.json({
      success: true,
      batchId: batch.batchId,
      price
    });
  } catch (error) {
    console.error('Price calculation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Generate invoice for batch
router.post('/invoice/:batchId', apiKeyAuth, async (req, res) => {
  try {
    console.log(`📄 Generating invoice for batch: ${req.params.batchId}`);
    
    // Find batch and populate exporter
    const batch = await ExportBatch.findById(req.params.batchId)
      .populate('exporterId');
    
    if (!batch) {
      console.log('❌ Batch not found');
      return res.status(404).json({ success: false, error: 'Batch not found' });
    }

    console.log('✅ Batch found:', batch.batchId);
    console.log('Exporter ID from batch:', batch.exporterId?._id || batch.exporterId);

    // Check if exporter exists
    if (!batch.exporterId) {
      console.log('❌ Batch has no exporter reference');
      return res.status(404).json({ 
        success: false, 
        error: 'Batch has no exporter reference',
        batchId: batch.batchId
      });
    }

    // If exporterId is populated, use it directly
    let exporter = batch.exporterId;
    
    // If it's just an ID (not populated), fetch it
    if (typeof exporter === 'string' || exporter instanceof String) {
      console.log('Fetching exporter separately...');
      exporter = await Exporter.findById(batch.exporterId);
    }

    if (!exporter) {
      console.log('❌ Exporter not found in database');
      return res.status(404).json({ 
        success: false, 
        error: 'Exporter not found',
        exporterId: batch.exporterId?._id || batch.exporterId
      });
    }

    console.log('✅ Exporter found:', exporter.companyName);

    const invoice = await walletService.generateInvoice(batch, exporter);
    
    console.log('✅ Invoice generated:', invoice.invoiceNumber);
    
    // Save invoice to file
    const invoicePath = path.join(exportDir, `invoice-${invoice.invoiceNumber}.json`);
    fs.writeFileSync(invoicePath, JSON.stringify(invoice, null, 2));
    console.log(`💾 Invoice saved to: ${invoicePath}`);
    
    res.json({ 
      success: true, 
      invoice,
      batch: {
        id: batch._id,
        batchId: batch.batchId,
        exporter: exporter.companyName
      }
    });
  } catch (error) {
    console.error('❌ Invoice generation error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Process payment for batch
router.post('/pay/:batchId', apiKeyAuth, async (req, res) => {
  try {
    const { payerName, payerEmail, payerPhone, paymentMethod, amount } = req.body;
    console.log(`💰 Processing payment for batch: ${req.params.batchId}`);
    
    const batch = await ExportBatch.findById(req.params.batchId)
      .populate('exporterId')
      .populate('farmsIncluded.farmId');
    
    if (!batch) {
      console.log('❌ Batch not found');
      return res.status(404).json({ success: false, error: 'Batch not found' });
    }

    // Calculate price if amount not provided
    const price = amount || walletService.calculatePrice(batch).total;
    
    const payerInfo = {
      payerName: payerName || batch.exporterId?.companyName || 'Anonymous',
      payerEmail,
      payerPhone,
      paymentMethod: paymentMethod || 'bank_transfer'
    };
    
    console.log(`💵 Amount: ${price} UGX, Payer: ${payerInfo.payerName}`);
    
    const payment = await walletService.processBatchPayment(batch, payerInfo, price);

    console.log('✅ Payment processed:', payment.transactionId);

    // If payment was successful, generate and save PDF report
    if (payment.success && payment.status === 'processing') {
      try {
        console.log('📄 Auto-generating PDF report for batch...');
        
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
        
        // Save PDF to file
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const pdfFilename = `export-report-${batch.batchId}-${timestamp}.pdf`;
        const pdfPath = path.join(exportDir, pdfFilename);
        
        fs.writeFileSync(pdfPath, pdfBuffer);
        console.log(`💾 PDF saved to: ${pdfPath}`);
        
        // Also save as base64 in response for immediate download
        const reportBase64 = pdfBuffer.toString('base64');
        
        // Update batch with report reference
        batch.complianceReport = {
          url: `data:application/pdf;base64,${reportBase64}`,
          generatedAt: new Date(),
          filePath: pdfPath
        };
        await batch.save();
        
        // Attach to response
        payment.report = {
          base64: reportBase64,
          filename: pdfFilename,
          path: pdfPath
        };
        
        console.log('✅ PDF auto-generated successfully');
      } catch (pdfError) {
        console.error('❌ PDF generation error:', pdfError);
        payment.reportError = pdfError.message;
      }
    }

    res.json({ 
      success: true, 
      payment,
      batch: {
        id: batch._id,
        batchId: batch.batchId,
        paymentStatus: batch.paymentStatus
      }
    });
  } catch (error) {
    console.error('❌ Payment processing error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Download PDF for a batch
router.get('/download-pdf/:batchId', apiKeyAuth, async (req, res) => {
  try {
    const batch = await ExportBatch.findById(req.params.batchId)
      .populate('exporterId')
      .populate('farmsIncluded.farmId');
    
    if (!batch) {
      return res.status(404).json({ success: false, error: 'Batch not found' });
    }
    
    // Check if we have a saved PDF
    if (batch.complianceReport?.filePath && fs.existsSync(batch.complianceReport.filePath)) {
      // Serve existing file
      return res.download(batch.complianceReport.filePath);
    }
    
    // Generate new PDF
    const farms = await FarmCompliance.find({
      _id: { $in: batch.farmsIncluded.map(f => f.farmId) }
    });
    
    const pdfBuffer = await generateBatchReport(
      batch.exporterId,
      batch,
      farms
    );
    
    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=export-report-${batch.batchId}.pdf`);
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('❌ PDF download error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get list of generated reports
router.get('/reports', apiKeyAuth, async (req, res) => {
  try {
    const files = fs.readdirSync(exportDir)
      .filter(f => f.startsWith('export-report-') && f.endsWith('.pdf'))
      .map(f => ({
        filename: f,
        path: path.join(exportDir, f),
        size: fs.statSync(path.join(exportDir, f)).size,
        createdAt: fs.statSync(path.join(exportDir, f)).birthtime
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
    
    res.json({ success: true, reports: files });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Verify payment
router.get('/verify/:paymentId', apiKeyAuth, async (req, res) => {
  try {
    console.log(`🔍 Verifying payment: ${req.params.paymentId}`);
    const verification = await walletService.verifyPayment(req.params.paymentId);
    res.json({ success: true, verification });
  } catch (error) {
    console.error('❌ Payment verification error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get payment status for batch
router.get('/status/:batchId', apiKeyAuth, async (req, res) => {
  try {
    console.log(`📊 Getting payment status for batch: ${req.params.batchId}`);
    
    const batch = await ExportBatch.findById(req.params.batchId)
      .select('batchId paymentStatus paymentAmount paymentReference paymentDate invoiceNumber totalAmount complianceReport');
    
    if (!batch) {
      console.log('❌ Batch not found');
      return res.status(404).json({ success: false, error: 'Batch not found' });
    }

    // Get associated payments
    const payments = await Payment.find({ batchId: req.params.batchId });

    console.log(`✅ Found ${payments.length} payments for batch`);

    res.json({
      success: true,
      payment: {
        batchId: batch.batchId,
        status: batch.paymentStatus,
        amount: batch.paymentAmount || batch.totalAmount,
        reference: batch.paymentReference,
        date: batch.paymentDate,
        invoice: batch.invoiceNumber,
        reportAvailable: !!batch.complianceReport?.filePath,
        reportPath: batch.complianceReport?.filePath,
        payments: payments.map(p => ({
          paymentId: p.paymentId,
          amount: p.amount,
          status: p.status,
          date: p.paymentDate,
          method: p.paymentMethod,
          completedAt: p.completedDate
        }))
      }
    });
  } catch (error) {
    console.error('❌ Payment status error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get payment history for exporter
router.get('/history/:exporterId', apiKeyAuth, async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    console.log(`📜 Getting payment history for exporter: ${req.params.exporterId}`);
    
    const history = await walletService.getPaymentHistory(req.params.exporterId, limit);
    res.json(history);
  } catch (error) {
    console.error('❌ Payment history error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;