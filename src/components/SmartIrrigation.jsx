import React, { useState, useEffect } from 'react';
import './SmartIrrigation.css';

const SmartIrrigation = () => {
  // Irrigation zones/sections
  const irrigationZones = [
    { id: 'main_field', name: 'Main Field', area: 2.5, crop: 'Maize', efficiency: 0.75, icon: '🌽' },
    { id: 'vegetable_garden', name: 'Vegetable Garden', area: 0.5, crop: 'Tomatoes', efficiency: 0.85, icon: '🍅' },
    { id: 'orchard', name: 'Orchard', area: 1.0, crop: 'Fruit Trees', efficiency: 0.65, icon: '🌳' },
    { id: 'nursery', name: 'Nursery', area: 0.25, crop: 'Seedlings', efficiency: 0.90, icon: '🌱' },
    { id: 'pasture', name: 'Pasture', area: 5.0, crop: 'Grass', efficiency: 0.60, icon: '🌾' }
  ];

  // Irrigation methods
  const irrigationMethods = [
    { id: 'drip', name: 'Drip Irrigation', efficiency: 0.90, costPerHa: 1500, waterSavings: 0.40 },
    { id: 'sprinkler', name: 'Sprinkler System', efficiency: 0.75, costPerHa: 800, waterSavings: 0.25 },
    { id: 'flood', name: 'Flood Irrigation', efficiency: 0.50, costPerHa: 200, waterSavings: 0 },
    { id: 'manual', name: 'Manual Watering', efficiency: 0.40, costPerHa: 100, waterSavings: -0.10 },
    { id: 'pivot', name: 'Center Pivot', efficiency: 0.85, costPerHa: 3000, waterSavings: 0.35 }
  ];

  // Water sources
  const waterSources = [
    { id: 'borehole', name: 'Borehole', costPerM3: 0.15, reliability: 0.95, icon: '⛏️' },
    { id: 'river', name: 'River', costPerM3: 0.05, reliability: 0.70, icon: '🌊' },
    { id: 'dam', name: 'Dam/Reservoir', costPerM3: 0.08, reliability: 0.85, icon: '🏞️' },
    { id: 'rainwater', name: 'Rainwater Harvesting', costPerM3: 0.02, reliability: 0.50, icon: '🌧️' },
    { id: 'municipal', name: 'Municipal Supply', costPerM3: 0.25, reliability: 0.99, icon: '🏙️' }
  ];

  // Initial state
  const [irrigationData, setIrrigationData] = useState({
    selectedZones: ['main_field', 'vegetable_garden'],
    irrigationMethod: 'drip',
    waterSource: 'borehole',
    soilMoistureThreshold: 50, // %
    weatherIntegration: true,
    rainDelay: true,
    scheduleType: 'smart', // 'smart', 'fixed', 'manual'
    fixedSchedule: {
      frequency: 'daily',
      startTime: '06:00',
      duration: 30 // minutes
    },
    maxDailyWater: 10000, // liters
    energyCost: 0.15, // $ per kWh
    waterPrice: 0.15, // $ per m3
    priority: 'water_saving' // 'water_saving', 'yield_max', 'cost_min'
  });

  const [weatherForecast, setWeatherForecast] = useState(null);
  const [soilMoistureData, setSoilMoistureData] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [optimizationResults, setOptimizationResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [simulationRunning, setSimulationRunning] = useState(false);

  // Mock weather data - in real app, integrate with weather API
  const fetchWeatherForecast = () => {
    const days = ['Today', 'Tomorrow', 'Day 3', 'Day 4', 'Day 5'];
    const forecast = days.map(day => ({
      day,
      temp: 25 + Math.random() * 10,
      humidity: 40 + Math.random() * 40,
      rainChance: Math.floor(Math.random() * 100),
      rainAmount: Math.floor(Math.random() * 20),
      wind: 5 + Math.random() * 15,
      condition: ['Sunny', 'Partly Cloudy', 'Cloudy', 'Light Rain', 'Thunderstorms'][Math.floor(Math.random() * 5)]
    }));
    setWeatherForecast(forecast);
  };

  // Mock soil moisture data - in real app, use your sensor data
  const fetchSoilMoisture = () => {
    const zones = irrigationZones.map(zone => ({
      ...zone,
      currentMoisture: 40 + Math.random() * 40,
      optimalMoisture: zone.crop === 'Tomatoes' ? 65 : 
                       zone.crop === 'Maize' ? 60 : 
                       zone.crop === 'Fruit Trees' ? 55 : 50,
      lastIrrigation: new Date(Date.now() - Math.random() * 172800000).toISOString(), // 0-2 days ago
      waterRequired: Math.floor(zone.area * (20 + Math.random() * 30))
    }));
    setSoilMoistureData(zones);
  };

  // Calculate irrigation schedule
  const calculateSchedule = () => {
    setLoading(true);
    
    setTimeout(() => {
      const selectedZones = irrigationZones.filter(zone => 
        irrigationData.selectedZones.includes(zone.id)
      );
      
      const method = irrigationMethods.find(m => m.id === irrigationData.irrigationMethod);
      const source = waterSources.find(s => s.id === irrigationData.waterSource);
      
      // Calculate water requirements based on selected zones
      let totalWaterNeeded = 0;
      let totalArea = 0;
      
      const zoneCalculations = selectedZones.map(zone => {
        const cropFactor = zone.crop === 'Tomatoes' ? 1.2 : 
                          zone.crop === 'Maize' ? 1.0 : 
                          zone.crop === 'Fruit Trees' ? 0.8 : 0.6;
        
        // Base water requirement (mm/day) * area * crop factor
        const baseRequirement = 5 * cropFactor; // mm/day
        const waterPerDay = baseRequirement * 10 * zone.area; // Convert mm to m3/ha
        const adjustedForEfficiency = waterPerDay / method.efficiency;
        
        totalWaterNeeded += adjustedForEfficiency;
        totalArea += zone.area;
        
        return {
          ...zone,
          waterPerDay: Math.round(waterPerDay),
          adjustedWater: Math.round(adjustedForEfficiency),
          nextIrrigation: calculateNextIrrigation(zone, method)
        };
      });
      
      // Adjust for weather forecast
      let weatherAdjustment = 1.0;
      if (irrigationData.weatherIntegration && weatherForecast) {
        const todayRain = weatherForecast[0]?.rainChance || 0;
        if (todayRain > 70) weatherAdjustment = 0.3;
        else if (todayRain > 50) weatherAdjustment = 0.5;
        else if (todayRain > 30) weatherAdjustment = 0.7;
      }
      
      // Apply priority settings
      let priorityMultiplier = 1.0;
      let durationMultiplier = 1.0;
      
      switch(irrigationData.priority) {
        case 'water_saving':
          priorityMultiplier = 0.8;
          durationMultiplier = 0.9;
          break;
        case 'yield_max':
          priorityMultiplier = 1.2;
          durationMultiplier = 1.1;
          break;
        case 'cost_min':
          priorityMultiplier = 0.9;
          durationMultiplier = 0.8;
          break;
      }
      
      totalWaterNeeded *= weatherAdjustment * priorityMultiplier;
      
      // Calculate costs
      const waterCost = totalWaterNeeded * irrigationData.waterPrice;
      const energyUsage = totalWaterNeeded * 0.2; // kWh per m3 (pumping)
      const energyCost = energyUsage * irrigationData.energyCost;
      const totalCost = waterCost + energyCost;
      
      // Generate schedule
      const scheduleItems = [];
      const now = new Date();
      
      zoneCalculations.forEach((zone, index) => {
        const startTime = new Date(now);
        startTime.setDate(startTime.getDate() + (index % 3));
        startTime.setHours(6 + (index * 2), 0, 0, 0);
        
        const duration = Math.round((zone.adjustedWater * durationMultiplier) / 100); // minutes
        
        scheduleItems.push({
          zone: zone.name,
          startTime: startTime.toISOString(),
          duration,
          waterAmount: Math.round(zone.adjustedWater * durationMultiplier),
          method: method.name,
          status: index === 0 ? 'scheduled' : 'pending'
        });
      });
      
      // Optimization results
      const results = {
        zones: zoneCalculations,
        schedule: scheduleItems,
        totals: {
          area: Math.round(totalArea * 100) / 100,
          waterNeeded: Math.round(totalWaterNeeded * 100) / 100,
          waterSaved: Math.round(totalWaterNeeded * method.waterSavings * 100) / 100,
          cost: {
            water: Math.round(waterCost * 100) / 100,
            energy: Math.round(energyCost * 100) / 100,
            total: Math.round(totalCost * 100) / 100,
            perHectare: Math.round((totalCost / totalArea) * 100) / 100
          },
          efficiency: Math.round(method.efficiency * 100),
          savings: Math.round(method.waterSavings * 100)
        },
        recommendations: generateRecommendations(zoneCalculations, method, source, totalWaterNeeded)
      };
      
      setSchedule(scheduleItems);
      setOptimizationResults(results);
      setLoading(false);
    }, 1500);
  };

  const calculateNextIrrigation = (zone, method) => {
    const now = new Date();
    const hoursToAdd = method.id === 'drip' ? 24 : 
                      method.id === 'sprinkler' ? 48 : 72;
    const next = new Date(now.getTime() + hoursToAdd * 60 * 60 * 1000);
    return next.toISOString();
  };

  const generateRecommendations = (zones, method, source, totalWater) => {
    const recommendations = [];
    
    // Water saving recommendations
    if (method.waterSavings < 0.3) {
      recommendations.push({
        type: 'warning',
        icon: '💧',
        title: 'Water Efficiency Low',
        message: `Current method (${method.name}) has ${Math.round(method.waterSavings * 100)}% water savings. Consider switching to drip irrigation for up to 40% savings.`,
        action: 'Upgrade to drip irrigation'
      });
    }
    
    // Cost optimization
    if (source.costPerM3 > 0.15) {
      recommendations.push({
        type: 'cost',
        icon: '💰',
        title: 'High Water Cost',
        message: `Water source (${source.name}) costs $${source.costPerM3}/m³. Consider rainwater harvesting or river water to reduce costs.`,
        action: 'Explore alternative water sources'
      });
    }
    
    // Zone-specific recommendations
    zones.forEach(zone => {
      if (zone.efficiency < 0.7) {
        recommendations.push({
          type: 'info',
          icon: zone.icon,
          title: `${zone.name} Efficiency`,
          message: `Irrigation efficiency in ${zone.name} is ${Math.round(zone.efficiency * 100)}%. Consider soil improvement or system maintenance.`,
          action: 'Improve soil structure'
        });
      }
    });
    
    // Weather integration
    if (!irrigationData.weatherIntegration) {
      recommendations.push({
        type: 'success',
        icon: '⛅',
        title: 'Weather Integration',
        message: 'Enable weather integration to automatically adjust irrigation based on rainfall forecasts.',
        action: 'Enable weather integration'
      });
    }
    
    // Rainwater harvesting
    if (source.id !== 'rainwater' && weatherForecast?.[0]?.rainChance > 50) {
      recommendations.push({
        type: 'eco',
        icon: '🌧️',
        title: 'Rainwater Opportunity',
        message: `High rain chance (${weatherForecast[0].rainChance}%) forecasted. Consider collecting rainwater.`,
        action: 'Setup rainwater collection'
      });
    }
    
    return recommendations;
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setIrrigationData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : 
              type === 'number' ? parseFloat(value) : value
    }));
  };

  const handleZoneToggle = (zoneId) => {
    setIrrigationData(prev => {
      const newZones = prev.selectedZones.includes(zoneId)
        ? prev.selectedZones.filter(id => id !== zoneId)
        : [...prev.selectedZones, zoneId];
      return { ...prev, selectedZones: newZones };
    });
  };

  const runSimulation = () => {
    setSimulationRunning(true);
    setTimeout(() => {
      calculateSchedule();
      setSimulationRunning(false);
    }, 2000);
  };

  const startIrrigationNow = () => {
    alert('Starting irrigation now... This would trigger your irrigation system in a real implementation.');
    // In real app: call backend API to start irrigation
  };

  const saveSchedule = () => {
    alert('Irrigation schedule saved!');
    // In real app: save to database
  };

  // Initialize data
  useEffect(() => {
    fetchWeatherForecast();
    fetchSoilMoisture();
    calculateSchedule();
  }, []);

  const formatTime = (timeString) => {
    const date = new Date(timeString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <div className="smart-irrigation">
      <div className="irrigation-header">
        <h1>💧 Smart Irrigation Optimization</h1>
        <p className="subtitle">AI-powered irrigation scheduling for maximum yield with minimum water use</p>
      </div>

      <div className="irrigation-container">
        {/* Control Panel */}
        <div className="control-panel">
          <div className="panel-card">
            <h3>⚙️ Irrigation Configuration</h3>
            
            <div className="config-section">
              <h4>Select Zones</h4>
              <div className="zones-grid">
                {irrigationZones.map(zone => (
                  <div
                    key={zone.id}
                    className={`zone-card ${irrigationData.selectedZones.includes(zone.id) ? 'selected' : ''}`}
                    onClick={() => handleZoneToggle(zone.id)}
                  >
                    <div className="zone-icon">{zone.icon}</div>
                    <div className="zone-info">
                      <span className="zone-name">{zone.name}</span>
                      <span className="zone-details">{zone.area} ha • {zone.crop}</span>
                    </div>
                    <div className="zone-efficiency">
                      {Math.round(zone.efficiency * 100)}% eff.
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="config-section">
              <h4>Irrigation Method</h4>
              <div className="methods-grid">
                {irrigationMethods.map(method => (
                  <div
                    key={method.id}
                    className={`method-card ${irrigationData.irrigationMethod === method.id ? 'selected' : ''}`}
                    onClick={() => setIrrigationData(prev => ({ ...prev, irrigationMethod: method.id }))}
                  >
                    <div className="method-header">
                      <span className="method-name">{method.name}</span>
                      <span className="method-efficiency">{Math.round(method.efficiency * 100)}%</span>
                    </div>
                    <div className="method-details">
                      <span className="method-saving">Saves {Math.round(method.waterSavings * 100)}% water</span>
                      <span className="method-cost">${method.costPerHa}/ha</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="config-section">
              <h4>Water Source</h4>
              <div className="sources-grid">
                {waterSources.map(source => (
                  <div
                    key={source.id}
                    className={`source-card ${irrigationData.waterSource === source.id ? 'selected' : ''}`}
                    onClick={() => setIrrigationData(prev => ({ ...prev, waterSource: source.id }))}
                  >
                    <div className="source-icon">{source.icon}</div>
                    <div className="source-info">
                      <span className="source-name">{source.name}</span>
                      <span className="source-cost">${source.costPerM3}/m³</span>
                    </div>
                    <div className="source-reliability">
                      {Math.round(source.reliability * 100)}% reliable
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="config-section">
              <h4>Optimization Priority</h4>
              <div className="priority-buttons">
                <button
                  className={`priority-btn ${irrigationData.priority === 'water_saving' ? 'active' : ''}`}
                  onClick={() => setIrrigationData(prev => ({ ...prev, priority: 'water_saving' }))}
                >
                  💧 Water Saving
                </button>
                <button
                  className={`priority-btn ${irrigationData.priority === 'yield_max' ? 'active' : ''}`}
                  onClick={() => setIrrigationData(prev => ({ ...prev, priority: 'yield_max' }))}
                >
                  🌾 Max Yield
                </button>
                <button
                  className={`priority-btn ${irrigationData.priority === 'cost_min' ? 'active' : ''}`}
                  onClick={() => setIrrigationData(prev => ({ ...prev, priority: 'cost_min' }))}
                >
                  💰 Cost Minimization
                </button>
              </div>
            </div>

            <div className="config-section">
              <h4>Smart Features</h4>
              <div className="feature-toggles">
                <label className="feature-toggle">
                  <input
                    type="checkbox"
                    name="weatherIntegration"
                    checked={irrigationData.weatherIntegration}
                    onChange={handleInputChange}
                  />
                  <span className="toggle-label">
                    <span className="toggle-icon">⛅</span>
                    Weather Integration
                  </span>
                  <span className="toggle-desc">Adjust based on rain forecast</span>
                </label>
                
                <label className="feature-toggle">
                  <input
                    type="checkbox"
                    name="rainDelay"
                    checked={irrigationData.rainDelay}
                    onChange={handleInputChange}
                  />
                  <span className="toggle-label">
                    <span className="toggle-icon">🌧️</span>
                    Rain Delay
                  </span>
                  <span className="toggle-desc">Skip irrigation if rain expected</span>
                </label>
              </div>
            </div>

            <div className="config-section">
              <h4>Soil Moisture Threshold</h4>
              <div className="slider-container">
                <input
                  type="range"
                  name="soilMoistureThreshold"
                  min="30"
                  max="80"
                  value={irrigationData.soilMoistureThreshold}
                  onChange={handleInputChange}
                  className="threshold-slider"
                />
                <div className="slider-labels">
                  <span>Dry ({irrigationData.soilMoistureThreshold}%)</span>
                  <span>Optimal</span>
                  <span>Wet</span>
                </div>
                <div className="threshold-value">
                  Trigger irrigation at: <strong>{irrigationData.soilMoistureThreshold}%</strong>
                </div>
              </div>
            </div>

            <div className="action-buttons">
              <button 
                className="action-btn primary"
                onClick={runSimulation}
                disabled={loading || simulationRunning}
              >
                {simulationRunning ? '🔄 Optimizing...' : '🧮 Optimize Schedule'}
              </button>
              <button 
                className="action-btn secondary"
                onClick={startIrrigationNow}
              >
                🚀 Start Irrigation Now
              </button>
            </div>
          </div>

          {/* Weather Forecast */}
          {weatherForecast && (
            <div className="weather-card">
              <h4>⛅ 5-Day Forecast</h4>
              <div className="forecast-grid">
                {weatherForecast.map((day, index) => (
                  <div key={index} className="forecast-day">
                    <div className="day-header">
                      <span className="day-name">{day.day}</span>
                      <span className="day-condition">{day.condition}</span>
                    </div>
                    <div className="day-details">
                      <span className="day-temp">{Math.round(day.temp)}°C</span>
                      <span className="day-rain">☔ {day.rainChance}%</span>
                      <span className="day-humidity">💧 {Math.round(day.humidity)}%</span>
                    </div>
                    {day.rainChance > 50 && (
                      <div className="rain-alert">
                        ⚠️ {day.rainAmount}mm rain expected
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Results Panel */}
        <div className="results-panel">
          {loading ? (
            <div className="loading-state">
              <div className="loader"></div>
              <p>Optimizing irrigation schedule...</p>
              <p className="loading-detail">Analyzing weather, soil moisture, and crop requirements</p>
            </div>
          ) : optimizationResults && (
            <>
              {/* Summary Card */}
              <div className="summary-card">
                <div className="summary-header">
                  <h3>📊 Irrigation Summary</h3>
                  <div className="summary-stats">
                    <span className="stat">
                      <span className="stat-label">Total Area:</span>
                      <span className="stat-value">{optimizationResults.totals.area} ha</span>
                    </span>
                    <span className="stat">
                      <span className="stat-label">Water Needed:</span>
                      <span className="stat-value">{optimizationResults.totals.waterNeeded} m³</span>
                    </span>
                    <span className="stat">
                      <span className="stat-label">Water Saved:</span>
                      <span className="stat-value">{optimizationResults.totals.waterSaved} m³</span>
                    </span>
                  </div>
                </div>

                <div className="cost-breakdown">
                  <h4>💰 Cost Breakdown</h4>
                  <div className="cost-grid">
                    <div className="cost-item water">
                      <span className="cost-label">Water Cost</span>
                      <span className="cost-value">${optimizationResults.totals.cost.water}</span>
                    </div>
                    <div className="cost-item energy">
                      <span className="cost-label">Energy Cost</span>
                      <span className="cost-value">${optimizationResults.totals.cost.energy}</span>
                    </div>
                    <div className="cost-item total">
                      <span className="cost-label">Total Cost</span>
                      <span className="cost-value">${optimizationResults.totals.cost.total}</span>
                    </div>
                    <div className="cost-item per-ha">
                      <span className="cost-label">Per Hectare</span>
                      <span className="cost-value">${optimizationResults.totals.cost.perHectare}/ha</span>
                    </div>
                  </div>
                </div>

                <div className="efficiency-metrics">
                  <h4>📈 Efficiency Metrics</h4>
                  <div className="metrics-grid">
                    <div className="metric">
                      <div className="metric-label">System Efficiency</div>
                      <div className="metric-bar">
                        <div 
                          className="metric-fill" 
                          style={{ width: `${optimizationResults.totals.efficiency}%` }}
                        ></div>
                      </div>
                      <div className="metric-value">{optimizationResults.totals.efficiency}%</div>
                    </div>
                    <div className="metric">
                      <div className="metric-label">Water Savings</div>
                      <div className="metric-bar">
                        <div 
                          className="metric-fill" 
                          style={{ width: `${optimizationResults.totals.savings}%` }}
                        ></div>
                      </div>
                      <div className="metric-value">{optimizationResults.totals.savings}%</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Schedule Card */}
              <div className="schedule-card">
                <div className="schedule-header">
                  <h3>📅 Irrigation Schedule</h3>
                  <button className="save-btn" onClick={saveSchedule}>
                    💾 Save Schedule
                  </button>
                </div>

                <div className="schedule-list">
                  {optimizationResults.schedule.map((item, index) => (
                    <div key={index} className="schedule-item">
                      <div className="schedule-time">
                        <span className="schedule-day">{formatDate(item.startTime)}</span>
                        <span className="schedule-hour">{formatTime(item.startTime)}</span>
                      </div>
                      <div className="schedule-details">
                        <span className="schedule-zone">{item.zone}</span>
                        <span className="schedule-method">{item.method}</span>
                      </div>
                      <div className="schedule-metrics">
                        <span className="schedule-duration">⏱️ {item.duration} min</span>
                        <span className="schedule-water">💧 {item.waterAmount} L</span>
                      </div>
                      <div className={`schedule-status ${item.status}`}>
                        {item.status}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Zone Details */}
              <div className="zones-card">
                <h3>🌾 Zone Details</h3>
                <div className="zones-details">
                  {optimizationResults.zones.map((zone, index) => (
                    <div key={index} className="zone-detail">
                      <div className="zone-header">
                        <span className="zone-icon">{zone.icon}</span>
                        <span className="zone-title">{zone.name}</span>
                        <span className="zone-crop">{zone.crop}</span>
                      </div>
                      <div className="zone-metrics">
                        <div className="zone-metric">
                          <span className="metric-label">Water Required:</span>
                          <span className="metric-value">{zone.adjustedWater} L/day</span>
                        </div>
                        <div className="zone-metric">
                          <span className="metric-label">Next Irrigation:</span>
                          <span className="metric-value">{formatDate(zone.nextIrrigation)}</span>
                        </div>
                        <div className="zone-metric">
                          <span className="metric-label">Efficiency:</span>
                          <span className="metric-value">{Math.round(zone.efficiency * 100)}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommendations */}
              {optimizationResults.recommendations.length > 0 && (
                <div className="recommendations-card">
                  <h3>💡 AI Recommendations</h3>
                  <div className="recommendations-list">
                    {optimizationResults.recommendations.map((rec, index) => (
                      <div key={index} className={`recommendation ${rec.type}`}>
                        <div className="rec-icon">{rec.icon}</div>
                        <div className="rec-content">
                          <div className="rec-title">{rec.title}</div>
                          <div className="rec-message">{rec.message}</div>
                          <div className="rec-action">{rec.action}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="final-actions">
                <button className="action-btn success">
                  🚀 Apply This Schedule
                </button>
                <button className="action-btn info">
                  📋 Generate Report
                </button>
                <button className="action-btn warning">
                  🔄 Compare Scenarios
                </button>
                <button className="action-btn">
                  📱 Share with Team
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SmartIrrigation;