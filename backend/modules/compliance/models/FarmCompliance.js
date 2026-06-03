import mongoose from 'mongoose';

const farmComplianceSchema = new mongoose.Schema({
  farmerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Farmer', 
    required: true 
  },
  exporterId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Exporter' 
  },
  
  // Farm details
  farmName: String,
  location: String,
  coordinates: {
    latitude: Number,
    longitude: Number
  },
  
  // Compliance records
  pesticideRecords: [{
    date: Date,
    product: String,
    quantity: Number,
    verified: { type: Boolean, default: false }
  }],
  
  soilTestRecords: [{
    date: Date,
    labName: String,
    results: Object,
    validUntil: Date
  }],
  
  waterQualityTests: [{
    date: Date,
    passed: Boolean,
    reportUrl: String
  }],
  
  harvestRecords: [{
    date: Date,
    crop: String,
    quantity: Number,
    fieldLocation: String
  }],
  
  // UK/EU specific compliance flags
  ukCompliant: { type: Boolean, default: false },
  euCompliant: { type: Boolean, default: false },
  lastComplianceCheck: Date,
  complianceNotes: String,
  
  // Documents
  documents: [{
    type: { type: String },
    url: String,
    uploadDate: { type: Date, default: Date.now },
    verified: { type: Boolean, default: false }
  }],
  
  // Geospatial verification
  geoVerified: { type: Boolean, default: false },
  geoVerifiedDate: Date,
  satelliteImageAvailable: { type: Boolean, default: false }
}, { 
  timestamps: true 
});

// Indexes
farmComplianceSchema.index({ farmerId: 1 });
farmComplianceSchema.index({ exporterId: 1 });
farmComplianceSchema.index({ ukCompliant: 1 });
farmComplianceSchema.index({ geoVerified: 1 });

const FarmCompliance = mongoose.model('FarmCompliance', farmComplianceSchema);
export default FarmCompliance;