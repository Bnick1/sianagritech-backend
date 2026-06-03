import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  paymentId: { 
    type: String, 
    unique: true,
    sparse: true // Allow null/undefined for pre-save hook
  },
  batchId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'ExportBatch', 
    required: true 
  },
  exporterId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Exporter', 
    required: true 
  },
  
  // Payment details
  amount: { 
    type: Number, 
    required: true 
  },
  currency: { 
    type: String, 
    default: 'UGX' 
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'bank_transfer', 'mobile_money', 'card', 'wallet'],
    default: 'bank_transfer'
  },
  
  // Status
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  
  // Payment tracking
  transactionReference: String,
  paymentDate: Date,
  completedDate: Date,
  
  // Payer info
  payerName: String,
  payerEmail: String,
  payerPhone: String,
  
  // Receipt
  receiptNumber: String,
  receiptUrl: String,
  
  // Metadata
  notes: String,
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  }
}, { 
  timestamps: true 
});

// Generate payment ID before saving - MUST BE BEFORE MODEL CREATION
paymentSchema.pre('save', function(next) {
  console.log('💰 Payment pre-save hook triggered');
  console.log('Current paymentId:', this.paymentId);
  
  if (!this.paymentId) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.paymentId = `PAY-${year}${month}-${random}`;
    console.log(`✅ Auto-generated paymentId: ${this.paymentId}`);
  }
  next();
});

// Indexes
paymentSchema.index({ paymentId: 1 });
paymentSchema.index({ batchId: 1 });
paymentSchema.index({ exporterId: 1 });
paymentSchema.index({ status: 1 });

const Payment = mongoose.model('Payment', paymentSchema);
export default Payment;