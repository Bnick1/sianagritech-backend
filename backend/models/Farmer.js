// backend/models/Farmer.js
import mongoose from 'mongoose';

const farmerSchema = new mongoose.Schema({
  // Core identification
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  
  // Universal ID for cross-platform integration
  universalId: {
    type: String,
    index: true
  },
  
  // Location details
  location: {
    district: { type: String, required: true },
    subcounty: String,
    parish: String,
    village: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  
  // Farm information
  farmSize: { type: Number, default: 0 }, // in acres
  farmCount: { type: Number, default: 1 },
  primaryCrop: String,
  farmingExperience: Number, // in years
  
  // Financial integration
  fintechLinked: { type: Boolean, default: false },
  fintechUserId: String,
  fintechAccountNumber: String,
  
  // USSD/SMS interaction
  ussdSession: {
    currentMenu: String,
    sessionData: mongoose.Schema.Types.Mixed,
    lastActivity: Date
  },
  
  // Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'pending', 'suspended'],
    default: 'active'
  },
  
  // Verification
  isVerified: { type: Boolean, default: false },
  verificationMethod: {
    type: String,
    enum: ['ussd', 'sms', 'agent', 'none'],
    default: 'none'
  },
  
  // Metadata
  registeredVia: {
    type: String,
    enum: ['ussd', 'sms', 'web', 'app', 'agent'],
    default: 'ussd'
  },
  registeredBy: String, // Agent ID or system
  
  // Timestamps
  lastLogin: Date,
  lastHarvest: Date,
  lastLoanApplication: Date
}, {
  timestamps: true,
  collection: 'farmers'
});

// Indexes for performance
farmerSchema.index({ phone: 1 });
farmerSchema.index({ 'location.district': 1 });
farmerSchema.index({ status: 1, isVerified: 1 });
farmerSchema.index({ universalId: 1 }, { sparse: true });

// Virtual for full location
farmerSchema.virtual('fullLocation').get(function() {
  const parts = [this.location.village, this.location.parish, this.location.subcounty, this.location.district];
  return parts.filter(p => p).join(', ');
});

// Method to update USSD session
farmerSchema.methods.updateUssdSession = function(menu, data = {}) {
  this.ussdSession = {
    currentMenu: menu,
    sessionData: { ...this.ussdSession?.sessionData, ...data },
    lastActivity: new Date()
  };
  return this.save();
};

// Static method to find by phone with fuzzy matching
farmerSchema.statics.findByPhone = function(phone) {
  const cleanPhone = phone.replace(/\D/g, '');
  const last9 = cleanPhone.slice(-9);
  
  return this.findOne({
    $or: [
      { phone: cleanPhone },
      { phone: { $regex: last9, $options: 'i' } }
    ]
  });
};

export default mongoose.model('Farmer', farmerSchema);