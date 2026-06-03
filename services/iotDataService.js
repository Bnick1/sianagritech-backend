// backend/services/iotDataService.js
import mongoose from 'mongoose';
import axios from 'axios';
import offlineSyncService from './offlineSyncService.js';

class IoTDataService {
  constructor() {
    this.dataSources = {
      thingspeak: {
        name: 'ThingSpeak IoT',
        enabled: !!process.env.THINGSPEAK_API_KEY,
        url: `https://api.thingspeak.com/channels/${process.env.THINGSPEAK_CHANNEL_ID}/feeds`,
        checkInterval: 300000 // 5 minutes
      },
      directSensors: {
        name: 'Direct Sensor Nodes',
        enabled: true,
        protocol: 'LoRaWAN'
      },
      weatherApis: {
        name: 'Weather APIs',
        enabled: !!process.env.OPENWEATHER_API_KEY || !!process.env.NASA_POWER_API_KEY,
        sources: []
      }
    };
    
    this.cache = new Map();
    this.startDataCollection();
  }

  // Collect data from multiple sources
  async collectFarmData(farmId) {
    const startTime = Date.now();
    const data = {
      timestamp: new Date().toISOString(),
      farmId,
      sources: {},
      aggregated: {},
      anomalies: []
    };

    try {
      // 1. Get sensor data from ThingSpeak
      if (this.dataSources.thingspeak.enabled) {
        const sensorData = await this.fetchThingSpeakData(farmId);
        data.sources.thingspeak = sensorData;
        
        // Process sensor data for anomalies
        const anomalies = this.detectSensorAnomalies(sensorData);
        data.anomalies.push(...anomalies);
        
        // Add to aggregated data
        if (sensorData) {
          data.aggregated.sensors = this.aggregateSensorData(sensorData);
        }
      }

      // 2. Get weather data
      const weatherData = await this.fetchWeatherData(farmId);
      data.sources.weather = weatherData;
      
      if (weatherData) {
        data.aggregated.weather = {
          temperature: weatherData.temperature,
          humidity: weatherData.humidity,
          rainfall: weatherData.rainfall,
          forecast: weatherData.forecast
        };
      }

      // 3. Get soil data (from sensors or FAO/ICRAF)
      const soilData = await this.fetchSoilData(farmId);
      data.sources.soil = soilData;
      
      if (soilData) {
        data.aggregated.soil = soilData;
      }

      // 4. Generate actionable insights
      data.recommendations = await this.generateRecommendations(data.aggregated);
      
      // 5. Check if immediate action is needed
      data.urgentActions = this.checkUrgentActions(data.anomalies, data.recommendations);

      data.processingTime = Date.now() - startTime;
      data.status = 'complete';

      // Cache the data
      this.cache.set(`farm_${farmId}`, {
        data,
        timestamp: new Date(),
        ttl: 300000 // 5 minutes
      });

      // Log for analysis
      this.logDataCollection(data);

      return data;

    } catch (error) {
      console.error(`❌ Data collection failed for farm ${farmId}:`, error);
      
      // Return partial data with error
      data.status = 'partial';
      data.error = error.message;
      data.processingTime = Date.now() - startTime;
      
      return data;
    }
  }

  async fetchThingSpeakData(farmId) {
    try {
      const response = await axios.get(this.dataSources.thingspeak.url, {
        params: {
          api_key: process.env.THINGSPEAK_READ_API_KEY,
          results: 100, // Last 100 readings
          minutes: 1440 // Last 24 hours
        },
        timeout: 10000
      });

      if (!response.data.feeds || response.data.feeds.length === 0) {
        return null;
      }

      // Transform ThingSpeak data to our format
      return response.data.feeds.map(feed => ({
        timestamp: feed.created_at,
        sensorId: `ts_${feed.entry_id}`,
        data: {
          soil_moisture: parseFloat(feed.field1) || null,
          temperature: parseFloat(feed.field2) || null,
          humidity: parseFloat(feed.field3) || null,
          rainfall: parseFloat(feed.field4) || null,
          ph_level: parseFloat(feed.field5) || null,
          nutrient_level: parseFloat(feed.field6) || null
        },
        location: {
          lat: response.data.channel.latitude,
          lng: response.data.channel.longitude
        }
      }));

    } catch (error) {
      console.warn('ThingSpeak fetch failed:', error.message);
      
      // Try to get cached data
      const cached = this.cache.get(`thingspeak_${farmId}`);
      if (cached && (Date.now() - cached.timestamp < 600000)) { // 10 minutes old
        return cached.data;
      }
      
      throw new Error(`ThingSpeak unavailable: ${error.message}`);
    }
  }

