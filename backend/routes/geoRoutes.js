// routes/geoRoutes.js - NEW FILE (Create this file)

import express from 'express';
import AgriTechGeoService from '../services/AgriTechGeoService.js';

const router = express.Router();

/**
 * GET /api/geo/farm-advisory/:farmerId/:farmId
 * Get farm advisory with geospatial intelligence from SianGeo
 */
router.get('/farm-advisory/:farmerId/:farmId', async (req, res) => {
    try {
        const { farmerId, farmId } = req.params;
        const advisory = await AgriTechGeoService.getFarmAdvisory(farmerId, farmId);
        res.json({
            success: true,
            data: advisory
        });
    } catch (error) {
        console.error('Farm advisory error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/geo/crop-health/:farmId
 * Get crop health from SianGeo
 */
router.get('/crop-health/:farmId', async (req, res) => {
    try {
        const { farmId } = req.params;
        const cropHealth = await AgriTechGeoService.getCropHealth(farmId);
        res.json({
            success: true,
            data: cropHealth
        });
    } catch (error) {
        console.error('Crop health error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/geo/drought-risk
 * Get drought risk assessment
 */
router.post('/drought-risk', async (req, res) => {
    try {
        const { district, farmId } = req.body;
        const risk = await AgriTechGeoService.getDroughtRisk(district, farmId);
        res.json({
            success: true,
            data: risk
        });
    } catch (error) {
        console.error('Drought risk error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/geo/status
 * Check SianGeo availability
 */
router.get('/status', async (req, res) => {
    try {
        const isAvailable = await AgriTechGeoService.checkAvailability();
        res.json({
            success: true,
            data: {
                available: isAvailable,
                url: process.env.SIAN_GEO_URL || 'https://api-gateway-navy.vercel.app'
            }
        });
    } catch (error) {
        console.error('Geo status error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check SianGeo status'
        });
    }
});

export default router;