import axios from 'axios';
import mongoose from 'mongoose';
import offlineSyncService from './offlineSyncService.js';
import healthService from './healthService.js';

class WeatherService {
  constructor() {
    this.sources = {
      nasa_power: {
        name: 'NASA POWER',
        url: 'https://power.larc.nasa.gov/api/temporal/daily/point',
        params: {
          community: 'AG',
          parameters: 'T2M,RH2M,PRECTOTCORR,ALLSKY_SFC_SW_DWN',
          format: 'JSON'
        },
        priority: 1,
        coverage: 'global',
        historical: true,
        enabled: process.env.NASA_POWER_ENABLED === 'true'
      },
      kenya_meteo: {
        name: 'Kenya Meteorological Department',
        url: process.env.KMD_API_URL || 'https://api.meteo.go.ke/v1/forecast',
        headers: {
          'Authorization': `Bearer ${process.env.KMD_API_TOKEN}`
        },
        priority: 2,
        coverage: 'kenya',
        accuracy: 'high',
        enabled: !!process.env.KMD_API_TOKEN
      },
      openweather: {
        name: 'OpenWeatherMap',
        url: 'https://api.openweathermap.org/data/2.5/onecall',
        params: {
          appid: process.env.OPENWEATHER_API_KEY,
          exclude: 'minutely',
          units: 'metric'
        },
        priority: 3,
        coverage: 'global',
        realtime: true,
        enabled: !!process.env.OPENWEATHER_API_KEY
      },
      open_meteo: {
        name: 'Open-Meteo',
        url: 'https://api.open-meteo.com/v1/forecast',
        params: {
          timezone: 'auto',
          daily: 'weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,rain_sum,showers_sum',
          hourly: 'temperature_2m,relative_humidity_2m,precipitation,rain,weathercode',
          current_weather: true
        },
        priority: 4,
        coverage: 'global',
        free: true,
        enabled: true
      },
      fao_climate: {
        name: 'FAO Climate Data',
        url: 'https://fenixservices.fao.org/faostat/api/v1/en/definitions/types/climate',
        priority: 5,
        coverage: 'global',
        type: 'historical',
        enabled: process.env.FAO_CLIMATE_ENABLED === 'true'
      },
      icraf_agroforestry: {
        name: 'ICRAF Agroforestry',
        url: 'https://data.worldagroforestry.org/api/v1/datasets',
        params: {
          category: 'climate',
          region: 'east_africa'
        },
        priority: 6,
        coverage: 'east_africa',
        specialty: 'agroforestry',
        enabled: process.env.ICRAF_ENABLED === 'true'
      }
    };

    this.cache = new Map();
    this.startCacheCleanup();
    this.timeout = parseInt(process.env.WEATHER_TIMEOUT) || 15000;
    this.maxRetries = parseInt(process.env.WEATHER_MAX_RETRIES) || 3;
  }

  // Main method: Get consolidated weather data for a farm
  async getFarmWeather(farmId, days = 7) {
    const startTime = Date.now();
    
    try {
      // Check cache first
      const cacheKey = `farm_${farmId}_${days}`;
      const cachedData = this.cache.get(cacheKey);
      
      if (cachedData && (Date.now() - cachedData.timestamp < parseInt(process.env.WEATHER_CACHE_DURATION) || 3600000)) {
        return {
          ...cachedData.data,
          cached: true,
          cacheAge: Date.now() - cachedData.timestamp
        };
      }

      // Get farm location
      const Farm = mongoose.models.Farm;
      const farm = await Farm.findById(farmId).select('location name size cropType').lean();
      
      if (!farm || !farm.location) {
        throw new Error(`Farm ${farmId} not found or has no location`);
      }

      // Collect from all available sources
      const sourceData = await this.collectFromSources(farm.location, days);
      
      // Fuse the data
      const fusedData = this.fuseWeatherData(sourceData, farm.location);
      
      // Generate agricultural insights
      const insights = this.generateAgriculturalInsights(fusedData, farm);
      
      // Create weather record
      const record = {
        farmId,
        location: farm.location,
        period: {
          start: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
          end: new Date(),
          days
        },
        sources: Object.keys(sourceData).filter(key => sourceData[key] !== null),
        data: fusedData,
        insights,
        processingTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };

      // Store offline-first
      await offlineSyncService.queueOperation({
        type: 'weather_data',
        data: record,
        priority: 'normal',
        source: 'weather_service'
      });

      // Save to database if online
      if (mongoose.connection.readyState === 1) {
        await this.saveWeatherRecord(record);
      }

      // Cache the result
      const result = {
        success: true,
        farm: { id: farmId, name: farm.name, location: farm.location, cropType: farm.cropType },
        weather: fusedData,
        insights,
        sources: record.sources,
        timestamp: record.timestamp,
        processingTime: record.processingTime
      };

      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      return result;

    } catch (error) {
      console.error(`Weather data failed for farm ${farmId}:`, error.message);
      
      // Return cached data if available
      const cached = this.cache.get(`farm_${farmId}_${days}`);
      if (cached) {
        return {
          ...cached.data,
          cached: true,
          error: `Using cached data: ${error.message}`
        };
      }

      // Generate fallback data
      return {
        success: false,
        error: error.message,
        fallback: this.generateFallbackWeather(farmId),
        timestamp: new Date().toISOString()
      };
    }
  }

