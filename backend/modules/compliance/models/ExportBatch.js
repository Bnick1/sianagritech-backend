import mongoose from 'mongoose';

const exportBatchSchema = new mongoose.Schema({
  batchId: { 
    type: String, 
    unique: true,
    sparse: true // Allow null/undefined for pre-save hook
  },
  exporterId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Exporter', 
    required: true 
  },
  
  // Batch details
  cropType: { 
    type: String, 
    required: true 
  },
  quantity: Number,
  unit: { 
    type: String, 
    default: 'kg' 
  },
  
  // Origin
  countryOfOrigin: { 
    type: String, 
    default: 'Uganda' 
  },
  farmsIncluded: [{
    farmId: { type: mongoose.Schema.Types.ObjectId, ref: 'FarmCompliance' },
    farmName: String,
    quantity: Number
  }],
  
  // Destination
  destinationMarket: { 
    type: String, 
    enum: ['UK', 'EU', 'OTHER'],
    required: true 
  },
  destinationCountry: String,
  portOfEntry: String,
  
  // Dates
  estimatedExportDate: Date,
  actualExportDate: Date,
  
  // Compliance
  complianceScore: Number,
  complianceReport: {
    url: String,
    generatedAt: Date
  },
  
  // Status
  status: {
    type: String,
    enum: ['draft', 'pending', 'approved', 'shipped', 'delivered', 'rejected'],
    default: 'draft'
  },
  
  // Documents
  documents: [{
    type: String,
    url: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  
  // Tracking
  trackingNumber: String,
  shippingLine: String,
  
  // UK/EU specific
  ukAgentNotified: { type: Boolean, default: false },
  euEntryDeclaration: String,
  
  // ============ PAYMENT FIELDS (SianWallet Integration) ============
  paymentStatus: {
    type: String,
    enum: ['pending', 'processing', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentAmount: {
    type: Number,
    default: 0
  },
  paymentCurrency: {
    type: String,
    default: 'UGX'
  },
  paymentReference: String,
  paymentDate: Date,
  paymentMethod: {
    type: String,
    enum: ['wallet', 'mobile_money', 'bank_transfer', 'card'],
    default: 'wallet'
  },
  paymentMetadata: {
    transactionId: String,
    walletId: String,
    senderId: String,
    recipientId: String,
    fees: Number,
    completedAt: Date
  },
  invoiceNumber: String,
  invoiceUrl: String,
  
  // Price configuration
  basePrice: Number,
  platformFee: Number,
  totalAmount: Number,
  
}, { 
  timestamps: true 
});

// Generate batch ID before saving - DEFINED BEFORE MODEL CREATION
exportBatchSchema.pre('save', function(next) {
  console.log('🚀 pre-save hook triggered!');
  console.log('Current batchId:', this.batchId);
  console.log('Is new document:', this.isNew);
  
  if (!this.batchId) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.batchId = `EXP-${year}${month}-${random}`;
    console.log(`✅ Auto-generated batchId: ${this.batchId}`);
  }
  next();
});

// Indexes
exportBatchSchema.index({ batchId: 1 });
exportBatchSchema.index({ exporterId: 1 });
exportBatchSchema.index({ status: 1 });
exportBatchSchema.index({ destinationMarket: 1 });
exportBatchSchema.index({ paymentStatus: 1 }); // Add index for payment queries
exportBatchSchema.index({ invoiceNumber: 1 }); // Add index for invoice lookups

const ExportBatch = mongoose.model('ExportBatch', exportBatchSchema);
export default ExportBatch;