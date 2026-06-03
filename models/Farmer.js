import mongoose from 'mongoose';

const farmerSchema = new mongoose.Schema({
  // Authentication & Identity
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    sparse: true
  },
  nationalId: {
    type: String,
    trim: true,
    sparse: true
  },
  password: {
    type: String,
    required: true
  },
  
  // FARM RELATIONSHIP - ADDED THIS
  farms: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Farm'
  }],
  
  // Account Status
  role: {
    type: String,
    enum: ['farmer', 'agent', 'admin', 'viewer'],
    default: 'farmer'
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'suspended', 'inactive'],
    default: 'pending'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  
  // Verification Fields
  verificationCode: {
    type: String,
    select: false
  },
  verificationExpires: {
    type: Date,
    select: false
  },
  verifiedAt: Date,
  
  // Password Reset
  resetPasswordCode: {
    type: String,
    select: false
  },
  resetPasswordExpires: {
    type: Date,
    select: false
  },
  
  // Location
  location: {
    district: String,
    subCounty: String,
    village: String,
    coordinates: {
      type: [Number], // [longitude, latitude]
      index: '2dsphere'
    },
    altitude: Number
  },
  
  // Farm Details
  farmSize: {
    type: Number,
    min: 0.1,
    max: 1000
  },
  primaryCrop: {
    type: String,
    enum: ['maize', 'coffee', 'tea', 'bananas', 'beans', 'rice', 'wheat', 'sorghum', 'other']
  },
  farmingExperience: {
    type: Number, // years
    min: 0,
    max: 100
  },
  
  // Contact Information
  emergencyContact: {
    name: String,
    phone: String,
    relationship: String
  },
  
  // Financial Information
  bankAccount: {
    bankName: String,
    accountNumber: String,
    accountName: String,
    branch: String
  },
  mpesaNumber: String,
  
  // Activity Tracking
  lastLogin: Date,
  loginCount: {
    type: Number,
    default: 0
  },
  lastActive: Date,
  
  // Devices
  devices: [{
    deviceId: String,
    deviceType: String,
    lastSeen: Date,
    appVersion: String
  }],
  
  // Preferences
  preferences: {
    language: {
      type: String,
      default: 'en',
      enum: ['en', 'sw', 'fr', 'pt']
    },
    notifications: {
      sms: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      email: { type: Boolean, default: false }
    },
    measurementUnit: {
      type: String,
      default: 'metric',
      enum: ['metric', 'imperial']
    }
  },
  
  // Metadata
  registrationSource: {
    type: String,
    enum: ['ussd', 'web', 'mobile', 'agent', 'api'],
    default: 'web'
  },
  referralCode: String,
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Farmer'
  },
  
  // Agent Specific Fields (if role is agent)
  agentDetails: {
    code: String,
    region: String,
    farmersCount: Number,
    performanceScore: Number
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.verificationCode;
      delete ret.resetPasswordCode;
      return ret;
    }
  }
});

// Indexes
farmerSchema.index({ phone: 1 });
farmerSchema.index({ email: 1 }, { sparse: true });
farmerSchema.index({ status: 1 });
farmerSchema.index({ role: 1 });
farmerSchema.index({ 'location.district': 1 });
farmerSchema.index({ createdAt: -1 });
farmerSchema.index({ 'location.coordinates': '2dsphere' });

// Virtual for full name
farmerSchema.virtual('fullName').get(function() {
  return this.name;
});

// Pre-save middleware
farmerSchema.pre('save', function(next) {
  if (this.isModified('password')) {
    // Password hashing will be done in controller
  }
  next();
});

// Method to get public profile
farmerSchema.methods.getPublicProfile = function() {
  const farmer = this.toObject();
  delete farmer.password;
  delete farmer.verificationCode;
  delete farmer.resetPasswordCode;
  delete farmer.__v;
  return farmer;
};

const Farmer = mongoose.model('Farmer', farmerSchema);

export default Farmer;