import express from 'express';
import IrrigationService from '../services/IrrigationService.js';

const router = express.Router();

// Calculate irrigation schedule
router.post('/schedule', async (req, res) => {
  try {
    const { farmId, preferences } = req.body;
    
    if (!farmId) {
      return res.status(400).json({ error: 'farmId is required' });
    }
    
    const result = await IrrigationService.calculateSchedule(farmId, preferences);
    res.json(result);
  } catch (error) {
    console.error('Error calculating schedule:', error);
    res.status(500).json({ error: error.message });
  }
});

// Execute irrigation
router.post('/execute', async (req, res) => {
  try {
    const { farmId, zoneId, duration, waterAmount } = req.body;
    
    if (!farmId || !zoneId) {
      return res.status(400).json({ error: 'farmId and zoneId are required' });
    }
    
    const result = await IrrigationService.executeIrrigation(farmId, zoneId, duration, waterAmount);
    res.json(result);
  } catch (error) {
    console.error('Error executing irrigation:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get irrigation history
router.get('/history/:farmId', async (req, res) => {
  try {
    const { farmId } = req.params;
    const { days } = req.query;
    
    const result = await IrrigationService.getIrrigationHistory(farmId, parseInt(days) || 7);
    res.json(result);
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get active schedules
router.get('/schedules/:farmId', async (req, res) => {
  try {
    const { farmId } = req.params;
    
    const IrrigationSchedule = mongoose.models.IrrigationSchedule;
    const schedules = await IrrigationSchedule.find({ 
      farmId, 
      active: true 
    })
    .sort({ calculatedAt: -1 })
    .limit(5)
    .lean();
    
    res.json({ success: true, schedules });
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;