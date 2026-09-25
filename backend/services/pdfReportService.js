const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class PDFReportService {
    constructor() {
        this.reportsDir = path.join(__dirname, '../reports');
        if (!fs.existsSync(this.reportsDir)) {
            fs.mkdirSync(this.reportsDir, { recursive: true });
        }
    }

    generateSoilReport(analysisData) {
        return new Promise((resolve, reject) => {
            try {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const filename = 'soil_report_' + timestamp + '.pdf';
                const filepath = path.join(this.reportsDir, filename);
                
                const doc = new PDFDocument({
                    size: 'A4',
                    margins: { top: 50, bottom: 50, left: 50, right: 50 }
                });
                
                const writeStream = fs.createWriteStream(filepath);
                doc.pipe(writeStream);

                // === HEADER ===
                doc.fontSize(22)
                   .font('Helvetica-Bold')
                   .text('SIAN AGRITECH', { align: 'center' });
                
                doc.fontSize(14)
                   .font('Helvetica')
                   .text('Soil Analysis Report', { align: 'center' });
                
                doc.moveDown();
                doc.fontSize(10)
                   .text('Generated: ' + new Date().toISOString(), { align: 'right' });
                
                doc.moveDown();

                // === SOIL STATE ===
                const soilState = analysisData.soilState || {};
                doc.fontSize(14)
                   .font('Helvetica-Bold')
                   .text('Soil State Summary');
                
                doc.fontSize(10)
                   .font('Helvetica')
                   .text('Location: ' + (soilState.location || 'Unknown'))
                   .text('Soil Type: ' + (soilState.soilType || 'Not specified'))
                   .text('Health Score: ' + (soilState.healthScore || 0) + '%')
                   .text('Analysis Status: ' + (soilState.analysisStatus || 'Pending'));
                
                doc.moveDown();

                // === TEST RESULTS ===
                const results = analysisData.testResults || {};
                doc.fontSize(14)
                   .font('Helvetica-Bold')
                   .text('Test Results');
                
                const testData = [
                    ['Parameter', 'Value', 'Status'],
                    ['pH Level', results.ph || 'N/A', (results.ph >= 6.0 && results.ph <= 7.5) ? 'Optimal' : 'Needs Attention'],
                    ['Nitrogen (N)', (results.nitrogen || 'N/A') + ' ppm', results.nitrogen >= 40 ? 'Adequate' : 'Low'],
                    ['Phosphorus (P)', (results.phosphorus || 'N/A') + ' ppm', results.phosphorus >= 20 ? 'Adequate' : 'Low'],
                    ['Potassium (K)', (results.potassium || 'N/A') + ' ppm', results.potassium >= 150 ? 'Adequate' : 'Low'],
                    ['Organic Matter', (results.organicMatter || 'N/A') + '%', results.organicMatter >= 3 ? 'Good' : 'Low'],
                    ['Soil Moisture', (results.soilMoisture || 'N/A') + '%', (results.soilMoisture >= 30 && results.soilMoisture <= 60) ? 'Optimal' : 'Monitor'],
                ];

                let y = doc.y;
                const colX = [70, 200, 350];
                
                doc.font('Helvetica-Bold');
                testData.forEach(function(row, i) {
                    const yPos = y + (i * 25);
                    if (i === 0) {
                        doc.fillColor('#333');
                    } else {
                        doc.fillColor(i % 2 === 0 ? '#444' : '#666');
                    }
                    doc.text(row[0], colX[0], yPos, { width: 130 })
                       .text(row[1], colX[1], yPos, { width: 150 })
                       .text(row[2], colX[2], yPos, { width: 150 });
                });
                
                doc.fillColor('#000');
                doc.moveDown(2);

                // === REAL-TIME DATA ===
                const realTime = analysisData.realTimeData || {};
                doc.fontSize(14)
                   .font('Helvetica-Bold')
                   .text('Real-Time Sensor Data');
                
                doc.fontSize(10)
                   .font('Helvetica')
                   .text('Soil Moisture: ' + (realTime.soilMoisture || 'N/A') + '%')
                   .text('Soil Temperature: ' + (realTime.soilTemperature || 'N/A') + '?C')
                   .text('Ambient Temperature: ' + (realTime.ambientTemperature || 'N/A') + '?C')
                   .text('Humidity: ' + (realTime.humidity || 'N/A') + '%');

                doc.moveDown();

                // === RECOMMENDATIONS ===
                const recommendations = analysisData.recommendations || [];
                if (recommendations.length > 0) {
                    doc.fontSize(14)
                       .font('Helvetica-Bold')
                       .text('Recommendations');
                    
                    doc.fontSize(10)
                       .font('Helvetica');
                    
                    recommendations.forEach(function(rec, index) {
                        doc.text((index + 1) + '. ' + (rec.product || 'N/A'))
                           .text('   ' + (rec.reason || 'No reason provided'), { indent: 20 })
                           .text('   Priority: ' + (rec.priority || 'Normal') + ' | Timing: ' + (rec.timing || 'N/A'), { indent: 20 });
                        doc.moveDown(0.5);
                    });
                }

                // === FOOTER ===
                doc.moveDown();
                doc.fontSize(8)
                   .font('Helvetica')
                   .text('Generated by SianAgriTech - Smart Farming Platform', { align: 'center' })
                   .text('\u00A9 Sian Technologies', { align: 'center' });
                
                doc.end();
                
                writeStream.on('finish', function() {
                    resolve({
                        success: true,
                        filepath: filepath,
                        filename: filename,
                        message: 'PDF report generated successfully'
                    });
                });
                
                writeStream.on('error', reject);
                
            } catch (error) {
                reject(error);
            }
        });
    }
}

module.exports = new PDFReportService();