  async fetchWeatherData(farmId) {
    const sources = [];
    
    try {
      // Get farm location
      const Farm = mongoose.models.Farm;
      const farm = await Farm.findById(farmId).select('location').lean();
      
      if (!farm || !farm.location) {
        return null;
      }

      // Try OpenWeatherMap first
      if (process.env.OPENWEATHER_API_KEY) {
        try {
          const response = await axios.get(
            'https://api.openweathermap.org/data/2.5/onecall',
            {
              params: {
                lat: farm.location.lat,
                lon: farm.location.lng,
                appid: process.env.OPENWEATHER_API_KEY,
                exclude: 'minutely,hourly',
                units: 'metric'
              },
              timeout: 5000
            }
          );

          sources.push('openweathermap');
          
          return {
            temperature: response.data.current.temp,
            humidity: response.data.current.humidity,
            pressure: response.data.current.pressure,
            windSpeed: response.data.current.wind_speed,
            rainfall: response.data.daily[0]?.rain || 0,
            condition: response.data.current.weather[0]?.description,
            forecast: response.data.daily.slice(0, 3).map(day => ({
              date: new Date(day.dt * 1000),
              temp: { min: day.temp.min, max: day.temp.max },
              humidity: day.humidity,
              rainfall: day.rain || 0,
              condition: day.weather[0]?.description
            }))
          };
        } catch (owError) {
          console.warn('OpenWeatherMap failed:', owError.message);
        }
      }

      // Fallback to NASA POWER API
      if (process.env.NASA_POWER_API_KEY) {
        try {
          const response = await axios.get(
            'https://power.larc.nasa.gov/api/temporal/daily/point',
            {
              params: {
                parameters: 'T2M,RH2M,PRECTOTCORR',
                community: 'AG',
                longitude: farm.location.lng,
                latitude: farm.location.lat,
                start: new Date().toISOString().split('T')[0].replace(/-/g, ''),
                end: new Date().toISOString().split('T')[0].replace(/-/g, ''),
                format: 'JSON'
              },
              timeout: 10000
            }
          );

          sources.push('nasa_power');
          
          const data = response.data.properties.parameter;
          return {
            temperature: data.T2M?.[Object.keys(data.T2M)[0]] || null,
            humidity: data.RH2M?.[Object.keys(data.RH2M)[0]] || null,
            rainfall: data.PRECTOTCORR?.[Object.keys(data.PRECTOTCORR)[0]] || null,
            source: 'NASA POWER'
          };
        } catch (nasaError) {
          console.warn('NASA POWER failed:', nasaError.message);
        }
      }

      // Final fallback: Local weather station simulation
      if (sources.length === 0) {
        sources.push('simulated');
        return this.simulateWeatherData(farm.location);
      }

    } catch (error) {
      console.warn('Weather data fetch failed:', error.message);
      return null;
    }
  }

  async fetchSoilData(farmId) {
    try {
      // Get farm location
      const Farm = mongoose.models.Farm;
      const farm = await Farm.findById(farmId).select('location soilType').lean();
      
      if (!farm) return null;

      // If farm has soil data, use it
      if (farm.soilType) {
        return {
          type: farm.soilType,
          ph: farm.soilPh || null,
          nutrients: farm.soilNutrients || null,
          moisture: farm.soilMoisture || null,
          source: 'farm_record'
        };
      }

      // Try to get from sensors
      const sensorData = await mongoose.models.SensorReading.find({
        farmId,
        type: 'soil',
        timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }).sort({ timestamp: -1 }).limit(10).lean();

      if (sensorData.length > 0) {
        return {
          type: 'sensor_detected',
          ph: this.average(sensorData.filter(d => d.ph).map(d => d.ph)),
          moisture: this.average(sensorData.filter(d => d.moisture).map(d => d.moisture)),
          nutrients: this.average(sensorData.filter(d => d.nutrients).map(d => d.nutrients)),
          source: 'sensor',
          readingCount: sensorData.length
        };
      }

      // Fallback to regional soil data (FAO/ICRAF)
      return {
        type: 'regional_average',
        ph: 6.5, // Average for East Africa
        moisture: 'medium',
        nutrients: 'medium',
        source: 'regional_data',
        recommendation: 'Soil test recommended'
      };

    } catch (error) {
      console.warn('Soil data fetch failed:', error.message);
      return null;
    }
  }

