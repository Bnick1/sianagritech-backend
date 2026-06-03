// UK/EU import requirements for agricultural products
// Version: 2.0 - Expanded with 16 standards and market-specific requirements

export const UK_COMPLIANCE_CHECKLIST = [
  // Pesticides Category
  {
    id: 'pesticide_records',
    category: 'pesticides',
    requirement: 'Pesticide Application Records',
    description: 'Complete records of all pesticide applications including dates, products, and quantities',
    validation: (farmData) => farmData.pesticideRecords?.length > 0,
    authority: 'DEFRA',
    evidenceRequired: ['application_log', 'product_invoice']
  },
  {
    id: 'mrl_compliance',
    category: 'pesticides',
    requirement: 'Maximum Residue Levels (MRL) Compliance',
    description: 'All pesticides used must comply with UK/EU MRL standards',
    validation: (farmData) => farmData.mrlTestPassed === true || farmData.mrlCertificate?.valid === true,
    authority: 'FSA',
    evidenceRequired: ['lab_test_report']
  },

  // Traceability Category
  {
    id: 'location_data',
    category: 'traceability',
    requirement: 'Geospatial Farm Location',
    description: 'Precise GPS coordinates of farm boundaries and cultivation areas',
    validation: (farmData) => farmData.coordinates && farmData.geoVerified === true,
    authority: 'DEFRA',
    evidenceRequired: ['gps_data']
  },
  {
    id: 'traceability_batch',
    category: 'traceability',
    requirement: 'Batch Traceability System',
    description: 'System to track produce from field to export container (one-step-forward/one-step-back)',
    validation: (farmData) => farmData.hasTraceabilitySystem === true,
    authority: 'FSA',
    evidenceRequired: ['system_documentation']
  },
  {
    id: 'supply_chain_mapping',
    category: 'traceability',
    requirement: 'Supply Chain Mapping',
    description: 'Documented map of suppliers and customers in the supply chain',
    validation: (farmData) => farmData.supplyChainMap === true,
    authority: 'FSA',
    evidenceRequired: ['supplier_list', 'customer_list']
  },

  // Food Safety Category
  {
    id: 'haccp_plan',
    category: 'food-safety',
    requirement: 'HACCP Plan',
    description: 'Hazard Analysis Critical Control Point plan must be in place',
    validation: (farmData) => farmData.hasHACCP === true,
    authority: 'FSA',
    evidenceRequired: ['haccp_plan', 'implementation_records']
  },
  {
    id: 'food_safety_cert',
    category: 'food-safety',
    requirement: 'Food Safety Certification',
    description: 'ISO 22000, BRC, or equivalent certification',
    validation: (farmData) => farmData.foodSafetyCert?.valid === true,
    authority: 'FSA',
    evidenceRequired: ['certificate']
  },
  {
    id: 'storage_conditions',
    category: 'food-safety',
    requirement: 'Post-Harvest Storage Logs',
    description: 'Temperature and humidity monitoring records',
    validation: (farmData) => farmData.storageLogs?.length > 0,
    authority: 'FSA',
    evidenceRequired: ['temperature_logs', 'humidity_logs']
  },

  // Documentation Category
  {
    id: 'soil_testing',
    category: 'documentation',
    requirement: 'Recent Soil Analysis',
    description: 'Soil test results within last 12 months',
    validation: (farmData) => farmData.soilTestDate && 
      (new Date() - new Date(farmData.soilTestDate)) < 365 * 24 * 60 * 60 * 1000,
    authority: 'DEFRA',
    evidenceRequired: ['lab_report']
  },
  {
    id: 'water_quality',
    category: 'documentation',
    requirement: 'Water Quality Reports',
    description: 'Irrigation water quality testing results within last 12 months',
    validation: (farmData) => farmData.waterQualityPassed === true && 
      farmData.waterTestDate && (new Date() - new Date(farmData.waterTestDate)) < 365 * 24 * 60 * 60 * 1000,
    authority: 'DEFRA',
    evidenceRequired: ['water_test_report']
  },
  {
    id: 'harvest_records',
    category: 'documentation',
    requirement: 'Harvest Documentation',
    description: 'Detailed harvest dates, quantities, and field origins',
    validation: (farmData) => farmData.harvestRecords?.length > 0,
    authority: 'DEFRA',
    evidenceRequired: ['harvest_logs']
  },
  {
    id: 'export_health_certificate',
    category: 'documentation',
    requirement: 'Export Health Certificate',
    description: 'Official export health certificate from competent authority',
    validation: (farmData) => farmData.healthCertificate?.valid === true,
    authority: 'PORT-HEALTH',
    evidenceRequired: ['health_certificate']
  },
  {
    id: 'certificate_of_origin',
    category: 'documentation',
    requirement: 'Certificate of Origin',
    description: 'Proof of product origin for tariff purposes',
    validation: (farmData) => farmData.originCertificate?.valid === true,
    authority: 'HMRC',
    evidenceRequired: ['origin_certificate']
  },

  // Verification Category
  {
    id: 'third_party_audit',
    category: 'verification',
    requirement: 'Third-party Audit Report',
    description: 'Annual audit by approved certification body',
    validation: (farmData) => farmData.auditReport?.valid === true && 
      (new Date() - new Date(farmData.auditDate)) < 365 * 24 * 60 * 60 * 1000,
    authority: 'DEFRA',
    evidenceRequired: ['audit_report']
  },

  // Sustainability Category
  {
    id: 'carbon_footprint',
    category: 'sustainability',
    requirement: 'Carbon Footprint Assessment',
    description: 'Documentation of farm-level carbon emissions',
    validation: (farmData) => farmData.carbonAssessed === true,
    authority: 'DEFRA',
    evidenceRequired: ['carbon_report']
  },
  {
    id: 'water_usage',
    category: 'sustainability',
    requirement: 'Water Usage Records',
    description: 'Documentation of water consumption and source',
    validation: (farmData) => farmData.waterUsageLogs?.length > 0,
    authority: 'DEFRA',
    evidenceRequired: ['water_logs']
  },

  // Hygiene Category
  {
    id: 'worker_training',
    category: 'hygiene',
    requirement: 'Worker Hygiene Training',
    description: 'Documentation of food safety and handling training',
    validation: (farmData) => farmData.trainingRecords?.length > 0,
    authority: 'FSA',
    evidenceRequired: ['training_certificates']
  },
  {
    id: 'facility_sanitation',
    category: 'hygiene',
    requirement: 'Facility Sanitation Records',
    description: 'Cleaning and sanitation logs',
    validation: (farmData) => farmData.sanitationLogs?.length > 0,
    authority: 'FSA',
    evidenceRequired: ['cleaning_logs']
  },

  // Agricultural Practices
  {
    id: 'pest_management',
    category: 'agriculture',
    requirement: 'Integrated Pest Management Plan',
    description: 'Documented IPM strategy and monitoring records',
    validation: (farmData) => farmData.hasIPMPlan === true,
    authority: 'DEFRA',
    evidenceRequired: ['ipm_plan', 'monitoring_records']
  },
  {
    id: 'fertilizer_records',
    category: 'agriculture',
    requirement: 'Fertilizer Application Logs',
    description: 'Records of all fertilizer applications',
    validation: (farmData) => farmData.fertilizerRecords?.length > 0,
    authority: 'DEFRA',
    evidenceRequired: ['fertilizer_logs']
  }
];

export const validateFarmAgainstUKStandards = (farmData) => {
  return UK_COMPLIANCE_CHECKLIST.map(item => ({
    id: item.id,
    category: item.category,
    requirement: item.requirement,
    description: item.description,
    authority: item.authority,
    passed: item.validation(farmData),
    notes: item.validation(farmData) 
      ? 'Compliant' 
      : 'Documentation missing or incomplete. Required: ' + (item.evidenceRequired || []).join(', '),
    evidenceRequired: item.evidenceRequired || []
  }));
};

export const getStandardsByCategory = (category) => {
  return UK_COMPLIANCE_CHECKLIST.filter(item => item.category === category);
};

export const getStandardsByAuthority = (authority) => {
  return UK_COMPLIANCE_CHECKLIST.filter(item => item.authority === authority);
};

export const calculateComplianceScore = (farmData) => {
  const results = validateFarmAgainstUKStandards(farmData);
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  return {
    score: Math.round((passed / total) * 100),
    passed,
    total,
    results
  };
};