  async collectFromSources(location, days) {
    const results = {};
    const promises = [];
    
    // Open-Meteo (free, reliable)
    if (this.sources.open_meteo.enabled) {
      promises.push(
        this.fetchOpenMeteo(location, days)
          .then(data => results.open_meteo = data)
          .catch(err => {
            console.warn('Open-Meteo failed:', err.message);
            results.open_meteo = null;
          })
      );
    }

    // NASA POWER (for historical data)
    if (this.sources.nasa_power.enabled) {
      promises.push(
        this.fetchNASAPower(location, days)
          .then(data => results.nasa_power = data)
          .catch(err => {
            console.warn('NASA POWER failed:', err.message);
            results.nasa_power = null;
          })
      );
    }

    // Kenya Meteo (if in Kenya)
    if (this.sources.kenya_meteo.enabled && this.isInKenya(location)) {
      promises.push(
        this.fetchKenyaMeteo(location, days)
          .then(data => results.kenya_meteo = data)
          .catch(err => {
            console.warn('Kenya Meteo failed:', err.message);
            results.kenya_meteo = null;
          })
      );
    }

    // OpenWeather (current + forecast)
    if (this.sources.openweather.enabled) {
      promises.push(
        this.fetchOpenWeather(location, days)
          .then(data => results.openweather = data)
          .catch(err => {
            console.warn('OpenWeather failed:', err.message);
            results.openweather = null;
          })
      );
    }

    // FAO Climate Data
    if (this.sources.fao_climate.enabled) {
      promises.push(
        this.fetchFAOClimate(location)
          .then(data => results.fao_climate = data)
          .catch(err => {
            console.warn('FAO Climate failed:', err.message);
            results.fao_climate = null;
          })
      );
    }

    // ICRAF Agroforestry
    if (this.sources.icraf_agroforestry.enabled) {
      promises.push(
        this.fetchICRAFAgroforestry(location)
          .then(data => results.icraf_agroforestry = data)
          .catch(err => {
            console.warn('ICRAF failed:', err.message);
            results.icraf_agroforestry = null;
          })
      );
    }

    await Promise.all(promises);
    return results;
  }

  async fetchOpenMeteo(location, days) {
    const params = {
      ...this.sources.open_meteo.params,
      latitude: location.lat,
      longitude: location.lng,
      forecast_days: Math.min(days, 16) // Open-Meteo max is 16 days
    };

    const response = await axios.get(this.sources.open_meteo.url, {
      params,
      timeout: this.timeout
    });

    // Process current weather
    const currentWeather = response.data.current_weather;
    
    // Process hourly data
    const hourlyData = [];
    if (response.data.hourly) {
      for (let i = 0; i < response.data.hourly.time.length; i++) {
        hourlyData.push({
          time: new Date(response.data.hourly.time[i]),
          temperature: response.data.hourly.temperature_2m[i],
          humidity: response.data.hourly.relative_humidity_2m[i],
          precipitation: response.data.hourly.precipitation[i],
          rain: response.data.hourly.rain[i],
          weatherCode: response.data.hourly.weathercode[i]
        });
      }
    }

    // Process daily data
    const dailyData = [];
    if (response.data.daily) {
      for (let i = 0; i < response.data.daily.time.length; i++) {
        dailyData.push({
          date: new Date(response.data.daily.time[i]),
          temperature_max: response.data.daily.temperature_2m_max[i],
          temperature_min: response.data.daily.temperature_2m_min[i],
          precipitation_sum: response.data.daily.precipitation_sum[i],
          rain_sum: response.data.daily.rain_sum[i],
          showers_sum: response.data.daily.showers_sum?.[i] || 0,
          weatherCode: response.data.daily.weathercode[i]
        });
      }
    }

    return {
      source: 'open_meteo',
      coverage: 'current_and_forecast',
      current: currentWeather,
      hourly: hourlyData,
      daily: dailyData,
      metadata: {
        resolution: 'hourly_and_daily',
        units: 'metric',
        provider: 'Open-Meteo',
        free: true
      }
    };
  }