  detectSensorAnomalies(sensorData) {
    if (!sensorData || sensorData.length < 5) return [];

    const anomalies = [];
    const recentData = sensorData.slice(0, 10); // Last 10 readings
    
    // Check soil moisture anomalies
    const moistureValues = recentData
      .filter(d => d.data.soil_moisture !== null && d.data.soil_moisture !== undefined)
      .map(d => d.data.soil_moisture);
    
    if (moistureValues.length >= 3) {
      const avgMoisture = this.average(moistureValues);
      const latest = moistureValues[0];
      
      if (latest < 20) {
        anomalies.push({
          type: 'low_soil_moisture',
          severity: 'high',
          value: latest,
          threshold: 20,
          message: 'Soil moisture critically low. Irrigation needed.',
          timestamp: recentData[0].timestamp
        });
      } else if (latest > 85) {
        anomalies.push({
          type: 'high_soil_moisture',
          severity: 'medium',
          value: latest,
          threshold: 85,
          message: 'Soil moisture too high. Risk of waterlogging.',
          timestamp: recentData[0].timestamp
        });
      }
    }

    // Check temperature anomalies
    const tempValues = recentData
      .filter(d => d.data.temperature !== null && d.data.temperature !== undefined)
      .map(d => d.data.temperature);
    
    if (tempValues.length >= 3) {
      const avgTemp = this.average(tempValues);
      const latest = tempValues[0];
      
      if (latest > 35) {
        anomalies.push({
          type: 'high_temperature',
          severity: 'medium',
          value: latest,
          threshold: 35,
          message: 'High temperature detected. Consider shade or irrigation.',
          timestamp: recentData[0].timestamp
        });
      } else if (latest < 10) {
        anomalies.push({
          type: 'low_temperature',
          severity: 'high',
          value: latest,
          threshold: 10,
          message: 'Low temperature detected. Risk to crops.',
          timestamp: recentData[0].timestamp
        });
      }
    }

    // Check for sudden changes (spikes/drops)
    if (moistureValues.length >= 5) {
      const changes = this.detectSuddenChanges(moistureValues);
      anomalies.push(...changes);
    }

    return anomalies;
  }

