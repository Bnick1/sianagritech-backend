// pdfGenerator.js - Fixed with named exports
export const generateComplianceReport = async (complianceData) => {
    return {
        success: true,
        reportUrl: 'https://example.com/reports/compliance.pdf',
        generatedAt: new Date().toISOString()
    };
};

export const generateCertificate = async (farmId) => {
    return {
        success: true,
        certificateUrl: 'https://example.com/certificates/farm.pdf'
    };
};