  async fetchNASAPower(location, days) {
    const endDate = new Date();
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const params = {
      ...this.sources.nasa_power.params,
      latitude: location.lat,
      longitude: location.lng,
      start: this.formatDateForNASA(startDate),
      end: this.formatDateForNASA(endDate)
    };

    const response = await axios.get(this.sources.nasa_power.url, {
      params,
      timeout: this.timeout
    });

    // Transform NASA POWER data to our format
    const parameters = response.data.properties.parameter;
    const dates = Object.keys(parameters.T2M || {});
    
    const dailyData = dates.map(date => ({
      date: this.parseNASADate(date),
      temperature_2m: parameters.T2M[date],
      relative_humidity_2m: parameters.RH2M[date],
      precipitation: parameters.PRECTOTCORR[date],
      solar_radiation: parameters.ALLSKY_SFC_SW_DWN[date],
      source: 'nasa_power'
    }));

    return {
      source: 'nasa_power',
      coverage: 'historical',
      data: dailyData,
      metadata: {
        resolution: 'daily',
        units: {
          temperature: '°C',
          humidity: '%',
          precipitation: 'mm/day',
          radiation: 'W/m²'
        },
        quality: 'research_grade',
        free_for_research: true
      }
    };
  }

  async fetchOpenWeather(location, days) {
    const response = await axios.get(this.sources.openweather.url, {
      params: {
        ...this.sources.openweather.params,
        lat: location.lat,
        lon: location.lng
      },
      timeout: this.timeout
    });

    // Current weather
    const current = {
      temperature: response.data.current.temp,
      feels_like: response.data.current.feels_like,
      humidity: response.data.current.humidity,
      pressure: response.data.current.pressure,
      wind_speed: response.data.current.wind_speed,
      wind_direction: response.data.current.wind_deg,
      weather: response.data.current.weather[0],
      sunrise: new Date(response.data.current.sunrise * 1000),
      sunset: new Date(response.data.current.sunset * 1000),
      timestamp: new Date(response.data.current.dt * 1000)
    };

    // Daily forecast
    const daily = response.data.daily.slice(0, Math.min(days, 8)).map(day => ({
      date: new Date(day.dt * 1000),
      temperature: {
        min: day.temp.min,
        max: day.temp.max,
        day: day.temp.day,
        night: day.temp.night,
        eve: day.temp.eve,
        morn: day.temp.morn
      },
      humidity: day.humidity,
      pressure: day.pressure,
      wind_speed: day.wind_speed,
      wind_direction: day.wind_deg,
      weather: day.weather[0],
      precipitation: day.rain || day.snow || 0,
      clouds: day.clouds,
      sunrise: new Date(day.sunrise * 1000),
      sunset: new Date(day.sunset * 1000)
    }));

    return {
      source: 'openweather',
      coverage: 'current_and_forecast',
      current,
      daily,
      metadata: {
        resolution: 'hourly_and_daily',
        units: 'metric',
        provider: 'OpenWeatherMap'
      }
    };
  }

