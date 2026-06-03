import mongoose from 'mongoose';

const mineralBatchSchema = new mongoose.Schema({
  batchId: { type: String, required: true, unique: true },
  exporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exporter', required: true },
  
  // Mineral details
  mineralType: { 
    type: String, 
    enum: ['Gold', 'Tin', 'Tungsten', 'Tantalum', 'Copper', 'Cobalt', 'Coltan'],
    required: true 
  },
  quantity: Number,
  unit: { type: String, default: 'kg' },
  purity: Number, // For gold, etc.
  
  // Origin & Traceability
  mineOrigin: {
    name: String,
    location: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    },
    licenseNumber: String,
    licenseExpiry: Date,
    
    // SianGeo integration point
    geoVerified: { type: Boolean, default: false },
    geoVerifiedDate: Date,
    satelliteImageUrl: String
  },
  
  // Chain of custody
  chainOfCustody: [{
    stage: { 
      type: String, 
      enum: ['mine', 'trader', 'processor', 'exporter', 'refinery', 'smelter'] 
    },
    entity: String,
    entityId: String,
    date: Date,
    documents: [String],
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    verifiedAt: Date
  }],
  
  // Government compliance
  exportLicense: {
    number: String,
    issueDate: Date,
    expiryDate: Date,
    issuingAuthority: { type: String, enum: ['DGSM', 'MEMD', 'URA'] },
    verified: { type: Boolean, default: false }
  },
  
  // Assay/certification
  assayReport: {
    labName: String,
    reportDate: Date,
    reportUrl: String,
    verified: { type: Boolean, default: false },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  
  // SianFinTech integration (wallet/payments)
  financial: {
    royaltyPaid: { type: Boolean, default: false },
    royaltyAmount: Number,
    royaltyPaymentId: String, // Reference to SianWallet transaction
    taxPaid: { type: Boolean, default: false },
    taxAmount: Number,
    taxPaymentId: String,
    totalValue: Number,
    paymentStatus: { 
      type: String, 
      enum: ['pending', 'partial', 'completed'],
      default: 'pending'
    }
  },
  
  // Destination
  destinationMarket: { type: String, enum: ['UK', 'EU', 'UAE', 'CHINA', 'OTHER'] },
  destinationCountry: String,
  buyerDetails: {
    name: String,
    country: String,
    licenseNumber: String,
    verified: { type: Boolean, default: false }
  },
  
  // Status
  status: {
    type: String,
    enum: ['draft', 'pending', 'verified', 'exported', 'delivered', 'rejected'],
    default: 'draft'
  },
  
  // Compliance tracking
  complianceScore: { type: Number, default: 0 },
  complianceReport: {
    url: String,
    generatedAt: Date
  },
  
  // Metadata
  tags: [String],
  notes: String
}, { 
  timestamps: true 
});

// Indexes for fast queries
mineralBatchSchema.index({ batchId: 1 });
mineralBatchSchema.index({ mineralType: 1 });
mineralBatchSchema.index({ status: 1 });
mineralBatchSchema.index({ 'mineOrigin.licenseNumber': 1 });
mineralBatchSchema.index({ 'exportLicense.number': 1 });

export default mongoose.model('MineralBatch', mineralBatchSchema);