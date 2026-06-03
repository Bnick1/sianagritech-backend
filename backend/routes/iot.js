import express from 'express';
import axios from 'axios';
const router = express.Router();

// Submit sensor data to ThingSpeak
router.post('/sensor-data', async (req, res) => {
  try {
    const { sensorId, temperature, moisture, ph, rainfall, location } = req.body;
    
    // Send to ThingSpeak
    const thingspeakUrl = `https://api.thingspeak.com/update`;
    const params = new URLSearchParams({
      api_key: process.env.THINGSPEAK_WRITE_KEY,
      field1: temperature || 0,
      field2: moisture || 0,
      field3: ph || 7,
      field4: rainfall || 0
    });

    const response = await axios.post(thingspeakUrl, params);
    
    res.json({
      success: true,
      message: 'Sensor data submitted',
      data: {
        entryId: response.data,
        timestamp: new Date(),
        sensorId,
        location
      }
    });
  } catch (error) {
    console.error('IoT data submission error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get sensor data from ThingSpeak
router.get('/data/:channelId', async (req, res) => {
  try {
    const { channelId } = req.params;
    const { results = 10 } = req.query;
    
    const response = await axios.get(
      `https://api.thingspeak.com/channels/${channelId}/feeds.json`,
      {
        params: {
          api_key: process.env.THINGSPEAK_API_KEY,
          results
        }
      }
    );
    
    res.json({
      success: true,
      data: response.data.feeds
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Weather alerts
router.get('/alerts', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    
    // Simple mock alerts - in production, connect to weather API
    const alerts = [
      {
        type: 'rain',
        severity: 'moderate',
        message: 'Rain expected in 3 hours',
        startTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 6 * 60 * 60 * 1000)
      },
      {
        type: 'temperature',
        severity: 'low',
        message: 'Low temperatures expected overnight',
        startTime: new Date(),
        endTime: new Date(Date.now() + 12 * 60 * 60 * 1000)
      }
    ];
    
    res.json({
      success: true,
      data: alerts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;