import mongoose from 'mongoose';

const ukStandardSchema = new mongoose.Schema({
  standardId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  category: {
    type: String,
    enum: [
      'pesticides', 
      'traceability', 
      'food-safety', 
      'documentation', 
      'verification',
      'sustainability',
      'labelling',
      'hygiene'
    ],
    required: true
  },
  requirement: {
    type: String,
    required: true
  },
  description: String,
  authority: {
    type: String,
    enum: ['DEFRA', 'FSA', 'HMRC', 'PORT-HEALTH', 'EU_COMMISSION', 'TRADE_BODY'],
    required: true
  },
  isMandatory: { 
    type: Boolean, 
    default: true 
  },
  applicableCrops: [String],
  applicableProducts: [String], // For minerals: gold, coffee, etc.
  validationRule: {
    type: {
      type: String,
      enum: ['date', 'boolean', 'document', 'coordinates', 'certificate', 'test_result']
    },
    params: Object,
    errorMessage: String
  },
  evidenceRequired: {
    type: [String],
    default: []
  },
  verificationMethod: {
    type: String,
    enum: ['self-declaration', 'third-party', 'government', 'automated'],
    default: 'self-declaration'
  },
  version: { 
    type: String, 
    default: '2026.1' 
  },
  effectiveFrom: { 
    type: Date, 
    default: Date.now 
  },
  effectiveTo: Date,
  active: { 
    type: Boolean, 
    default: true 
  },
  market: {
    type: [String],
    enum: ['UK', 'EU', 'USA', 'UAE', 'JAPAN'],
    default: ['UK', 'EU']
  }
}, { 
  timestamps: true 
});

ukStandardSchema.index({ standardId: 1 });
ukStandardSchema.index({ category: 1 });
ukStandardSchema.index({ authority: 1 });
ukStandardSchema.index({ market: 1 });

const UKStandard = mongoose.model('UKStandard', ukStandardSchema);

