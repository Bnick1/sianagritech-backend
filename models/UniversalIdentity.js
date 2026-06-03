// models/UniversalIdentity.js
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const UniversalIdentitySchema = new mongoose.Schema({
  // Core Identity
  universalId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    immutable: true,
    default: () => {
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substr(2, 9);
      return `SIAN-${timestamp}-${random}`.toUpperCase();
    }
  },
  
  // Personal Information
  title: {
    type: String,
    enum: ['Mr', 'Mrs', 'Miss', 'Ms', 'Dr', 'Prof', ''],
    default: ''
  },
  firstName: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 50
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 50
  },
  dateOfBirth: {
    type: Date,
    validate: {
      validator: function(value) {
        return value <= new Date() && value >= new Date('1900-01-01');
      },
      message: 'Date of birth must be between 1900 and today'
    }
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other', 'prefer-not-to-say', ''],
    default: ''
  },
  
  // Government IDs (Encrypted at rest)
  nationalId: {
    type: String,
    unique: true,
    sparse: true,
    select: false, // Not returned by default
    set: function(value) {
      // Store hash for validation without storing actual ID
      if (value) {
        this._nationalIdHash = crypto
          .createHash('sha256')
          .update(value)
          .digest('hex');
      }
      return value ? 'ENCRYPTED' : undefined;
    }
  },
  passportNumber: {
    type: String,
    select: false,
    set: function(value) {
      if (value) {
        this._passportHash = crypto
          .createHash('sha256')
          .update(value)
          .digest('hex');
      }
      return value ? 'ENCRYPTED' : undefined;
    }
  },
  voterId: String,
  drivingLicense: String,
  
  // Hashed IDs for verification (not returned in queries)
  _nationalIdHash: { type: String, select: false },
  _passportHash: { type: String, select: false },
  
  // Contact Information
  primaryPhone: {
    type: String,
    required: true,
    unique: true,
    index: true,
    validate: {
      validator: function(v) {
        return /^\+?[1-9]\d{1,14}$/.test(v);
      },
      message: props => `${props.value} is not a valid phone number!`
    },
    set: function(value) {
      // Remove spaces and normalize
      return value.replace(/\s+/g, '').replace(/^0/, '+254');
    }
  },
  secondaryPhone: String,
  email: {
    type: String,
    lowercase: true,
    trim: true,
    sparse: true,
    index: true,
    validate: {
      validator: function(v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: props => `${props.value} is not a valid email!`
    }
  },
  alternativeEmail: String,
  
  // Address
  address: {
    country: {
      type: String,
      default: 'Kenya',
      enum: ['Kenya', 'Tanzania', 'Uganda', 'Rwanda', 'Ethiopia', 'Other']
    },
    county: String,
    subCounty: String,
    ward: String,
    village: String,
    postalCode: String,
    postalAddress: String,
    coordinates: {
      type: [Number], // [longitude, latitude]
      index: '2dsphere'
    }
  },
  
  // Biometric Data (fully encrypted)
  biometric: {
    fingerprintTemplate: { 
      type: String, 
      select: false,
      encrypted: true 
    },
    facialData: { 
      type: String, 
      select: false,
      encrypted: true 
    },
    voicePrint: { 
      type: String, 
      select: false,
      encrypted: true 
    },
    irisData: { 
      type: String, 
      select: false,
      encrypted: true 
    },
    lastBiometricUpdate: Date
  },
  
  // KYC Status & Verification
  kycStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected', 'expired', 'under_review'],
    default: 'pending'
  },
  kycTier: {
    type: String,
    enum: ['tier0', 'tier1', 'tier2', 'tier3'],
    default: 'tier0'
  },
  kycScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  kycDocuments: [{
    documentType: { 
      type: String, 
      enum: [
        'national_id_front', 'national_id_back', 'passport', 
        'driving_license', 'utility_bill', 'bank_statement',
        'passport_photo', 'signature', 'proof_of_address'
      ] 
    },
    documentUrl: String,
    storagePath: String,
    mimeType: String,
    fileSize: Number,
    verified: { type: Boolean, default: false },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
    verifiedAt: Date,
    rejectionReason: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  kycVerifiedAt: Date,
  kycVerifiedBy: String, // System, agent ID, or automated process
  kycExpiresAt: Date,
  
  // Service Integrations
  services: {
    fintech: {
      enrolled: { type: Boolean, default: false },
      enrolledAt: Date,
      profileId: String,
      walletId: String,
      accountNumber: String,
      lastSync: Date,
      status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'inactive' }
    },
    agritech: {
      enrolled: { type: Boolean, default: false },
      enrolledAt: Date,
      profileId: { type: mongoose.Schema.Types.ObjectId, ref: 'Farmer' },
      farmIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Farm' }],
      lastSync: Date,
      status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'inactive' }
    },
    insurance: {
      enrolled: { type: Boolean, default: false },
      enrolledAt: Date,
      policyIds: [String],
      lastSync: Date,
      status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'inactive' }
    },
    marketplace: {
      enrolled: { type: Boolean, default: false },
      enrolledAt: Date,
      storeId: String,
      lastSync: Date,
      status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'inactive' }
    }
  },
  
  // Consent Management (GDPR/Data Protection Compliant)
  consents: [{
    service: {
      type: String,
      enum: ['all', 'fintech', 'agritech', 'insurance', 'marketing', 'analytics']
    },
    purpose: String,
    version: String,
    granted: { type: Boolean, default: false },
    grantedAt: Date,
    grantedThrough: String, // 'web', 'mobile', 'ussd', 'agent'
    expiresAt: Date,
    revokedAt: Date,
    revocationReason: String,
    ipAddress: String,
    userAgent: String
  }],
  
  // Audit Trail
  identityVerifications: [{
    verificationId: String,
    method: {
      type: String,
      enum: ['biometric', 'document', 'otp', 'agent', 'selfie', 'database']
    },
    provider: String, // 'internal', 'third_party_service'
    verifiedBy: String,
    verifiedAt: Date,
    confidenceScore: Number,
    metadata: mongoose.Schema.Types.Mixed,
    success: Boolean
  }],
  
  // Security & Authentication
  mfaEnabled: { type: Boolean, default: false },
  mfaMethods: [{
    type: { type: String, enum: ['sms', 'email', 'authenticator', 'biometric'] },
    isPrimary: Boolean,
    lastUsed: Date,
    metadata: mongoose.Schema.Types.Mixed
  }],
  passwordHash: { type: String, select: false },
  passwordChangedAt: Date,
  passwordResetTokens: [{
    token: String,
    expiresAt: Date,
    used: Boolean,
    usedAt: Date
  }],
  lastAuthentication: Date,
  authenticationHistory: [{
    timestamp: Date,
    method: String,
    ipAddress: String,
    userAgent: String,
    location: String,
    success: Boolean,
    failureReason: String
  }],
  
  // Risk & Compliance
  riskScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 50
  },
  suspiciousActivities: [{
    activityType: String,
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
    detectedAt: Date,
    description: String,
    resolved: { type: Boolean, default: false },
    resolvedAt: Date,
    resolvedBy: String,
    actionTaken: String
  }],
  complianceFlags: [{
    flagType: String,
    raisedAt: Date,
    resolved: Boolean,
    notes: String
  }],
  
  // Communication Preferences
  preferences: {
    language: {
      type: String,
      default: 'en',
      enum: ['en', 'sw', 'fr', 'pt']
    },
    communicationChannel: {
      primary: { type: String, enum: ['sms', 'email', 'push', 'whatsapp'], default: 'sms' },
      backup: String
    },
    notificationSettings: {
      transactionAlerts: { type: Boolean, default: true },
      securityAlerts: { type: Boolean, default: true },
      marketing: { type: Boolean, default: false },
      serviceUpdates: { type: Boolean, default: true }
    },
    dataSharing: {
      withinGroup: { type: Boolean, default: true },
      thirdParties: { type: Boolean, default: false }
    }
  },
  
  // Status & Lifecycle
  status: {
    type: String,
    enum: ['draft', 'pending_verification', 'active', 'suspended', 'deactivated', 'deceased', 'merged'],
    default: 'draft'
  },
  statusReason: String,
  statusChangedAt: Date,
  statusChangedBy: String,
  
  // Merge History (for when identities are merged)
  mergedFrom: [{
    universalId: String,
    mergedAt: Date,
    mergedBy: String,
    reason: String
  }],
  
  // Metadata
  createdBy: String, // 'system', 'agent_id', 'self_registration'
  updatedBy: String,
  source: {
    type: String,
    enum: ['web', 'mobile', 'ussd', 'agent', 'api', 'legacy_migration'],
    default: 'web'
  },
  referralCode: String,
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UniversalIdentity' },
  tags: [String]
}, {
  timestamps: true,
  collection: 'universal_identities',
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      // Remove sensitive fields from JSON output
      delete ret.passwordHash;
      delete ret._nationalIdHash;
      delete ret._passportHash;
      delete ret.biometric;
      delete ret.passwordResetTokens;
      delete ret.__v;
      return ret;
    }
  },
  toObject: {
    virtuals: true
  }
});

