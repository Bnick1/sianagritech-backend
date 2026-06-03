import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const useWeather = (farmId, options = {}) => {
  const {
    days = 7,
    autoRefresh = true,
    refreshInterval = 900000, // 15 minutes
    enabled = true
  } = options;

  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchWeather = useCallback(async (forceRefresh = false) => {
    if (!farmId || !enabled) return;

    try {
      setLoading(true);
      setError(null);

      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/weather/farm/${farmId}`,
        {
          params: {
            days,
            refresh: forceRefresh
          },
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (response.data.success) {
        setWeatherData(response.data);
        setLastUpdated(new Date());
        
        // Store in local storage for offline access
        localStorage.setItem(`weather_${farmId}`, JSON.stringify({
          data: response.data,
          timestamp: Date.now()
        }));
      } else {
        throw new Error(response.data.error || 'Failed to fetch weather data');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Network error');
      
      // Try to load from cache
      const cached = localStorage.getItem(`weather_${farmId}`);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 3600000) { // 1 hour
          setWeatherData(data);
          setError('Using cached data: ' + err.message);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [farmId, days, enabled]);

  useEffect(() => {
    if (!farmId || !enabled) return;

    fetchWeather();

    let intervalId;
    if (autoRefresh) {
      intervalId = setInterval(() => fetchWeather(), refreshInterval);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [farmId, enabled, autoRefresh, refreshInterval, fetchWeather]);

  // Helper function to get weather icon
  const getWeatherIcon = (weatherCode) => {
    const iconMap = {
      0: '☀️', // Clear sky
      1: '🌤️', // Mainly clear
      2: '⛅', // Partly cloudy
      3: '☁️', // Overcast
      45: '🌫️', // Fog
      48: '🌫️', // Depositing rime fog
      51: '🌦️', // Light drizzle
      53: '🌦️', // Moderate drizzle
      55: '🌧️', // Dense drizzle
      61: '🌦️', // Slight rain
      63: '🌧️', // Moderate rain
      65: '⛈️', // Heavy rain
      71: '🌨️', // Slight snow
      73: '🌨️', // Moderate snow
      75: '🌨️', // Heavy snow
      80: '🌦️', // Slight rain showers
      81: '🌧️', // Moderate rain showers
      82: '⛈️', // Violent rain showers
      95: '⛈️', // Thunderstorm
      96: '⛈️', // Thunderstorm with slight hail
      99: '⛈️', // Thunderstorm with heavy hail
    };
    
    return iconMap[weatherCode] || '❓';
  };

  // Helper function to get weather description
  const getWeatherDescription = (weatherCode) => {
    const descriptions = {
      0: 'Clear sky',
      1: 'Mainly clear',
      2: 'Partly cloudy',
      3: 'Overcast',
      45: 'Foggy',
      48: 'Rime fog',
      51: 'Light drizzle',
      53: 'Moderate drizzle',
      55: 'Dense drizzle',
      61: 'Slight rain',
      63: 'Moderate rain',
      65: 'Heavy rain',
      71: 'Slight snow',
      73: 'Moderate snow',
      75: 'Heavy snow',
      80: 'Slight rain showers',
      81: 'Moderate rain showers',
      82: 'Violent rain showers',
      95: 'Thunderstorm',
      96: 'Thunderstorm with hail',
      99: 'Severe thunderstorm',
    };
    
    return descriptions[weatherCode] || 'Unknown';
  };

  // Helper function to format temperature
  const formatTemperature = (temp, unit = 'C') => {
    if (temp === undefined || temp === null) return '--';
    
    if (unit === 'F') {
      return `${Math.round((temp * 9/5) + 32)}°F`;
    }
    
    return `${Math.round(temp)}°C`;
  };

  // Get irrigation recommendations
  const getIrrigationRecommendations = () => {
    if (!weatherData?.insights?.irrigation_needs) return null;
    
    const irrigation = weatherData.insights.irrigation_needs;
    
    if (!irrigation.required) {
      return {
        action: 'No irrigation needed',
        reason: 'Sufficient rainfall or soil moisture',
        nextCheck: 'Tomorrow'
      };
    }
    
    return {
      action: `Irrigate with ${irrigation.amount?.toFixed(1) || '5'}mm of water`,
      schedule: irrigation.schedule || [],
      nextIrrigation: irrigation.nextIrrigation,
      efficiency: irrigation.efficiency ? `${irrigation.efficiency}% efficient` : null
    };
  };

  // Get planting recommendations
  const getPlantingRecommendations = () => {
    if (!weatherData?.insights?.planting_window) return null;
    
    const planting = weatherData.insights.planting_window;
    
    return {
      optimal: planting.optimal,
      period: planting.period,
      reason: planting.reason,
      recommendedCrops: planting.recommended_crops || []
    };
  };

  // Get pest risk assessment
  const getPestRisk = () => {
    if (!weatherData?.insights?.pest_risk) return null;
    
    const pestRisk = weatherData.insights.pest_risk;
    
    return {
      level: pestRisk.level,
      factors: pestRisk.factors || [],
      recommendations: pestRisk.recommendations || []
    };
  };

  // Get weather alerts
  const getAlerts = () => {
    return weatherData?.weather?.alerts || [];
  };

  // Get confidence score
  const getConfidenceScore = () => {
    return weatherData?.weather?.metadata?.confidence_score || 0;
  };

  // Get sources used
  const getSourcesUsed = () => {
    return weatherData?.sources || [];
  };

  return {
    // State
    data: weatherData,
    loading,
    error,
    lastUpdated,
    
    // Actions
    refresh: () => fetchWeather(true),
    
    // Helpers
    getWeatherIcon,
    getWeatherDescription,
    formatTemperature,
    getIrrigationRecommendations,
    getPlantingRecommendations,
    getPestRisk,
    getAlerts,
    getConfidenceScore,
    getSourcesUsed,
    
    // Derived data
    currentWeather: weatherData?.weather?.current,
    forecast: weatherData?.weather?.forecast || [],
    hourlyForecast: weatherData?.weather?.hourly || [],
    historical: weatherData?.weather?.historical || [],
    climateData: weatherData?.weather?.climate,
    agroforestry: weatherData?.weather?.agroforestry,
    insights: weatherData?.insights,
    farmInfo: weatherData?.farm,
    isCached: weatherData?.cached || false
  };
};

export default useWeather;