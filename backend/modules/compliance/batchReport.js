import PDFDocument from 'pdfkit';
import { validateFarmAgainstUKStandards } from './ukStandards.js';

export const generateBatchReport = async (exporterData, batchData, farms) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers = [];
      
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // Safely access exporter data with fallbacks
      const exporterName = exporterData?.companyName || exporterData?.name || 'Unknown Exporter';
      const exporterReg = exporterData?.registrationNumber || 'N/A';
      const exporterCountry = exporterData?.country || 'Uganda';
      const exporterUkAgent = exporterData?.ukAgentName || exporterData?.ukAgent || 'Not specified';

      // Safely access batch data with fallbacks
      const batchId = batchData?.batchId || 'N/A';
      const cropType = batchData?.cropType || 'N/A';
      const quantity = batchData?.quantity || 0;
      const unit = batchData?.unit || 'kg';
      const destinationCountry = batchData?.destinationCountry || 'United Kingdom';
      const portOfEntry = batchData?.portOfEntry || 'Felixstowe';
      
      // Handle export date safely
      let exportDateStr = 'N/A';
      if (batchData?.exportDate) {
        try {
          exportDateStr = new Date(batchData.exportDate).toLocaleDateString();
        } catch {
          exportDateStr = batchData.exportDate.toString();
        }
      } else if (batchData?.estimatedExportDate) {
        try {
          exportDateStr = new Date(batchData.estimatedExportDate).toLocaleDateString();
        } catch {
          exportDateStr = batchData.estimatedExportDate.toString();
        }
      }

      // Cover Page
      doc.fontSize(24).text('EXPORT BATCH COMPLIANCE REPORT', { align: 'center' });
      doc.moveDown();
      doc.fontSize(16).text(`Batch ID: ${batchId}`, { align: 'center' });
      doc.text(`Date: ${new Date().toLocaleDateString()}`, { align: 'center' });
      doc.moveDown(2);

      // Exporter Information
      doc.fontSize(18).text('1. EXPORTER INFORMATION');
      doc.moveDown(0.5);
      doc.fontSize(12).text(`Company: ${exporterName}`);
      doc.text(`Registration: ${exporterReg}`);
      doc.text(`Country of Origin: ${exporterCountry}`);
      doc.text(`UK Agent: ${exporterUkAgent}`);
      doc.moveDown();

      // Batch Details
      doc.fontSize(18).text('2. BATCH DETAILS');
      doc.moveDown(0.5);
      doc.fontSize(12).text(`Product: ${cropType}`);
      doc.text(`Quantity: ${quantity} ${unit}`);
      doc.text(`Destination: ${destinationCountry}`);
      doc.text(`Port of Entry: ${portOfEntry}`);
      doc.text(`Estimated Export Date: ${exportDateStr}`);
      doc.moveDown();

      // Farmer Compliance Summary
      doc.fontSize(18).text('3. FARMER COMPLIANCE SUMMARY');
      doc.moveDown(0.5);
      
      let totalFarmers = 0;
      let compliantFarmers = 0;
      
      if (farms && farms.length > 0) {
        farms.forEach((farm, index) => {
          try {
            const checklist = validateFarmAgainstUKStandards(farm);
            const isCompliant = checklist.every(c => c.passed);
            
            if (isCompliant) compliantFarmers++;
            totalFarmers++;
            
            const farmName = farm?.farmName || farm?.name || `Farm ${index + 1}`;
            const farmLocation = farm?.location || 'Location not specified';
            const farmVerified = farm?.geoVerified || false;
            
            doc.fontSize(12).text(`${index + 1}. ${farmName}`);
            doc.fontSize(10).text(`   Status: ${isCompliant ? '✅ COMPLIANT' : '⚠️ ACTION REQUIRED'}`);
            doc.fontSize(10).text(`   Location: ${farmLocation}`);
            doc.fontSize(10).text(`   Verification: ${farmVerified ? '✅ Verified' : '❌ Not Verified'}`);
            doc.moveDown(0.3);
          } catch (farmError) {
            console.error('Error processing farm:', farmError);
            doc.fontSize(12).text(`${index + 1}. Farm (error processing data)`);
            doc.fontSize(10).text(`   Status: ⚠️ DATA ERROR`);
            doc.moveDown(0.3);
          }
        });
      } else {
        doc.fontSize(12).text('No farms included in this batch');
      }
      
      doc.moveDown();
      const complianceRate = totalFarmers > 0 ? Math.round((compliantFarmers / totalFarmers) * 100) : 0;
      doc.fontSize(14).text(`Overall Compliance: ${compliantFarmers}/${totalFarmers} farms compliant (${complianceRate}%)`);
      doc.moveDown();

      // Certification
      doc.moveDown(2);
      doc.fontSize(16).text('CERTIFICATION', { align: 'center' });
      doc.moveDown();
      
      if (totalFarmers > 0 && compliantFarmers === totalFarmers) {
        doc.fontSize(14).text('✅ THIS BATCH IS ELIGIBLE FOR UK/EU EXPORT', { align: 'center' });
      } else if (totalFarmers === 0) {
        doc.fontSize(14).text('⚠️ NO FARMS IN BATCH - CANNOT CERTIFY', { align: 'center' });
      } else {
        doc.fontSize(14).text('⚠️ ADDITIONAL DOCUMENTATION REQUIRED', { align: 'center' });
      }
      
      doc.moveDown(2);
      doc.fontSize(10).text('This report was generated by Sian Technologies. It serves as a compliance preparation tool and does not replace official certification from relevant authorities.', { align: 'center', width: 500 });

      doc.end();
    } catch (error) {
      console.error('❌ PDF Generation Error:', error);
      reject(error);
    }
  });
};