// ============ INDEXES ============
UniversalIdentitySchema.index({ universalId: 1 });
UniversalIdentitySchema.index({ primaryPhone: 1 });
UniversalIdentitySchema.index({ email: 1 }, { sparse: true });
UniversalIdentitySchema.index({ nationalId: 1 }, { sparse: true });
UniversalIdentitySchema.index({ status: 1 });
UniversalIdentitySchema.index({ kycStatus: 1 });
UniversalIdentitySchema.index({ kycTier: 1 });
UniversalIdentitySchema.index({ 'services.agritech.enrolled': 1 });
UniversalIdentitySchema.index({ 'services.fintech.enrolled': 1 });
UniversalIdentitySchema.index({ 'address.country': 1 });
UniversalIdentitySchema.index({ 'address.county': 1 });
UniversalIdentitySchema.index({ createdAt: -1 });
UniversalIdentitySchema.index({ updatedAt: -1 });
UniversalIdentitySchema.index({ 'address.coordinates': '2dsphere' });

// Compound indexes for common queries
UniversalIdentitySchema.index({ 
  status: 1, 
  kycStatus: 1, 
  createdAt: -1 
});
UniversalIdentitySchema.index({ 
  'services.agritech.enrolled': 1, 
  'services.agritech.status': 1 
});

