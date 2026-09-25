import express from 'express';
import MineralBatch from '../models/MineralBatch.js';
import { getGeoData } from '../services/geoIntegration.js';
import { getCreditScore } from '../services/fintechIntegration.js';

const router = express.Router();

router.get('/', (req, res) => {
    res.json({ message: 'Mineral routes' });
});

router.get('/batches', async (req, res) => {
    try {
        const batches = await MineralBatch.find();
        res.json({ success: true, data: batches });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/geo/:location', async (req, res) => {
    const geoData = await getGeoData(req.params.location);
    res.json({ success: true, data: geoData });
});

router.get('/credit/:userId', async (req, res) => {
    const creditData = await getCreditScore(req.params.userId);
    res.json({ success: true, data: creditData });
});

export default router;
