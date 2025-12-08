// models/UniversalIdentity.js
import mongoose from 'mongoose';

const UniversalIdentitySchema = new mongoose.Schema({
  // Core Identity
  universalId: {
    type: String,
    required: true,
    unique: true,
    default: () => `SIAN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`.toUpperCase()
  },
  
  // Biometric/Physical Identity
  nationalId: {
    type: String,
    unique: true,
    sparse: true
  },
  passportNumber: String,
  voterId: String,
  
  // Contact Information
  primaryPhone: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    lowercase: true,
    sparse: true
  },
  
  // Biometric Data (encrypted)
  biometric: {
    fingerprintHash: { type: String, select: false },
    facialRecognitionHash: { type: String, select: false },
    voicePrintHash: { type: String, select: false }
  },
  
  // KYC Status
  kycStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected', 'expired'],
    default: 'pending'
  },
  kycTier: {
    type: String,
    enum: ['tier1', 'tier2', 'tier3'],
    default: 'tier1'
  },
  kycDocuments: [{
    type: { type: String, enum: ['national_id', 'passport', 'utility_bill', 'photo'] },
    url: String,
    verified: Boolean,
    verifiedAt: Date
  }],
  
  // Service Opt-ins
  services: {
    fintech: {
      enrolled: { type: Boolean, default: false },
      enrolledAt: Date,
      profileId: String, // Reference to SianFinTech user ID
      lastSync: Date
    },
    agritech: {
      enrolled: { type: Boolean, default: false },
      enrolledAt: Date,
      profileId: String, // Reference to SianAgriTech farmer ID
      lastSync: Date
    },
    insurance: {
      enrolled: { type: Boolean, default: false },
      enrolledAt: Date
    }
  },
  
  // Consent Management
  consents: [{
    service: String,
    purpose: String,
    granted: Boolean,
    grantedAt: Date,
    expiresAt: Date,
    version: String
  }],
  
  // Audit Trail
  identityVerifications: [{
    method: String,
    verifiedBy: String, // System or agent ID
    verifiedAt: Date,
    confidenceScore: Number
  }],
  
  // Security
  mfaEnabled: { type: Boolean, default: false },
  mfaMethods: [String],
  lastAuthentication: Date,
  suspiciousActivities: [{
    type: String,
    detectedAt: Date,
    resolved: Boolean
  }],
  
  // Status
  status: {
    type: String,
    enum: ['active', 'suspended', 'deactivated', 'deceased'],
    default: 'active'
  }
}, {
  timestamps: true,
  collection: 'universal_identities'
});

// Indexes
UniversalIdentitySchema.index({ universalId: 1 });
UniversalIdentitySchema.index({ primaryPhone: 1 });
UniversalIdentitySchema.index({ nationalId: 1 });
UniversalIdentitySchema.index({ 'services.fintech.enrolled': 1 });
UniversalIdentitySchema.index({ 'services.agritech.enrolled': 1 });
UniversalIdentitySchema.index({ kycStatus: 1 });

// Methods
UniversalIdentitySchema.methods.enrollInService = async function(service, profileId) {
  this.services[service] = {
    enrolled: true,
    enrolledAt: new Date(),
    profileId: profileId,
    lastSync: new Date()
  };
  return this.save();
};

UniversalIdentitySchema.methods.getCrossServiceProfile = async function() {
  const profile = {
    universalId: this.universalId,
    basicInfo: {
      phone: this.primaryPhone,
      email: this.email,
      kycStatus: this.kycStatus
    }
  };
  
  // Fetch from each service if enrolled
  if (this.services.fintech.enrolled) {
    // Call FinTech service
    profile.fintech = await FintechService.getProfile(this.services.fintech.profileId);
  }
  
  if (this.services.agritech.enrolled) {
    // Call AgriTech service
    profile.agritech = await AgritechService.getProfile(this.services.agritech.profileId);
  }
  
  return profile;
};

export default mongoose.model('UniversalIdentity', UniversalIdentitySchema);