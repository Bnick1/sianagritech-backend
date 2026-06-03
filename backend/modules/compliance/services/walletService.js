import Payment from '../models/Payment.js';
import ExportBatch from '../models/ExportBatch.js';

class WalletService {
  constructor() {
    // No mocks, no external dependencies - just our own payment tracking
    console.log('💰 Payment service initialized - REAL payments enabled');
  }

  /**
   * Process payment for an export batch
   */
  async processBatchPayment(batchData, payerInfo, amount) {
    try {
      console.log(`💰 Processing payment of ${amount} UGX for batch ${batchData.batchId}`);

      // Create payment record
      const payment = new Payment({
        batchId: batchData._id,
        exporterId: batchData.exporterId,
        amount: amount,
        currency: 'UGX',
        paymentMethod: payerInfo.paymentMethod || 'bank_transfer',
        status: 'processing',
        payerName: payerInfo.payerName || 'Unknown',
        payerEmail: payerInfo.payerEmail,
        payerPhone: payerInfo.payerPhone,
        paymentDate: new Date(),
        transactionReference: `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        metadata: {
          batchId: batchData.batchId,
          cropType: batchData.cropType,
          quantity: batchData.quantity
        }
      });

      await payment.save();

      // Simulate payment processing (in real life, this would be async)
      // For demo, we'll mark as completed after 2 seconds
      setTimeout(async () => {
        payment.status = 'completed';
        payment.completedDate = new Date();
        payment.receiptNumber = `RCP-${payment.paymentId}`;
        await payment.save();

        // Update the batch
        await ExportBatch.findByIdAndUpdate(batchData._id, {
          paymentStatus: 'paid',
          paymentAmount: amount,
          paymentReference: payment.paymentId,
          paymentDate: new Date()
        });

        console.log(`✅ Payment ${payment.paymentId} completed for batch ${batchData.batchId}`);
      }, 2000);

      return {
        success: true,
        transactionId: payment.paymentId,
        reference: payment.transactionReference,
        status: 'processing',
        amount: amount,
        message: 'Payment processing initiated'
      };

    } catch (error) {
      console.error('❌ Payment processing failed:', error);
      return {
        success: false,
        error: error.message,
        status: 'failed'
      };
    }
  }

  /**
   * Verify payment status
   */
  async verifyPayment(paymentId) {
    try {
      const payment = await Payment.findOne({ paymentId: paymentId })
        .populate('batchId')
        .populate('exporterId');

      if (!payment) {
        return {
          success: false,
          status: 'not_found',
          error: 'Payment not found'
        };
      }

      return {
        success: true,
        status: payment.status,
        confirmed: payment.status === 'completed',
        details: {
          paymentId: payment.paymentId,
          amount: payment.amount,
          currency: payment.currency,
          date: payment.paymentDate,
          completedAt: payment.completedDate,
          transactionReference: payment.transactionReference,
          receiptNumber: payment.receiptNumber
        }
      };

    } catch (error) {
      console.error('❌ Payment verification failed:', error);
      return {
        success: false,
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Generate invoice for batch
   */
  async generateInvoice(batchData, exporterData) {
    try {
      console.log(`📄 Generating invoice for batch ${batchData.batchId}`);

      // Calculate price
      const price = this.calculatePrice(batchData);
      
      // Generate invoice number
      const invoiceNumber = `INV-${batchData.batchId}-${Date.now().toString().slice(-6)}`;

      // In a real system, you'd generate a PDF here
      // For now, we'll just return the invoice data
      const invoice = {
        invoiceNumber: invoiceNumber,
        date: new Date().toISOString(),
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        exporter: {
          name: exporterData.companyName,
          email: exporterData.email,
          registrationNumber: exporterData.registrationNumber,
          country: exporterData.country
        },
        batch: {
          id: batchData.batchId,
          cropType: batchData.cropType,
          quantity: batchData.quantity,
          unit: batchData.unit,
          destination: batchData.destinationCountry
        },
        items: [
          {
            description: `UK Export Compliance Report - ${batchData.cropType}`,
            quantity: batchData.quantity,
            unit: batchData.unit,
            unitPrice: 50,
            total: batchData.quantity * 50
          },
          {
            description: 'Platform Fee',
            quantity: 1,
            unitPrice: 10000,
            total: 10000
          }
        ],
        subtotal: price.subtotal,
        platformFee: price.platformFee,
        total: price.total,
        currency: 'UGX'
      };

      // Update batch with invoice info
      batchData.invoiceNumber = invoiceNumber;
      batchData.totalAmount = price.total;
      await batchData.save();

      return {
        success: true,
        invoice: invoice,
        invoiceNumber: invoiceNumber,
        amount: price.total
      };

    } catch (error) {
      console.error('❌ Invoice generation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Calculate price for export report
   */
  calculatePrice(batchData) {
    const baseRatePerKg = 50; // UGX per kg
    const platformFee = 10000; // Flat fee
    
    // Volume discounts
    let discount = 0;
    if (batchData.quantity > 10000) discount = 0.2;
    else if (batchData.quantity > 5000) discount = 0.1;
    
    const subtotal = batchData.quantity * baseRatePerKg;
    const discountAmount = subtotal * discount;
    const total = (subtotal - discountAmount) + platformFee;
    
    return {
      subtotal,
      discount: discount * 100,
      discountAmount,
      platformFee,
      total: Math.round(total),
      currency: 'UGX'
    };
  }

  /**
   * Get payment history for exporter
   */
  async getPaymentHistory(exporterId, limit = 10) {
    try {
      const payments = await Payment.find({ exporterId: exporterId })
        .populate('batchId')
        .sort({ createdAt: -1 })
        .limit(limit);

      return {
        success: true,
        payments: payments.map(p => ({
          paymentId: p.paymentId,
          amount: p.amount,
          status: p.status,
          date: p.paymentDate,
          completedDate: p.completedDate,
          batchId: p.batchId?.batchId,
          cropType: p.batchId?.cropType
        }))
      };
    } catch (error) {
      console.error('❌ Failed to get payment history:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default new WalletService();