// Initialize default standards if collection is empty
export const initializeDefaultStandards = async () => {
  const count = await UKStandard.countDocuments();
  if (count === 0) {
    console.log('📝 Initializing default UK/EU compliance standards...');
    
    const defaultStandards = [
      // Pesticides
      {
        standardId: 'PEST-001',
        category: 'pesticides',
        requirement: 'Pesticide Application Records',
        description: 'Complete records of all pesticide applications including dates, products, and quantities',
        authority: 'DEFRA',
        validationRule: {
          type: 'document',
          errorMessage: 'Pesticide records must include date, product name, and quantity'
        },
        evidenceRequired: ['application_log', 'product_invoice'],
        market: ['UK', 'EU']
      },
      {
        standardId: 'PEST-002',
        category: 'pesticides',
        requirement: 'Maximum Residue Levels (MRL) Compliance',
        description: 'All pesticides used must comply with UK/EU MRL standards',
        authority: 'FSA',
        validationRule: {
          type: 'certificate',
          errorMessage: 'Pesticide residue test results required'
        },
        evidenceRequired: ['lab_test_report'],
        market: ['UK', 'EU']
      },
      
      // Traceability
      {
        standardId: 'TRACE-001',
        category: 'traceability',
        requirement: 'Batch Traceability System',
        description: 'System to track produce from farm to export container',
        authority: 'DEFRA',
        validationRule: {
          type: 'boolean',
          errorMessage: 'Traceability system must be documented'
        },
        evidenceRequired: ['system_documentation'],
        market: ['UK', 'EU']
      },
      {
        standardId: 'TRACE-002',
        category: 'traceability',
        requirement: 'One-step-forward/one-step-back traceability',
        description: 'Ability to trace product one step forward and one step back in supply chain',
        authority: 'FSA',
        validationRule: {
          type: 'document',
          errorMessage: 'Supply chain mapping required'
        },
        evidenceRequired: ['supplier_list', 'customer_list'],
        market: ['UK', 'EU']
      },
      
      // Food Safety
      {
        standardId: 'FS-001',
        category: 'food-safety',
        requirement: 'HACCP Plan',
        description: 'Hazard Analysis Critical Control Point plan must be in place',
        authority: 'FSA',
        validationRule: {
          type: 'document',
          errorMessage: 'Valid HACCP plan required'
        },
        evidenceRequired: ['haccp_plan', 'implementation_records'],
        market: ['UK', 'EU']
      },
      {
        standardId: 'FS-002',
        category: 'food-safety',
        requirement: 'Food Safety Management System',
        description: 'ISO 22000 or equivalent certification',
        authority: 'FSA',
        validationRule: {
          type: 'certificate',
          errorMessage: 'Valid food safety certification required'
        },
        evidenceRequired: ['certificate'],
        market: ['UK', 'EU']
      },
      
      // Documentation
      {
        standardId: 'DOC-001',
        category: 'documentation',
        requirement: 'Export Health Certificate',
        description: 'Official export health certificate from competent authority',
        authority: 'PORT-HEALTH',
        validationRule: {
          type: 'document',
          errorMessage: 'Valid export health certificate required'
        },
        evidenceRequired: ['health_certificate'],
        market: ['UK', 'EU']
      },
      {
        standardId: 'DOC-002',
        category: 'documentation',
        requirement: 'Certificate of Origin',
        description: 'Proof of product origin for tariff purposes',
        authority: 'HMRC',
        validationRule: {
          type: 'document',
          errorMessage: 'Certificate of origin required'
        },
        evidenceRequired: ['origin_certificate'],
        market: ['UK']
      },
      
      // Verification
      {
        standardId: 'VER-001',
        category: 'verification',
        requirement: 'Geospatial Farm Location',
        description: 'Precise GPS coordinates of farm boundaries',
        authority: 'DEFRA',
        validationRule: {
          type: 'coordinates',
          errorMessage: 'Valid farm coordinates required'
        },
        evidenceRequired: ['gps_data'],
        market: ['UK', 'EU']
      },
      {
        standardId: 'VER-002',
        category: 'verification',
        requirement: 'Third-party Audit Report',
        description: 'Annual audit by approved certification body',
        authority: 'DEFRA',
        validationRule: {
          type: 'document',
          errorMessage: 'Current audit report required'
        },
        evidenceRequired: ['audit_report'],
        verificationMethod: 'third-party',
        market: ['UK', 'EU']
      },
      
      // Sustainability
      {
        standardId: 'SUS-001',
        category: 'sustainability',
        requirement: 'Carbon Footprint Assessment',
        description: 'Documentation of farm-level carbon emissions',
        authority: 'DEFRA',
        validationRule: {
          type: 'document',
          errorMessage: 'Carbon assessment required'
        },
        evidenceRequired: ['carbon_report'],
        market: ['UK']
      },
      {
        standardId: 'SUS-002',
        category: 'sustainability',
        requirement: 'Water Usage Records',
        description: 'Documentation of water consumption and source',
        authority: 'DEFRA',
        validationRule: {
          type: 'document',
          errorMessage: 'Water usage records required'
        },
        evidenceRequired: ['water_logs'],
        market: ['UK', 'EU']
      },
      
      // Hygiene
      {
        standardId: 'HYG-001',
        category: 'hygiene',
        requirement: 'Worker Hygiene Training',
        description: 'Food handling and hygiene training records',
        authority: 'FSA',
        validationRule: {
          type: 'document',
          errorMessage: 'Training records required'
        },
        evidenceRequired: ['training_certificates'],
        market: ['UK', 'EU']
      },
      {
        standardId: 'HYG-002',
        category: 'hygiene',
        requirement: 'Facility Sanitation Records',
        description: 'Cleaning and sanitation logs',
        authority: 'FSA',
        validationRule: {
          type: 'document',
          errorMessage: 'Sanitation records required'
        },
        evidenceRequired: ['cleaning_logs'],
        market: ['UK', 'EU']
      }
    ];
    
    await UKStandard.insertMany(defaultStandards);
    console.log(`✅ ${defaultStandards.length} UK/EU standards initialized`);
  }
};

export default UKStandard;