  async generateRecommendations(aggregatedData) {
    const recommendations = [];
    
    if (!aggregatedData) return recommendations;

    // Soil moisture recommendations
    if (aggregatedData.sensors?.soil_moisture !== undefined) {
      const moisture = aggregatedData.sensors.soil_moisture;
      
      if (moisture < 30) {
        recommendations.push({
          type: 'irrigation',
          priority: 'high',
          message: 'Soil moisture is low. Start irrigation immediately.',
          action: {
            type: 'start_irrigation',
            duration: '30 minutes',
            schedule: 'now'
          }
        });
      } else if (moisture < 50) {
        recommendations.push({
          type: 'irrigation',
          priority: 'medium',
          message: 'Soil moisture is moderate. Schedule irrigation for tomorrow morning.',
          action: {
            type: 'schedule_irrigation',
            time: '06:00',
            duration: '20 minutes'
          }
        });
      } else if (moisture > 80) {
        recommendations.push({
          type: 'drainage',
          priority: 'medium',
          message: 'Soil moisture is high. Ensure proper drainage to prevent waterlogging.',
          action: {
            type: 'check_drainage',
            areas: ['field edges', 'low-lying areas']
          }
        });
      }
    }

    // Weather-based recommendations
    if (aggregatedData.weather) {
      const { temperature, rainfall, forecast } = aggregatedData.weather;
      
      if (rainfall > 20) {
        recommendations.push({
          type: 'rain_advisory',
          priority: 'high',
          message: `Heavy rain (${rainfall}mm) detected. Delay irrigation and check drainage.`,
          action: {
            type: 'delay_irrigation',
            duration: '24 hours'
          }
        });
      }
      
      if (temperature > 32) {
        recommendations.push({
          type: 'heat_advisory',
          priority: 'medium',
          message: `High temperature (${temperature}°C). Water crops in early morning or evening.`,
          action: {
            type: 'adjust_irrigation_schedule',
            newTime: '18:00'
          }
        });
      }

      // Check forecast
      if (forecast && forecast.length > 0) {
        const tomorrowRain = forecast[0]?.rainfall || 0;
        if (tomorrowRain > 10) {
          recommendations.push({
            type: 'forecast_advisory',
            priority: 'low',
            message: `Rain expected tomorrow (${tomorrowRain}mm). Plan activities accordingly.`,
            action: {
              type: 'plan_activities',
              avoid: ['spraying', 'harvesting'],
              suitable: ['weeding', 'pruning']
            }
          });
        }
      }
    }

    // Soil condition recommendations
    if (aggregatedData.soil) {
      const { ph, nutrients } = aggregatedData.soil;
      
      if (ph !== null) {
        if (ph < 5.5) {
          recommendations.push({
            type: 'soil_amendment',
            priority: 'medium',
            message: `Soil pH is acidic (${ph.toFixed(1)}). Consider adding lime.`,
            action: {
              type: 'add_amendment',
              product: 'agricultural lime',
              amount: '200-400 kg per acre'
            }
          });
        } else if (ph > 7.5) {
          recommendations.push({
            type: 'soil_amendment',
            priority: 'medium',
            message: `Soil pH is alkaline (${ph.toFixed(1)}). Consider adding sulfur.`,
            action: {
              type: 'add_amendment',
              product: 'elemental sulfur',
              amount: '100-200 kg per acre'
            }
          });
        }
      }

      if (nutrients === 'low') {
        recommendations.push({
          type: 'fertilizer',
          priority: 'high',
          message: 'Soil nutrients are low. Apply balanced fertilizer.',
          action: {
            type: 'apply_fertilizer',
            product: 'NPK 17:17:17',
            amount: '50 kg per acre'
          }
        });
      }
    }

    return recommendations;
  }

  checkUrgentActions(anomalies, recommendations) {
    const urgent = [];
    
    // Check for high severity anomalies
    const highSeverityAnomalies = anomalies.filter(a => a.severity === 'high');
    if (highSeverityAnomalies.length > 0) {
      urgent.push({
        type: 'anomaly_alert',
        anomalies: highSeverityAnomalies,
        message: `High severity anomalies detected: ${highSeverityAnomalies.map(a => a.type).join(', ')}`,
        immediateAction: true
      });
    }

    // Check for high priority recommendations
    const highPriorityRecs = recommendations.filter(r => r.priority === 'high');
    if (highPriorityRecs.length > 0) {
      urgent.push({
        type: 'recommendation_alert',
        recommendations: highPriorityRecs,
        message: `High priority actions needed: ${highPriorityRecs.map(r => r.type).join(', ')}`
      });
    }

    return urgent;
  }

  // Utility methods
  average(values) {
    if (!values || values.length === 0) return null;
    const sum = values.reduce((a, b) => a + b, 0);
    return sum / values.length;
  }

  detectSuddenChanges(values, threshold = 30) {
    if (values.length < 2) return [];
    
    const changes = [];
    for (let i = 1; i < values.length; i++) {
      const change = Math.abs(values[i] - values[i - 1]);
      if (change > threshold) {
        changes.push({
          type: 'sudden_change',
          severity: 'medium',
          change: change,
          from: values[i - 1],
          to: values[i],
          message: `Sudden change detected: ${change.toFixed(1)}% difference`
        });
      }
    }
    return changes;
  }