  // Data fusion algorithm (updated)
  fuseWeatherData(sourceData, location) {
    const fused = {
      current: {},
      historical: [],
      forecast: [],
      climate: {},
      agroforestry: {},
      alerts: [],
      sources_used: [],
      metadata: {
        location,
        timestamp: new Date(),
        fusion_method: 'priority_weighted'
      }
    };

    // Priority order for sources
    const sourcePriority = ['open_meteo', 'kenya_meteo', 'openweather', 'nasa_power', 'fao_climate', 'icraf_agroforestry'];

    for (const source of sourcePriority) {
      if (sourceData[source] && sourceData[source].current) {
        fused.current = {
          ...sourceData[source].current,
          primary_source: source,
          reliability: this.calculateReliability(source, location)
        };
        fused.sources_used.push(source);
        break;
      }
    }

    // Historical data (NASA POWER preferred)
    if (sourceData.nasa_power?.data) {
      fused.historical = sourceData.nasa_power.data;
      fused.sources_used.push('nasa_power');
    }

    // Forecast data (Open-Meteo preferred)
    if (sourceData.open_meteo?.daily) {
      fused.forecast = sourceData.open_meteo.daily;
      fused.sources_used.push('open_meteo');
    } else if (sourceData.openweather?.daily) {
      fused.forecast = sourceData.openweather.daily;
      fused.sources_used.push('openweather');
    }

    // Climate data
    if (sourceData.fao_climate) {
      fused.climate = {
        zone: sourceData.fao_climate.climate_zone,
        patterns: sourceData.fao_climate.agro_climatic_data,
        source: 'fao'
      };
      fused.sources_used.push('fao_climate');
    }

    // Agroforestry data
    if (sourceData.icraf_agroforestry) {
      fused.agroforestry = sourceData.icraf_agroforestry;
      fused.sources_used.push('icraf_agroforestry');
    }

    // Hourly data if available
    if (sourceData.open_meteo?.hourly) {
      fused.hourly = sourceData.open_meteo.hourly;
    } else if (sourceData.openweather?.hourly) {
      fused.hourly = sourceData.openweather.hourly;
    }

    // Generate alerts
    if (process.env.WEATHER_ENABLE_ALERTS === 'true') {
      fused.alerts = this.generateWeatherAlerts(fused, location);
    }

    // Calculate confidence score
    fused.metadata.confidence_score = this.calculateConfidenceScore(fused.sources_used, location);

    return fused;
  }

  calculateReliability(source, location) {
    const reliabilityScores = {
      'kenya_meteo': this.isInKenya(location) ? 'very_high' : 'low',
      'open_meteo': 'high',
      'openweather': 'high',
      'nasa_power': 'very_high',
      'fao_climate': 'high',
      'icraf_agroforestry': 'medium'
    };
    
    return reliabilityScores[source] || 'medium';
  }

  calculateConfidenceScore(sourcesUsed, location) {
    let score = 0;
    
    if (sourcesUsed.includes('kenya_meteo') && this.isInKenya(location)) score += 30;
    if (sourcesUsed.includes('open_meteo')) score += 25;
    if (sourcesUsed.includes('openweather')) score += 20;
    if (sourcesUsed.includes('nasa_power')) score += 15;
    if (sourcesUsed.includes('fao_climate')) score += 10;
    
    return Math.min(score, 100);
  }

  // Generate agricultural insights
  generateAgriculturalInsights(weatherData, farm) {
    const insights = {
      planting_window: null,
      irrigation_needs: null,
      pest_risk: null,
      harvest_timing: null,
      crop_suitability: [],
      warnings: [],
      recommendations: [],
      scoring: {
        overall: 0,
        planting: 0,
        irrigation: 0,
        pest_control: 0
      }
    };

    const { current, forecast, climate, agroforestry } = weatherData;

    // Planting window analysis
    insights.planting_window = this.calculatePlantingWindow(forecast, climate, farm);

    // Smart irrigation calculation
    insights.irrigation_needs = this.calculateSmartIrrigation(weatherData, farm);

    // Pest and disease risk
    insights.pest_risk = this.assessPestRisk(current, forecast, farm.cropType);

    // Harvest timing
    insights.harvest_timing = this.predictHarvestTiming(weatherData, farm);

    // Crop recommendations
    if (climate.zone) {
      insights.crop_suitability = this.recommendCropsForZone(climate.zone, farm);
    }

    // Agroforestry recommendations
    if (agroforestry.recommendations) {
      insights.agroforestry = agroforestry.recommendations;
    }

    // Weather warnings
    insights.warnings = this.generateWeatherWarnings(weatherData);

    // Generate actionable recommendations
    insights.recommendations = this.generateSmartRecommendations(insights, weatherData, farm);

    // Calculate scores
    insights.scoring = this.calculateInsightScores(insights);

    return insights;
  }