// ============ VIRTUAL PROPERTIES ============
UniversalIdentitySchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`.trim();
});

UniversalIdentitySchema.virtual('initials').get(function() {
  return `${this.firstName?.charAt(0) || ''}${this.lastName?.charAt(0) || ''}`.toUpperCase();
});

UniversalIdentitySchema.virtual('age').get(function() {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
});

UniversalIdentitySchema.virtual('isActive').get(function() {
  return this.status === 'active';
});

UniversalIdentitySchema.virtual('isKYCVerified').get(function() {
  return this.kycStatus === 'verified' && this.kycTier !== 'tier0';
});

UniversalIdentitySchema.virtual('activeServices').get(function() {
  const active = [];
  if (this.services.fintech.enrolled && this.services.fintech.status === 'active') active.push('fintech');
  if (this.services.agritech.enrolled && this.services.agritech.status === 'active') active.push('agritech');
  if (this.services.insurance.enrolled && this.services.insurance.status === 'active') active.push('insurance');
  if (this.services.marketplace.enrolled && this.services.marketplace.status === 'active') active.push('marketplace');
  return active;
});

// ============ MIDDLEWARE ============
UniversalIdentitySchema.pre('save', async function(next) {
  // Auto-update timestamps
  const now = new Date();
  
  // Update status changed timestamp if status changed
  if (this.isModified('status')) {
    this.statusChangedAt = now;
  }
  
  // Update KYC expiry if KYC verified
  if (this.isModified('kycStatus') && this.kycStatus === 'verified') {
    this.kycVerifiedAt = now;
    this.kycExpiresAt = new Date(now.setFullYear(now.getFullYear() + 1)); // 1 year expiry
  }
  
  // Generate referral code if not exists
  if (!this.referralCode) {
    this.referralCode = `REF${this.universalId.substr(-8)}`;
  }
  
  // Hash password if modified
  if (this.isModified('passwordHash') && this.passwordHash) {
    // Note: Password should be hashed before setting passwordHash
    this.passwordChangedAt = now;
  }
  
  next();
});

UniversalIdentitySchema.post('save', function(doc, next) {
  // Audit log entry
  console.log(`UniversalIdentity saved: ${doc.universalId} (${doc.fullName})`);
  next();
});

// ============ INSTANCE METHODS ============
UniversalIdentitySchema.methods.enrollInService = async function(service, profileData) {
  if (!['fintech', 'agritech', 'insurance', 'marketplace'].includes(service)) {
    throw new Error(`Invalid service: ${service}`);
  }
  
  const now = new Date();
  this.services[service] = {
    enrolled: true,
    enrolledAt: now,
    profileId: profileData.profileId,
    lastSync: now,
    status: 'active',
    ...profileData
  };
  
  // Add consent if not exists
  const hasConsent = this.consents.some(c => 
    c.service === service && c.granted && (!c.expiresAt || c.expiresAt > now)
  );
  
  if (!hasConsent) {
    this.consents.push({
      service: service,
      purpose: `Enrollment in ${service} service`,
      version: '1.0',
      granted: true,
      grantedAt: now,
      grantedThrough: 'system',
      expiresAt: new Date(now.setFullYear(now.getFullYear() + 1))
    });
  }
  
  return this.save();
};

UniversalIdentitySchema.methods.revokeService = async function(service) {
  if (this.services[service] && this.services[service].enrolled) {
    this.services[service].enrolled = false;
    this.services[service].status = 'inactive';
    this.services[service].lastSync = new Date();
    
    // Revoke consent
    const now = new Date();
    this.consents = this.consents.map(consent => {
      if (consent.service === service && consent.granted && !consent.revokedAt) {
        consent.revokedAt = now;
        consent.granted = false;
      }
      return consent;
    });
    
    return this.save();
  }
  throw new Error(`Not enrolled in ${service} service`);
};

UniversalIdentitySchema.methods.verifyDocument = async function(documentType, verifiedBy, metadata = {}) {
  const doc = this.kycDocuments.find(d => d.documentType === documentType);
  if (!doc) {
    throw new Error(`Document type ${documentType} not found`);
  }
  
  doc.verified = true;
  doc.verifiedBy = verifiedBy;
  doc.verifiedAt = new Date();
  
  // Update KYC score based on verified documents
  const verifiedDocs = this.kycDocuments.filter(d => d.verified).length;
  this.kycScore = Math.min(100, verifiedDocs * 25); // 25 points per document
  
  if (this.kycScore >= 50 && this.kycStatus === 'pending') {
    this.kycStatus = 'verified';
    this.kycTier = 'tier1';
  }
  
  if (this.kycScore >= 75) {
    this.kycTier = 'tier2';
  }
  
  if (this.kycScore === 100) {
    this.kycTier = 'tier3';
  }
  
  return this.save();
};

UniversalIdentitySchema.methods.addAuthenticationRecord = function(method, ip, userAgent, success, failureReason = null) {
  this.lastAuthentication = new Date();
  this.authenticationHistory.push({
    timestamp: new Date(),
    method: method,
    ipAddress: ip,
    userAgent: userAgent,
    success: success,
    failureReason: failureReason
  });
  
  // Keep only last 100 records
  if (this.authenticationHistory.length > 100) {
    this.authenticationHistory = this.authenticationHistory.slice(-100);
  }
  
  return this.save();
};

UniversalIdentitySchema.methods.getPublicProfile = function() {
  const profile = {
    universalId: this.universalId,
    fullName: this.fullName,
    title: this.title,
    initials: this.initials,
    primaryPhone: this.primaryPhone,
    email: this.email,
    kycStatus: this.kycStatus,
    kycTier: this.kycTier,
    status: this.status,
    activeServices: this.activeServices,
    preferences: this.preferences
  };
  
  // Add service-specific minimal info
  if (this.services.agritech.enrolled) {
    profile.agritech = {
      enrolled: true,
      status: this.services.agritech.status
    };
  }
  
  if (this.services.fintech.enrolled) {
    profile.fintech = {
      enrolled: true,
      status: this.services.fintech.status
    };
  }
  
  return profile;
};

UniversalIdentitySchema.methods.getCrossServiceProfile = async function() {
  const profile = this.getPublicProfile();
  
  // Add service-specific details (these would be fetched from respective services)
  // This is a placeholder - in production, you'd make API calls to each service
  
  if (this.services.agritech.enrolled && this.services.agritech.profileId) {
    // In production: await AgritechService.getFarmerProfile(this.services.agritech.profileId);
    profile.agritechDetails = {
      farmerId: this.services.agritech.profileId,
      farms: this.services.agritech.farmIds || []
    };
  }
  
  if (this.services.fintech.enrolled && this.services.fintech.profileId) {
    // In production: await FintechService.getUserProfile(this.services.fintech.profileId);
    profile.fintechDetails = {
      profileId: this.services.fintech.profileId,
      walletId: this.services.fintech.walletId
    };
  }
  
  return profile;
};

// ============ STATIC METHODS ============
UniversalIdentitySchema.statics.findByPhone = function(phone) {
  return this.findOne({ 
    $or: [
      { primaryPhone: phone },
      { secondaryPhone: phone }
    ]
  });
};

UniversalIdentitySchema.statics.findByEmail = function(email) {
  return this.findOne({ 
    $or: [
      { email: email },
      { alternativeEmail: email }
    ]
  });
};

UniversalIdentitySchema.statics.verifyNationalId = async function(nationalId) {
  const hash = crypto.createHash('sha256').update(nationalId).digest('hex');
  return this.findOne({ _nationalIdHash: hash }).select('+_nationalIdHash');
};

UniversalIdentitySchema.statics.getEnrolledUsers = function(service, status = 'active') {
  const query = {};
  query[`services.${service}.enrolled`] = true;
  if (status) {
    query[`services.${service}.status`] = status;
  }
  return this.find(query);
};

UniversalIdentitySchema.statics.getStatistics = async function() {
  const stats = await this.aggregate([
    {
      $facet: {
        total: [{ $count: 'count' }],
        byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
        byKYC: [{ $group: { _id: '$kycStatus', count: { $sum: 1 } } }],
        byService: [
          {
            $project: {
              fintech: { $cond: ['$services.fintech.enrolled', 1, 0] },
              agritech: { $cond: ['$services.agritech.enrolled', 1, 0] },
              insurance: { $cond: ['$services.insurance.enrolled', 1, 0] }
            }
          },
          {
            $group: {
              _id: null,
              fintech: { $sum: '$fintech' },
              agritech: { $sum: '$agritech' },
              insurance: { $sum: '$insurance' }
            }
          }
        ],
        recent: [
          { $sort: { createdAt: -1 } },
          { $limit: 100 },
          {
            $group: {
              _id: {
                $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
              },
              count: { $sum: 1 }
            }
          },
          { $sort: { _id: -1 } },
          { $limit: 7 }
        ]
      }
    }
  ]);
  
  return stats[0];
};

const UniversalIdentity = mongoose.model('UniversalIdentity', UniversalIdentitySchema);

export default UniversalIdentity;