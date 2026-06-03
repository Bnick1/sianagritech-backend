import mongoose from 'mongoose';

const exporterSchema = new mongoose.Schema({
  companyName: { 
    type: String, 
    required: true 
  },
  registrationNumber: String,
  country: { 
    type: String, 
    default: 'Uganda' 
  },
  contactPerson: String,
  email: String,
  phone: String,
  
  // UK/EU specific
  ukAgentName: String,
  ukAgentEmail: String,
  portOfEntry: { 
    type: String, 
    default: 'Felixstowe' 
  },
  
  // Compliance tracking
  complianceScore: { 
    type: Number, 
    default: 0 
  },
  lastAuditDate: Date,
  certificationStatus: {
    type: String,
    enum: ['pending', 'active', 'expired'],
    default: 'pending'
  },
  
  // Linked farmers
  farmers: [{
    farmerId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Farmer' 
    },
    farmName: String,
    location: String,
    joinDate: { 
      type: Date, 
      default: Date.now 
    },
    status: { 
      type: String, 
      default: 'active' 
    }
  }],
  
  // Export batches
  exportBatches: [{
    batchId: String,
    cropType: String,
    quantity: Number,
    destinationCountry: String,
    exportDate: Date,
    complianceReport: String,
    status: { 
      type: String, 
      default: 'pending' 
    }
  }]
}, { 
  timestamps: true 
});

// Index for faster queries
exporterSchema.index({ companyName: 1 });
exporterSchema.index({ country: 1 });
exporterSchema.index({ complianceScore: -1 });

const Exporter = mongoose.model('Exporter', exporterSchema);
export default Exporter;