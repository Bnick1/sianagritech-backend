import express from 'express';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Farm from '../models/Farm.js';
import Farmer from '../models/Farmer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

router.get('/farm-report/:farmId', async (req, res) => {
    try {
        const { farmId } = req.params;
        console.log('?? Looking for farm:', farmId);
        
        const farm = await Farm.findOne({ code: farmId });
        if (!farm) {
            console.log('? Farm not found:', farmId);
            return res.status(404).json({ error: 'Farm not found' });
        }
        
        console.log('? Farm found:', farm.code);
        
        // Get farmer directly using Farmer model
        let farmer = null;
        if (farm.farmerId) {
            farmer = await Farmer.findById(farm.farmerId);
            console.log('? Farmer found:', farmer ? farmer.name : 'No farmer');
        }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = 'farm_report_' + farmId + '_' + timestamp + '.pdf';
        const reportsDir = path.join(__dirname, '../reports');
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }
        const filepath = path.join(reportsDir, filename);
        
        console.log('?? Generating PDF:', filepath);
        
        const doc = new PDFDocument({ 
            size: 'A4', 
            margins: { top: 80, bottom: 50, left: 50, right: 50 } 
        });
        const writeStream = fs.createWriteStream(filepath);
        doc.pipe(writeStream);

        // ============================================================
        // HEADER
        // ============================================================
        
        // Company name
        doc.fontSize(22)
           .font('Helvetica-Bold')
           .fillColor('#1a237e')
           .text('Sian', 50, 60, { continued: true })
           .font('Helvetica')
           .text(' Technologies', { continued: false });
        
        doc.fontSize(8)
           .fillColor('#555')
           .font('Helvetica')
           .text('AI \u00b7 AgriTech \u00b7 FinTech \u00b7 Geospatial Intelligence', 50, 82);
        
        doc.fontSize(7)
           .fillColor('#555')
           .text('nicksonkiremire@siantechnologies.tech | info@siantechnologies.tech', 200, 60, { align: 'right' })
           .text('+256 773 442 268 | +256 741 430 326', 200, 70, { align: 'right' })
           .text('Raja Chambers, Parliamentary Avenue, Kampala, Uganda', 200, 80, { align: 'right' });

        doc.strokeColor('#1a237e').lineWidth(2).moveTo(50, 100).lineTo(545, 100).stroke();
        doc.moveDown(2);

        // ============================================================
        // TITLE
        // ============================================================
        doc.fontSize(18)
           .font('Helvetica-Bold')
           .fillColor('#1a237e')
           .text('FARM REPORT', { align: 'center' });
        
        doc.fontSize(10)
           .fillColor('#666')
           .font('Helvetica')
           .text('Farm Performance & Analytics Report', { align: 'center' });
        
        doc.moveDown();
        doc.fontSize(8)
           .fillColor('#888')
           .text('Generated: ' + new Date().toLocaleString(), { align: 'right' });
        doc.moveDown();

        // ============================================================
        // FARM DETAILS
        // ============================================================
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor('#1a237e')
           .text('Farm Details', { underline: true });
        
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor('#333');
        
        const details = [
            ['Farm Code', farm.code || 'N/A'],
            ['Farm Name', farm.name || 'N/A'],
            ['Farmer', farmer ? farmer.name : 'Unknown'],
            ['Phone', farmer ? farmer.phone : 'N/A'],
            ['Size', (farm.size || 0) + ' acres'],
            ['Soil Type', farm.soilType || 'Not specified'],
            ['Irrigation', farm.irrigationType || 'Not specified'],
            ['District', farm.location?.district || 'N/A'],
            ['Village', farm.location?.village || 'N/A'],
            ['Status', farm.status || 'N/A']
        ];
        
        details.forEach(function(d) {
            doc.text(d[0] + ': ', { continued: true })
               .font('Helvetica-Bold')
               .text(d[1])
               .font('Helvetica');
        });
        doc.moveDown();

        // ============================================================
        // FOOTER
        // ============================================================
        doc.strokeColor('#1a237e')
           .lineWidth(1)
           .moveTo(50, doc.y + 20)
           .lineTo(545, doc.y + 20)
           .stroke();

        doc.moveDown();
        doc.fontSize(7)
           .fillColor('#888')
           .font('Helvetica')
           .text('Generated by SianAgriTech - Smart Farming Platform', { align: 'center' })
           .text('\u00A9 Sian Technologies ' + new Date().getFullYear() + ' - All Rights Reserved', { align: 'center' });
        
        doc.end();
        
        writeStream.on('finish', function() {
            console.log('? PDF generated successfully');
            res.json({
                success: true,
                data: {
                    filename: filename,
                    downloadUrl: '/api/pdf/download/' + filename
                }
            });
        });
        
        writeStream.on('error', function(error) {
            console.error('? Write stream error:', error);
            res.status(500).json({ error: error.message });
        });
        
    } catch (error) {
        console.error('? PDF generation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Download PDF
router.get('/download/:filename', (req, res) => {
    try {
        const { filename } = req.params;
        const filepath = path.join(__dirname, '../reports', filename);
        if (!fs.existsSync(filepath)) {
            return res.status(404).json({ error: 'File not found' });
        }
        res.download(filepath, filename);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