  aggregateSensorData(sensorData) {
    if (!sensorData || sensorData.length === 0) return null;
    
    const latest = sensorData[0];
    const aggregated = {
      soil_moisture: latest.data.soil_moisture,
      temperature: latest.data.temperature,
      humidity: latest.data.humidity,
      rainfall: latest.data.rainfall,
      ph_level: latest.data.ph_level,
      nutrient_level: latest.data.nutrient_level,
      reading_count: sensorData.length,
      last_reading: latest.timestamp
    };

    // Calculate averages if we have enough data
    if (sensorData.length >= 3) {
      const validData = sensorData.filter(d => 
        Object.values(d.data).some(v => v !== null && v !== undefined)
      );
      
      if (validData.length > 0) {
        aggregated.averages = {};
        ['soil_moisture', 'temperature', 'humidity'].forEach(key => {
          const values = validData
            .map(d => d.data[key])
            .filter(v => v !== null && v !== undefined);
          
          if (values.length > 0) {
            aggregated.averages[key] = this.average(values);
          }
        });
      }
    }

    return aggregated;
  }

  simulateWeatherData(location) {
    // Simple simulation based on location and time
    const now = new Date();
    const hour = now.getHours();
    const month = now.getMonth();
    
    // Basic simulation for East Africa
    return {
      temperature: 22 + Math.sin(hour * Math.PI / 12) * 5 + Math.sin(month * Math.PI / 6) * 3,
      humidity: 60 + Math.sin(hour * Math.PI / 12) * 20,
      pressure: 1013,
      windSpeed: 5 + Math.random() * 5,
      rainfall: Math.random() > 0.8 ? Math.random() * 10 : 0,
      condition: ['Partly Cloudy', 'Sunny', 'Clear'][Math.floor(Math.random() * 3)],
      source: 'simulated',
      note: 'Real weather data unavailable. Using simulation.'
    };
  }

  startDataCollection() {
    // Periodic cleanup of old cache
    setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.cache.entries()) {
        if (now - value.timestamp > value.ttl) {
          this.cache.delete(key);
        }
      }
    }, 60000); // Every minute
  }

  logDataCollection(data) {
    // Log for analytics and monitoring
    console.log('📊 IoT Data Collection:', {
      farmId: data.farmId,
      timestamp: data.timestamp,
      sources: Object.keys(data.sources),
      anomalies: data.anomalies.length,
      recommendations: data.recommendations?.length || 0,
      urgentActions: data.urgentActions?.length || 0,
      processingTime: data.processingTime,
      status: data.status
    });

    // Could also send to analytics service
    // await Analytics.log('iot_data_collection', data);
  }

  // API Methods
  async getFarmDashboard(farmId) {
    const data = await this.collectFarmData(farmId);
    
    return {
      farmId,
      lastUpdated: data.timestamp,
      status: data.status,
      overview: {
        soilHealth: this.calculateSoilHealthScore(data),
        weatherConditions: this.summarizeWeather(data.aggregated?.weather),
        cropHealth: 'good', // Would come from AI/camera analysis
        alerts: data.anomalies.length + (data.urgentActions?.length || 0)
      },
      currentReadings: data.aggregated?.sensors || {},
      weather: data.aggregated?.weather || {},
      soil: data.aggregated?.soil || {},
      alerts: [...data.anomalies, ...(data.urgentActions || [])],
      recommendations: data.recommendations || [],
      actions: data.urgentActions || []
    };
  }

  calculateSoilHealthScore(data) {
    let score = 50; // Base score
    
    if (data.aggregated?.sensors?.soil_moisture) {
      const moisture = data.aggregated.sensors.soil_moisture;
      if (moisture >= 40 && moisture <= 70) score += 25;
      else if (moisture >= 30 && moisture <= 80) score += 10;
      else score -= 15;
    }
    
    if (data.aggregated?.soil?.ph) {
      const ph = data.aggregated.soil.ph;
      if (ph >= 6.0 && ph <= 7.0) score += 25;
      else if (ph >= 5.5 && ph <= 7.5) score += 10;
      else score -= 15;
    }
    
    return Math.min(Math.max(score, 0), 100);
  }

  summarizeWeather(weather) {
    if (!weather) return 'No data';
    
    const conditions = [];
    if (weather.temperature) conditions.push(`${weather.temperature}°C`);
    if (weather.humidity) conditions.push(`${weather.humidity}% humidity`);
    if (weather.rainfall && weather.rainfall > 0) conditions.push(`${weather.rainfall}mm rain`);
    
    return conditions.join(', ');
  }
}

export default new IoTDataService();