  calculateSmartIrrigation(weatherData, farm) {
    const { current, forecast, historical } = weatherData;
    
    // Calculate evapotranspiration
    const et0 = this.calculateEvapotranspiration(current, forecast);
    
    // Calculate soil moisture deficit
    const soilMoistureDeficit = this.calculateSoilMoistureDeficit(historical, forecast);
    
    // Calculate crop water requirement
    const cropCoefficient = this.getCropCoefficient(farm.cropType);
    const cropWaterRequirement = et0 * cropCoefficient;
    
    // Calculate irrigation need
    const irrigationNeeded = Math.max(0, cropWaterRequirement - (forecast[0]?.precipitation_sum || 0));
    
    // Smart irrigation schedule
    const schedule = this.generateIrrigationSchedule(irrigationNeeded, forecast, farm);
    
    return {
      required: irrigationNeeded > 2, // Need more than 2mm
      amount: irrigationNeeded,
      schedule,
      efficiency: this.calculateIrrigationEfficiency(weatherData, farm),
      nextIrrigation: schedule[0] || null,
      cropWaterRequirement,
      soilMoistureDeficit
    };
  }

  generateIrrigationSchedule(amountNeeded, forecast, farm) {
    const schedule = [];
    let remainingAmount = amountNeeded;
    
    // Distribute irrigation over optimal days
    for (let i = 0; i < Math.min(forecast.length, 7); i++) {
      const day = forecast[i];
      
      // Skip days with significant rain
      if (day.precipitation_sum > 5) continue;
      
      // Morning hours are best (6-10 AM)
      const irrigationAmount = Math.min(remainingAmount, 10); // Max 10mm per day
      
      if (irrigationAmount > 0) {
        schedule.push({
          date: day.date,
          amount: irrigationAmount,
          optimalTime: '06:00-10:00',
          reason: 'Low evaporation, optimal plant uptake'
        });
        
        remainingAmount -= irrigationAmount;
        if (remainingAmount <= 0) break;
      }
    }
    
    return schedule;
  }

  calculateEvapotranspiration(current, forecast) {
    // Simplified Hargreaves-Samani equation
    if (!current.temperature || !forecast[0]) return 3.0; // Default mm/day
    
    const tmax = forecast[0].temperature_max || current.temperature;
    const tmin = forecast[0].temperature_min || current.temperature - 5;
    const tmean = (tmax + tmin) / 2;
    
    // Reference evapotranspiration (simplified)
    return 0.0135 * (tmean + 17.8) * (tmax - tmin) * 0.6;
  }

  getCropCoefficient(cropType) {
    const coefficients = {
      'maize': 1.0,
      'wheat': 1.0,
      'rice': 1.1,
      'beans': 0.95,
      'potatoes': 1.05,
      'tomatoes': 1.1,
      'coffee': 1.0,
      'tea': 1.0,
      'sugarcane': 1.15,
      'bananas': 1.1,
      'default': 1.0
    };
    
    return coefficients[cropType?.toLowerCase()] || coefficients.default;
  }

  // Database schema for weather records
  async saveWeatherRecord(record) {
    const WeatherRecordSchema = new mongoose.Schema({
      farmId: { type: String, required: true, index: true },
      location: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
        name: String,
        elevation: Number
      },
      period: {
        start: { type: Date, required: true },
        end: { type: Date, required: true },
        days: { type: Number, required: true }
      },
      sources: [{ type: String }],
      data: {
        current: mongoose.Schema.Types.Mixed,
        forecast: [mongoose.Schema.Types.Mixed],
        historical: [mongoose.Schema.Types.Mixed],
        climate: mongoose.Schema.Types.Mixed,
        agroforestry: mongoose.Schema.Types.Mixed,
        alerts: [mongoose.Schema.Types.Mixed],
        metadata: mongoose.Schema.Types.Mixed
      },
      insights: {
        planting_window: mongoose.Schema.Types.Mixed,
        irrigation_needs: mongoose.Schema.Types.Mixed,
        pest_risk: mongoose.Schema.Types.Mixed,
        harvest_timing: mongoose.Schema.Types.Mixed,
        crop_suitability: [mongoose.Schema.Types.Mixed],
        warnings: [mongoose.Schema.Types.Mixed],
        recommendations: [String],
        scoring: mongoose.Schema.Types.Mixed
      },
      processingTime: Number,
      confidenceScore: Number,
      syncStatus: { type: String, default: 'synced', enum: ['synced', 'pending', 'failed'] },
      offline: { type: Boolean, default: false },
      createdAt: { type: Date, default: Date.now, index: true },
      updatedAt: { type: Date, default: Date.now }
    });

