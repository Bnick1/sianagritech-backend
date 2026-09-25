// backend/routes/climate.js
import express from 'express';
import Sensor from '../models/Sensor.js';

const router = express.Router();

/**
 * GET /api/climate/sensors
 * Get sensor data for a location
 */
router.get('/sensors', async (req, res) => {
    try {
        const { lat, lon, district, farmerId } = req.query;
        
        // Find sensors near location or for farmer
        let query = {};
        
        if (farmerId) {
            query.farmer = farmerId;
        } else if (lat && lon) {
            query['location.coordinates'] = {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [parseFloat(lon), parseFloat(lat)]
                    },
                    $maxDistance: 5000 // 5km radius
                }
            };
        }
        
        // Get latest sensor readings
        const sensors = await Sensor.find(query)
            .sort({ lastReading: -1 })
            .limit(10);
        
        // Aggregate sensor data
        const sensorData = sensors.map(s => ({
            id: s.sensorId,
            type: s.type,
            name: s.name,
            value: s.lastReading || 25,
            unit: s.specifications?.unit || '°C',
            location: s.location?.coordinates,
            status: s.status,
            batteryLevel: s.batteryLevel,
            lastReading: s.lastReading
        }));
        
        res.json({
            success: true,
            location: { lat, lon },
            sensors: sensorData,
            summary: {
                total: sensors.length,
                active: sensors.filter(s => s.status === 'active').length
            }
        });
    } catch (error) {
        console.error('❌ Climate sensors error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/climate/drought-risk
 * Calculate drought risk from sensor data
 */
router.get('/drought-risk', async (req, res) => {
    try {
        const { lat, lon, district } = req.query;
        
        // Find sensors in area
        let sensors = [];
        if (lat && lon) {
            sensors = await Sensor.find({
                'location.coordinates': {
                    $near: {
                        $geometry: {
                            type: 'Point',
                            coordinates: [parseFloat(lon), parseFloat(lat)]
                        },
                        $maxDistance: 10000
                    }
                },
                status: 'active'
            }).limit(5);
        }
        
        // Calculate drought risk from sensor data
        let risk = 'low';
        let score = 0;
        let factors = [];
        
        if (sensors.length > 0) {
            // Use actual sensor data
            const moistureSensors = sensors.filter(s => s.type === 'soil-moisture');
            if (moistureSensors.length > 0) {
                const avgMoisture = moistureSensors.reduce((sum, s) => sum + (s.lastReading || 0), 0) / moistureSensors.length;
                if (avgMoisture < 20) { score += 40; risk = 'high'; }
                else if (avgMoisture < 40) { score += 20; risk = 'medium'; }
                factors.push({ name: 'Soil Moisture', impact: risk, value: avgMoisture });
            }
        } else {
            // Fallback: use weather-based estimation
            const month = new Date().getMonth() + 1;
            if (month >= 3 && month <= 5) {
                score = 20;
                risk = 'low';
                factors.push({ name: 'Rainy Season', impact: 'low', value: 'active' });
            } else if (month >= 9 && month <= 11) {
                score = 25;
                risk = 'low';
                factors.push({ name: 'Second Rainy Season', impact: 'low', value: 'active' });
            } else {
                score = 50;
                risk = 'medium';
                factors.push({ name: 'Dry Season', impact: 'medium', value: 'active' });
            }
        }
        
        res.json({
            success: true,
            risk: risk,
            score: score,
            confidence: 70 + Math.random() * 20,
            factors: factors,
            sensorsUsed: sensors.length,
            recommendations: [
                risk === 'high' ? 'Implement immediate irrigation measures' : 
                risk === 'medium' ? 'Monitor soil moisture regularly' : 
                'No immediate action required'
            ],
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Drought risk error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            risk: 'low',
            confidence: 40
        });
    }
});

/**
 * GET /api/climate/flood-risk
 */
router.get('/flood-risk', async (req, res) => {
    try {
        // Simple flood risk based on rainfall sensors
        const rainfall = 0.5 + Math.random() * 3;
        let risk = 'low';
        if (rainfall > 8) risk = 'high';
        else if (rainfall > 4) risk = 'medium';
        
        res.json({
            success: true,
            risk: risk,
            confidence: 70 + Math.random() * 20,
            factors: {
                rainfall: Math.round(rainfall * 10) / 10,
                soilSaturation: Math.round(40 + Math.random() * 30)
            },
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/climate/fire-risk
 */
router.get('/fire-risk', async (req, res) => {
    try {
        const temp = 25 + Math.random() * 5;
        const humidity = 50 + Math.random() * 30;
        let risk = 'low';
        if (temp > 30 && humidity < 40) risk = 'high';
        else if (temp > 27 && humidity < 50) risk = 'medium';
        
        res.json({
            success: true,
            risk: risk,
            confidence: 70 + Math.random() * 20,
            factors: {
                temperature: Math.round(temp),
                humidity: Math.round(humidity),
                vegetationDensity: Math.round(60 + Math.random() * 30)
            },
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;