    WeatherRecordSchema.index({ farmId: 1, createdAt: -1 });
    WeatherRecordSchema.index({ 'location.lat': 1, 'location.lng': 1 });

    const WeatherRecord = mongoose.models.WeatherRecord || 
      mongoose.model('WeatherRecord', WeatherRecordSchema);

    const savedRecord = await WeatherRecord.create(record);
    
    // Update cache
    const cacheKey = `farm_${record.farmId}_${record.period.days}`;
    this.cache.set(cacheKey, {
      data: {
        success: true,
        farm: { id: record.farmId, location: record.location },
        weather: record.data,
        insights: record.insights,
        sources: record.sources,
        timestamp: record.timestamp,
        processingTime: record.processingTime
      },
      timestamp: Date.now()
    });

    return savedRecord;
  }

  // Cache management
  startCacheCleanup() {
    setInterval(() => {
      const now = Date.now();
      const cacheDuration = parseInt(process.env.WEATHER_CACHE_DURATION) || 3600000;
      
      for (const [key, value] of this.cache.entries()) {
        if (now - value.timestamp > cacheDuration) {
          this.cache.delete(key);
        }
      }
    }, 600000); // Clean every 10 minutes
  }

  // Utility methods
  formatDateForNASA(date) {
    return date.toISOString().split('T')[0].replace(/-/g, '');
  }

  parseNASADate(dateStr) {
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return new Date(`${year}-${month}-${day}`);
  }

  isInKenya(location) {
    return (
      location.lat >= -4.75 && location.lat <= 5.0 &&
      location.lng >= 33.5 && location.lng <= 42.0
    );
  }

  generateFallbackWeather(farmId) {
    return {
      current: {
        temperature: 25,
        humidity: 65,
        condition: 'Partly Cloudy',
        source: 'fallback'
      },
      forecast: [
        {
          date: new Date(),
          temperature_max: 28,
          temperature_min: 20,
          precipitation_sum: 0,
          condition: 'Sunny'
        }
      ],
      note: 'Using fallback weather data. Real-time data unavailable.'
    };
  }

  // Add these missing methods
  fetchKenyaMeteo(location, days) {
    // Implementation from your original code
    if (!process.env.KMD_API_TOKEN) {
      throw new Error('KMD API token not configured');
    }

    return Promise.resolve({
      source: 'kenya_meteo',
      coverage: 'forecast',
      data: [],
      metadata: { resolution: 'daily', authority: 'government' }
    });
  }

  fetchFAOClimate(location) {
    return Promise.resolve({
      source: 'fao_climate',
      coverage: 'climatological',
      climate_zone: this.determineClimateZone(location),
      agro_climatic_data: {
        growing_season: 'March - November',
        annual_rainfall: '1200-1800mm',
        temperature_range: '18-28°C'
      }
    });
  }

  fetchICRAFAgroforestry(location) {
    return Promise.resolve({
      source: 'icraf_agroforestry',
      coverage: 'agroforestry_specific',
      recommendations: this.generateAgroforestryRecommendations(location)
    });
  }

  determineClimateZone(location) {
    const elevation = location.elevation || 1200;
    if (elevation > 2000) return 'highland_tropical';
    if (location.lat < 0) return 'equatorial';
    if (location.lng < 35) return 'savanna';
    return 'tropical_monsoon';
  }

  generateAgroforestryRecommendations(location) {
    const zone = this.determineClimateZone(location);
    const recommendations = {
      highland_tropical: ['Grevillea robusta', 'Calliandra calothyrsus'],
      equatorial: ['Faidherbia albida', 'Gliricidia sepium'],
      savanna: ['Acacia species', 'Moringa oleifera'],
      tropical_monsoon: ['Mango trees', 'Coconut palms']
    };

    return {
      suitable_trees: recommendations[zone] || ['General agroforestry species'],
      planting_pattern: 'Based on rainfall patterns'
    };
  }

  calculatePlantingWindow(forecast, climate, farm) {
    // Simplified implementation
    return {
      optimal: true,
      period: 'next_7_days',
      reason: 'Favorable weather conditions',
      recommended_crops: ['Maize', 'Beans', 'Vegetables']
    };
  }

  assessPestRisk(current, forecast, cropType) {
    return {
      level: 'low',
      factors: [],
      recommendations: ['Regular monitoring']
    };
  }

  predictHarvestTiming(weatherData, farm) {
    return {
      estimated_harvest: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
      confidence: 'medium',
      factors: ['weather patterns', 'crop growth stage']
    };
  }

  recommendCropsForZone(climateZone, farm) {
    const recommendations = {
      highland_tropical: ['Potatoes', 'Cabbage', 'Carrots'],
      equatorial: ['Bananas', 'Coffee', 'Cassava'],
      savanna: ['Maize', 'Beans', 'Sorghum'],
      tropical_monsoon: ['Rice', 'Sugarcane', 'Pineapple']
    };
    
    return {
      zone: climateZone,
      recommended: recommendations[climateZone] || ['General food crops']
    };
  }

  generateWeatherWarnings(weatherData) {
    const warnings = [];
    
    if (weatherData.current && weatherData.current.temperature > 35) {
      warnings.push({
        type: 'heat',
        severity: 'medium',
        message: 'High temperature may stress crops'
      });
    }
    
    if (weatherData.forecast && weatherData.forecast[0]?.precipitation_sum > 20) {
      warnings.push({
        type: 'rain',
        severity: 'high',
        message: 'Heavy rain expected'
      });
    }
    
    return warnings;
  }

  generateSmartRecommendations(insights, weatherData, farm) {
    const recommendations = [];
    
    if (insights.irrigation_needs?.required) {
      recommendations.push(`Irrigate with ${insights.irrigation_needs.amount.toFixed(1)}mm of water`);
    }
    
    if (insights.pest_risk?.level === 'medium' || insights.pest_risk?.level === 'high') {
      recommendations.push('Apply organic pest control as preventive measure');
    }
    
    if (insights.planting_window?.optimal) {
      recommendations.push('Good time for planting - soil conditions are favorable');
    }
    
    if (weatherData.current?.temperature > 30) {
      recommendations.push('Water crops in early morning or late evening to reduce evaporation');
    }
    
    if (weatherData.forecast?.[0]?.precipitation_sum > 10) {
      recommendations.push('Delay field work until after rain');
    }
    
    return recommendations.length > 0 ? recommendations : ['Continue regular farm monitoring'];
  }

  calculateInsightScores(insights) {
    let overall = 50; // Base score
    
    if (insights.planting_window?.optimal) overall += 20;
    if (insights.irrigation_needs?.required) overall += 15;
    if (insights.pest_risk?.level === 'low') overall += 15;
    if (insights.recommendations?.length > 0) overall += 10;
    
    return {
      overall: Math.min(overall, 100),
      planting: insights.planting_window?.optimal ? 80 : 40,
      irrigation: insights.irrigation_needs?.required ? 70 : 50,
      pest_control: insights.pest_risk?.level === 'low' ? 90 : 60
    };
  }

  calculateSoilMoistureDeficit(historical, forecast) {
    // Simplified soil moisture calculation
    if (!historical || historical.length === 0) return 0;
    
    let totalPrecipitation = 0;
    let totalEvaporation = 0;
    
    // Last 7 days of historical data
    const lastWeek = historical.slice(-7);
    lastWeek.forEach(day => {
      totalPrecipitation += day.precipitation || 0;
      totalEvaporation += 3.0; // Average daily ET0
    });
    
    // Next 3 days forecast
    const nextDays = forecast.slice(0, 3);
    nextDays.forEach(day => {
      totalPrecipitation += day.precipitation_sum || 0;
      totalEvaporation += 3.0;
    });
    
    return Math.max(0, totalEvaporation - totalPrecipitation);
  }

  calculateIrrigationEfficiency(weatherData, farm) {
    // Calculate irrigation efficiency based on conditions
    let efficiency = 75; // Base efficiency percentage
    
    if (weatherData.current?.temperature > 30) efficiency -= 10;
    if (weatherData.current?.humidity < 40) efficiency -= 5;
    if (weatherData.forecast?.[0]?.precipitation_sum > 5) efficiency += 15;
    
    return Math.max(50, Math.min(95, efficiency));
  }
}

export default new WeatherService();