import React, { useState, useEffect, useRef } from 'react';
import './SmartIrrigation.css';

const SmartIrrigation = () => {
  // AI-Enhanced Zones with Edge Computing Capability
  const irrigationZones = [
    { 
      id: 'main_field', 
      name: 'Main Field', 
      area: 2.5, 
      crop: 'Maize', 
      efficiency: 0.75, 
      icon: '🌽',
      soilType: 'clay_loam',
      aiCapability: 'high',
      edgeDevice: 'Solar Sensor Node A1',
      cropCoefficient: 1.2,
      rootDepth: 0.6 // meters
    },
    { 
      id: 'vegetable_garden', 
      name: 'Vegetable Garden', 
      area: 0.5, 
      crop: 'Tomatoes', 
      efficiency: 0.85, 
      icon: '🍅',
      soilType: 'sandy_loam',
      aiCapability: 'high',
      edgeDevice: 'IoT Valve Controller B2',
      cropCoefficient: 1.15,
      rootDepth: 0.4
    },
    { 
      id: 'orchard', 
      name: 'Orchard', 
      area: 1.0, 
      crop: 'Fruit Trees', 
      efficiency: 0.65, 
      icon: '🌳',
      soilType: 'clay',
      aiCapability: 'medium',
      edgeDevice: 'Smart Moisture Probe C3',
      cropCoefficient: 0.8,
      rootDepth: 1.2
    },
    { 
      id: 'nursery', 
      name: 'Nursery', 
      area: 0.25, 
      crop: 'Seedlings', 
      efficiency: 0.90, 
      icon: '🌱',
      soilType: 'potting_mix',
      aiCapability: 'high',
      edgeDevice: 'Micro-drip Controller D4',
      cropCoefficient: 1.3,
      rootDepth: 0.2
    },
    { 
      id: 'pasture', 
      name: 'Pasture', 
      area: 5.0, 
      crop: 'Grass', 
      efficiency: 0.60, 
      icon: '🌾',
      soilType: 'loam',
      aiCapability: 'low',
      edgeDevice: 'Weather Station E5',
      cropCoefficient: 0.7,
      rootDepth: 0.3
    }
  ];

  // Smart Irrigation Methods with AI Features
  const irrigationMethods = [
    { 
      id: 'ai_drip', 
      name: 'AI Drip Irrigation', 
      efficiency: 0.95, 
      costPerHa: 1800, 
      waterSavings: 0.45,
      aiFeatures: ['Precision valves', 'Real-time adjustment', 'Nutrient injection'],
      offlineCapable: true,
      solarPowered: true
    },
    { 
      id: 'smart_sprinkler', 
      name: 'Smart Sprinkler System', 
      efficiency: 0.82, 
      costPerHa: 1200, 
      waterSavings: 0.30,
      aiFeatures: ['Wind compensation', 'Evaporation reduction', 'Pattern optimization'],
      offlineCapable: true,
      solarPowered: true
    },
    { 
      id: 'precision_flood', 
      name: 'Precision Flood', 
      efficiency: 0.65, 
      costPerHa: 400, 
      waterSavings: 0.15,
      aiFeatures: ['Laser leveling', 'Flow control', 'Water depth sensors'],
      offlineCapable: false,
      solarPowered: false
    },
    { 
      id: 'ai_manual', 
      name: 'AI-Assisted Manual', 
      efficiency: 0.75, 
      costPerHa: 300, 
      waterSavings: 0.20,
      aiFeatures: ['Mobile app guidance', 'Soil sensor integration', 'Timing optimization'],
      offlineCapable: true,
      solarPowered: true
    },
    { 
      id: 'solar_pivot', 
      name: 'Solar Center Pivot', 
      efficiency: 0.88, 
      costPerHa: 4500, 
      waterSavings: 0.38,
      aiFeatures: ['Solar tracking', 'Variable speed', 'Yield mapping'],
      offlineCapable: true,
      solarPowered: true
    }
  ];

  // Water Sources with IoT Integration
  const waterSources = [
    { 
      id: 'smart_borehole', 
      name: 'Smart Borehole', 
      costPerM3: 0.12, 
      reliability: 0.98, 
      icon: '⛏️',
      iotFeatures: ['Pump monitoring', 'Water quality sensors', 'Predictive maintenance'],
      renewable: false
    },
    { 
      id: 'river_iot', 
      name: 'IoT River Monitoring', 
      costPerM3: 0.04, 
      reliability: 0.75, 
      icon: '🌊',
      iotFeatures: ['Water level sensors', 'Flow rate monitoring', 'Pollution alerts'],
      renewable: true
    },
    { 
      id: 'smart_dam', 
      name: 'Smart Dam System', 
      costPerM3: 0.07, 
      reliability: 0.90, 
      icon: '🏞️',
      iotFeatures: ['Level sensors', 'Leak detection', 'Evaporation control'],
      renewable: true
    },
    { 
      id: 'ai_rainwater', 
      name: 'AI Rainwater Harvesting', 
      costPerM3: 0.01, 
      reliability: 0.60, 
      icon: '🌧️',
      iotFeatures: ['Rain prediction', 'Storage optimization', 'Quality monitoring'],
      renewable: true
    },
    { 
      id: 'recycled_water', 
      name: 'Recycled Water AI', 
      costPerM3: 0.08, 
      reliability: 0.95, 
      icon: '♻️',
      iotFeatures: ['Quality monitoring', 'Treatment optimization', 'Usage tracking'],
      renewable: true
    }
  ];

  // Initial state with AI/Edge enhancements
  const [irrigationData, setIrrigationData] = useState({
    selectedZones: ['main_field', 'vegetable_garden'],
    irrigationMethod: 'ai_drip',
    waterSource: 'smart_borehole',
    soilMoistureThreshold: 50,
    weatherIntegration: true,
    rainDelay: true,
    scheduleType: 'ai_adaptive',
    aiMode: 'conservation', // 'conservation', 'yield_boost', 'balanced'
    fixedSchedule: {
      frequency: 'daily',
      startTime: '06:00',
      duration: 30
    },
    maxDailyWater: 10000,
    energyCost: 0.12,
    waterPrice: 0.15,
    priority: 'ai_optimized',
    edgeProcessing: true,
    predictiveMaintenance: true,
    nutrientInjection: false,
    soilHealthMonitoring: true
  });

  const [weatherForecast, setWeatherForecast] = useState(null);
  const [soilMoistureData, setSoilMoistureData] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [optimizationResults, setOptimizationResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [edgeDevices, setEdgeDevices] = useState([]);
  const [aiInsights, setAiInsights] = useState([]);
  const [waterQuality, setWaterQuality] = useState(null);

  // Edge Device Monitoring
  const initializeEdgeDevices = () => {
    const devices = [
      {
        id: 'device_1',
        name: 'Solar Soil Sensor A1',
        status: 'online',
        battery: 85,
        lastUpdate: new Date(),
        metrics: {
          soilMoisture: 47.5,
          soilTemp: 24.3,
          salinity: 0.8
        },
        location: 'Main Field NE'
      },
      {
        id: 'device_2',
        name: 'Smart Valve Controller B2',
        status: 'online',
        battery: 92,
        lastUpdate: new Date(),
        metrics: {
          flowRate: 12.5,
          pressure: 2.1,
          valvePosition: 75
        },
        location: 'Vegetable Garden'
      },
      {
        id: 'device_3',
        name: 'Weather Station C3',
        status: 'online',
        battery: 78,
        lastUpdate: new Date(),
        metrics: {
          temperature: 28.5,
          humidity: 65,
          windSpeed: 8.2,
          solarRadiation: 850
        },
        location: 'Farm Center'
      }
    ];
    setEdgeDevices(devices);
  };

  // AI Weather Integration
  const fetchWeatherForecast = async () => {
    // Simulate AI weather prediction
    const days = ['Today', 'Tomorrow', 'Day 3', 'Day 4', 'Day 5'];
    const forecast = days.map(day => ({
      day,
      temp: 25 + Math.random() * 10,
      humidity: 40 + Math.random() * 40,
      rainChance: Math.floor(Math.random() * 100),
      rainAmount: Math.floor(Math.random() * 20),
      wind: 5 + Math.random() * 15,
      evapotranspiration: 4 + Math.random() * 3,
      condition: ['Sunny', 'Partly Cloudy', 'Cloudy', 'Light Rain', 'Thunderstorms'][Math.floor(Math.random() * 5)],
      aiInsight: generateWeatherInsight()
    }));
    setWeatherForecast(forecast);
  };

  const generateWeatherInsight = () => {
    const insights = [
      'High evaporation expected, increase irrigation frequency',
      'Rain expected tomorrow, delay irrigation',
      'Optimal conditions for watering',
      'Windy conditions, avoid sprinkler irrigation',
      'Cool temperatures, reduce water amount'
    ];
    return insights[Math.floor(Math.random() * insights.length)];
  };

  // AI Soil Analysis Integration
  const fetchSoilMoisture = () => {
    const zones = irrigationZones.map(zone => ({
      ...zone,
      currentMoisture: 40 + Math.random() * 40,
      optimalMoisture: zone.crop === 'Tomatoes' ? 65 : 
                       zone.crop === 'Maize' ? 60 : 
                       zone.crop === 'Fruit Trees' ? 55 : 50,
      lastIrrigation: new Date(Date.now() - Math.random() * 172800000),
      waterRequired: Math.floor(zone.area * (20 + Math.random() * 30)),
      soilHealth: {
        nitrogen: 45 + Math.random() * 30,
        phosphorus: 25 + Math.random() * 20,
        potassium: 180 + Math.random() * 50,
        ph: 6.0 + Math.random() * 1.5
      },
      aiRecommendation: generateSoilRecommendation(zone)
    }));
    setSoilMoistureData(zones);
  };

  const generateSoilRecommendation = (zone) => {
    const recs = [
      `Soil moisture optimal for ${zone.crop}`,
      `Consider adding organic matter to ${zone.name}`,
      `${zone.crop} showing good nutrient levels`,
      `Monitor ${zone.name} for water stress signs`,
      `Ideal conditions for ${zone.crop} growth`
    ];
    return recs[Math.floor(Math.random() * recs.length)];
  };

  // AI-Powered Irrigation Optimization
  const calculateSchedule = () => {
    setLoading(true);
    
    setTimeout(() => {
      const selectedZones = irrigationZones.filter(zone => 
        irrigationData.selectedZones.includes(zone.id)
      );
      
      const method = irrigationMethods.find(m => m.id === irrigationData.irrigationMethod);
      const source = waterSources.find(s => s.id === irrigationData.waterSource);
      
      // AI Crop Water Requirement Calculation
      let totalWaterNeeded = 0;
      let totalArea = 0;
      
      const zoneCalculations = selectedZones.map(zone => {
        // Penman-Monteith evapotranspiration (simplified)
        const et0 = 5.0; // Reference evapotranspiration mm/day
        const kc = zone.cropCoefficient; // Crop coefficient
        const etc = et0 * kc; // Crop evapotranspiration
        
        // Water requirement in m3/day
        const waterRequirement = (etc * zone.area * 10) / 1000; // Convert mm to m3
        
        // Adjust for soil type and root depth
        const soilFactor = zone.soilType === 'clay' ? 1.1 : 
                          zone.soilType === 'sandy' ? 0.9 : 1.0;
        
        const adjustedWater = waterRequirement * soilFactor / method.efficiency;
        
        totalWaterNeeded += adjustedWater;
        totalArea += zone.area;
        
        // AI-generated irrigation timing
        const nextIrrigation = calculateOptimalIrrigationTime(zone, method);
        
        return {
          ...zone,
          waterRequirement: Math.round(waterRequirement * 100) / 100,
          adjustedWater: Math.round(adjustedWater * 100) / 100,
          nextIrrigation,
          et0,
          kc,
          etc: Math.round(etc * 100) / 100
        };
      });
      
      // AI Weather Adjustment
      let weatherAdjustment = 1.0;
      let aiWeatherInsight = '';
      
      if (irrigationData.weatherIntegration && weatherForecast) {
        const today = weatherForecast[0];
        const rainProbability = today.rainChance / 100;
        
        // AI decision making for weather
        if (rainProbability > 0.7) {
          weatherAdjustment = 0.2;
          aiWeatherInsight = 'Heavy rain expected - significantly reducing irrigation';
        } else if (rainProbability > 0.5) {
          weatherAdjustment = 0.5;
          aiWeatherInsight = 'Moderate rain chance - reducing irrigation';
        } else if (today.evapotranspiration > 6) {
          weatherAdjustment = 1.2;
          aiWeatherInsight = 'High evaporation - increasing irrigation';
        } else {
          aiWeatherInsight = 'Normal conditions - standard irrigation';
        }
      }
      
      // AI Priority Mode Adjustment
      let priorityMultiplier = 1.0;
      let aiPriorityInsight = '';
      
      switch(irrigationData.aiMode) {
        case 'conservation':
          priorityMultiplier = 0.8;
          aiPriorityInsight = 'Water conservation mode activated';
          break;
        case 'yield_boost':
          priorityMultiplier = 1.2;
          aiPriorityInsight = 'Yield optimization mode activated';
          break;
        case 'balanced':
          priorityMultiplier = 1.0;
          aiPriorityInsight = 'Balanced water-yield optimization';
          break;
      }
      
      totalWaterNeeded *= weatherAdjustment * priorityMultiplier;
      
      // AI Cost Optimization
      const waterCost = totalWaterNeeded * irrigationData.waterPrice;
      const energyUsage = totalWaterNeeded * 0.18; // kWh per m3
      const energyCost = energyUsage * irrigationData.energyCost;
      const totalCost = waterCost + energyCost;
      
      // Carbon Footprint Calculation
      const carbonFootprint = totalWaterNeeded * 0.15; // kg CO2 per m3
      
      // AI Schedule Generation
      const scheduleItems = generateAISchedule(zoneCalculations, method);
      
      // AI Insights Generation
      const insights = generateAIInsights(
        zoneCalculations, 
        method, 
        source, 
        totalWaterNeeded,
        weatherAdjustment,
        priorityMultiplier
      );
      
      setAiInsights(insights);
      
      // Optimization results
      const results = {
        zones: zoneCalculations,
        schedule: scheduleItems,
        totals: {
          area: Math.round(totalArea * 100) / 100,
          waterNeeded: Math.round(totalWaterNeeded * 100) / 100,
          waterSaved: Math.round(totalWaterNeeded * method.waterSavings * 100) / 100,
          carbonFootprint: Math.round(carbonFootprint * 100) / 100,
          cost: {
            water: Math.round(waterCost * 100) / 100,
            energy: Math.round(energyCost * 100) / 100,
            total: Math.round(totalCost * 100) / 100,
            perHectare: Math.round((totalCost / totalArea) * 100) / 100
          },
          efficiency: Math.round(method.efficiency * 100),
          savings: Math.round(method.waterSavings * 100),
          aiScore: calculateAIScore(zoneCalculations, method)
        },
        recommendations: generateAIRecommendations(zoneCalculations, method, source),
        aiInsights: insights
      };
      
      setSchedule(scheduleItems);
      setOptimizationResults(results);
      setLoading(false);
    }, 1500);
  };

  const calculateOptimalIrrigationTime = (zone, method) => {
    // AI determines best irrigation time
    const now = new Date();
    let optimalTime;
    
    // Avoid peak evaporation times (10am-4pm)
    // Prefer early morning or late evening
    const hour = now.getHours();
    let targetHour;
    
    if (hour < 6 || hour > 18) {
      // Current time is good for irrigation
      targetHour = hour;
    } else {
      // Schedule for next morning
      targetHour = 6;
      now.setDate(now.getDate() + 1);
    }
    
    optimalTime = new Date(now);
    optimalTime.setHours(targetHour, 0, 0, 0);
    
    return optimalTime.toISOString();
  };

  const generateAISchedule = (zones, method) => {
    const scheduleItems = [];
    
    zones.forEach((zone, index) => {
      const startTime = new Date(zone.nextIrrigation);
      const duration = calculateOptimalDuration(zone, method);
      
      scheduleItems.push({
        zone: zone.name,
        startTime: startTime.toISOString(),
        duration,
        waterAmount: Math.round(zone.adjustedWater * 1000), // Convert to liters
        method: method.name,
        status: 'ai_scheduled',
        aiReason: `Optimal for ${zone.crop} growth cycle`,
        energyRequired: calculateEnergyRequirement(zone, method)
      });
    });
    
    return scheduleItems;
  };

  const calculateOptimalDuration = (zone, method) => {
    // AI calculates optimal irrigation duration
    const baseDuration = 30; // minutes
    const soilFactor = zone.soilType === 'clay' ? 1.3 : 
                      zone.soilType === 'sandy' ? 0.7 : 1.0;
    const methodFactor = method.id === 'ai_drip' ? 1.5 : 
                        method.id === 'smart_sprinkler' ? 1.0 : 0.8;
    
    return Math.round(baseDuration * soilFactor * methodFactor);
  };

  const calculateEnergyRequirement = (zone, method) => {
    // Calculate energy needed for pumping
    const waterVolume = zone.adjustedWater; // m3
    const head = 30; // meters (pumping height)
    const pumpEfficiency = 0.7;
    
    // Energy in kWh = (Water volume * head * 9.81) / (3.6e6 * efficiency)
    const energy = (waterVolume * head * 9.81) / (3.6e6 * pumpEfficiency);
    return Math.round(energy * 100) / 100;
  };

  const calculateAIScore = (zones, method) => {
    // AI performance score (0-100)
    let score = 70;
    
    // Efficiency bonus
    score += method.efficiency * 20;
    
    // Water savings bonus
    score += method.waterSavings * 15;
    
    // Solar bonus
    if (method.solarPowered) score += 10;
    
    // Edge capability bonus
    if (method.offlineCapable) score += 5;
    
    return Math.min(100, Math.round(score));
  };

  const generateAIInsights = (zones, method, source, totalWater, weatherAdj, priorityAdj) => {
    const insights = [];
    
    // Water Source Insight
    insights.push({
      type: 'source',
      icon: source.icon,
      title: `Water Source: ${source.name}`,
      message: `${source.iotFeatures.length} IoT features active`,
      impact: `Reliability: ${Math.round(source.reliability * 100)}%`
    });
    
    // Method Insight
    insights.push({
      type: 'method',
      icon: '⚡',
      title: `Method: ${method.name}`,
      message: method.aiFeatures.join(', '),
      impact: `${Math.round(method.waterSavings * 100)}% water savings`
    });
    
    // Weather Insight
    if (weatherAdj !== 1.0) {
      insights.push({
        type: 'weather',
        icon: '⛅',
        title: 'Weather Adjustment',
        message: `AI adjusted water by ${Math.round((1 - weatherAdj) * 100)}%`,
        impact: `Based on ${weatherForecast?.[0]?.rainChance || 0}% rain chance`
      });
    }
    
    // Priority Insight
    insights.push({
      type: 'priority',
      icon: '🎯',
      title: `AI Mode: ${irrigationData.aiMode}`,
      message: aiPriorityInsight || 'Standard optimization',
      impact: `Multiplier: ${priorityAdj.toFixed(1)}x`
    });
    
    // Carbon Insight
    const carbon = totalWater * 0.15;
    insights.push({
      type: 'carbon',
      icon: '🌿',
      title: 'Carbon Footprint',
      message: `${Math.round(carbon)} kg CO2 equivalent`,
      impact: `Offset by ${Math.round(carbon / 10)} tree days`
    });
    
    return insights;
  };

  const generateAIRecommendations = (zones, method, source) => {
    const recommendations = [];
    
    // Smart Method Upgrade
    if (method.waterSavings < 0.4) {
      recommendations.push({
        type: 'upgrade',
        icon: '🚀',
        title: 'Upgrade to AI Drip',
        message: `Current method saves ${Math.round(method.waterSavings * 100)}% water. AI Drip can save 45%+.`,
        action: 'Explore AI Drip Systems',
        roi: '6-12 months'
      });
    }
    
    // Solar Integration
    if (!method.solarPowered) {
      recommendations.push({
        type: 'solar',
        icon: '☀️',
        title: 'Add Solar Power',
        message: 'Solar-powered systems reduce energy costs by 90% and work off-grid.',
        action: 'View Solar Options',
        roi: '2-3 years'
      });
    }
    
    // Water Quality Monitoring
    if (source.id !== 'recycled_water' && !source.iotFeatures.includes('Water quality sensors')) {
      recommendations.push({
        type: 'quality',
        icon: '🔬',
        title: 'Water Quality Monitoring',
        message: 'Monitor pH, salinity, and contaminants for better crop health.',
        action: 'Add Water Sensors',
        roi: 'Immediate'
      });
    }
    
    // Edge AI Processing
    if (!irrigationData.edgeProcessing) {
      recommendations.push({
        type: 'edge',
        icon: '⚡',
        title: 'Enable Edge Processing',
        message: 'Process irrigation decisions locally for faster response and offline operation.',
        action: 'Enable Edge AI',
        roi: 'Immediate'
      });
    }
    
    // Nutrient Injection
    if (!irrigationData.nutrientInjection) {
      recommendations.push({
        type: 'nutrient',
        icon: '🧪',
        title: 'Add Nutrient Injection',
        message: 'Inject fertilizers directly into irrigation water for 30% more efficiency.',
        action: 'Add Injector System',
        roi: '1 season'
      });
    }
    
    return recommendations;
  };

  // Initialize all systems
  useEffect(() => {
    fetchWeatherForecast();
    fetchSoilMoisture();
    initializeEdgeDevices();
    calculateSchedule();
    
    // Simulate water quality data
    setWaterQuality({
      pH: 7.2,
      salinity: 0.5,
      turbidity: 1.2,
      contaminants: 'None detected',
      status: 'Excellent'
    });
  }, []);

  // AI Controls
  const runAIOptimization = () => {
    setSimulationRunning(true);
    setAiInsights([{
      type: 'optimizing',
      icon: '🤖',
      title: 'AI Optimization Running',
      message: 'Analyzing 15+ variables for optimal irrigation',
      impact: 'Please wait...'
    }]);
    
    setTimeout(() => {
      calculateSchedule();
      setSimulationRunning(false);
      
      // Add optimization complete insight
      setAiInsights(prev => [...prev, {
        type: 'complete',
        icon: '✅',
        title: 'AI Optimization Complete',
        message: 'Found 3 efficiency improvements',
        impact: 'Schedule updated'
      }]);
    }, 2000);
  };

  const startAIIrrigation = () => {
    alert('🤖 Starting AI-controlled irrigation...\nEdge devices activated. AI monitoring water distribution.');
    // In real app: call IoT/Edge device APIs
  };

  const saveAISchedule = () => {
    alert('💾 AI schedule saved to edge devices\nWill work offline without internet');
  };

  const downloadAIRreport = () => {
    const report = {
      title: 'AI Irrigation Analysis Report',
      generated: new Date().toISOString(),
      data: irrigationData,
      results: optimizationResults,
      insights: aiInsights,
      edgeDevices: edgeDevices
    };
    
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai_irrigation_report_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  // Render helper functions
  const formatTime = (timeString) => {
    const date = new Date(timeString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const getAIBadge = (level) => {
    switch(level) {
      case 'high': return { icon: '🤖🤖🤖', color: '#4CAF50' };
      case 'medium': return { icon: '🤖🤖', color: '#FF9800' };
      case 'low': return { icon: '🤖', color: '#F44336' };
      default: return { icon: '🤖', color: '#666' };
    }
  };

  // ... (rest of the JSX remains similar but enhanced with AI features)
  // Add Edge Devices Panel, AI Insights Panel, Water Quality Panel

  return (
    <div className="smart-irrigation">
      <div className="irrigation-header">
        <h1>🤖 AI-Powered Smart Irrigation</h1>
        <p className="subtitle">Edge Computing • Predictive Analytics • Offline Operation • Carbon Tracking</p>
        
        <div className="ai-status-bar">
          <div className="ai-status-item">
            <span className="ai-status-icon">⚡</span>
            <span className="ai-status-label">Edge AI:</span>
            <span className="ai-status-value">Active</span>
          </div>
          <div className="ai-status-item">
            <span className="ai-status-icon">📡</span>
            <span className="ai-status-label">IoT Devices:</span>
            <span className="ai-status-value">{edgeDevices.length} Online</span>
          </div>
          <div className="ai-status-item">
            <span className="ai-status-icon">🌿</span>
            <span className="ai-status-label">Carbon Saved:</span>
            <span className="ai-status-value">{optimizationResults?.totals.carbonFootprint || 0} kg</span>
          </div>
          <div className="ai-status-item">
            <span className="ai-status-icon">💧</span>
            <span className="ai-status-label">Water Saved:</span>
            <span className="ai-status-value">{optimizationResults?.totals.waterSaved || 0} m³</span>
          </div>
        </div>
      </div>

      <div className="irrigation-container">
        {/* Enhanced Control Panel with AI Features */}
        <div className="control-panel ai-enhanced">
          {/* ... (enhanced configuration sections with AI badges) */}
          
          {/* New: AI Mode Selection */}
          <div className="config-section ai-modes">
            <h4>🎯 AI Optimization Mode</h4>
            <div className="ai-mode-buttons">
              <button
                className={`ai-mode-btn ${irrigationData.aiMode === 'conservation' ? 'active' : ''}`}
                onClick={() => setIrrigationData(prev => ({ ...prev, aiMode: 'conservation' }))}
              >
                💧 Water Conservation
                <span className="mode-desc">Maximize water savings</span>
              </button>
              <button
                className={`ai-mode-btn ${irrigationData.aiMode === 'yield_boost' ? 'active' : ''}`}
                onClick={() => setIrrigationData(prev => ({ ...prev, aiMode: 'yield_boost' }))}
              >
                🌾 Yield Boost
                <span className="mode-desc">Maximize crop production</span>
              </button>
              <button
                className={`ai-mode-btn ${irrigationData.aiMode === 'balanced' ? 'active' : ''}`}
                onClick={() => setIrrigationData(prev => ({ ...prev, aiMode: 'balanced' }))}
              >
                ⚖️ Balanced AI
                <span className="mode-desc">Optimize both water and yield</span>
              </button>
            </div>
          </div>

          {/* New: Edge Devices Panel */}
          <div className="edge-devices-panel">
            <h4>📡 Edge IoT Devices</h4>
            <div className="edge-devices-list">
              {edgeDevices.map(device => (
                <div key={device.id} className="edge-device">
                  <div className="device-header">
                    <span className="device-name">{device.name}</span>
                    <span className={`device-status ${device.status}`}>
                      {device.status === 'online' ? '🟢' : '🔴'} {device.status}
                    </span>
                  </div>
                  <div className="device-metrics">
                    <span className="device-metric">🔋 {device.battery}%</span>
                    <span className="device-metric">📍 {device.location}</span>
                  </div>
                  <div className="device-data">
                    {Object.entries(device.metrics).map(([key, value]) => (
                      <span key={key} className="data-point">
                        {key}: {value}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons with AI */}
          <div className="action-buttons ai">
            <button 
              className="action-btn ai-primary"
              onClick={runAIOptimization}
              disabled={loading || simulationRunning}
            >
              {simulationRunning ? '🤖 AI Optimizing...' : '🧠 AI Optimize'}
            </button>
            <button 
              className="action-btn ai-secondary"
              onClick={startAIIrrigation}
            >
              🚀 Start AI Irrigation
            </button>
            <button 
              className="action-btn ai-tertiary"
              onClick={saveAISchedule}
            >
              💾 Save to Edge
            </button>
          </div>
        </div>

        {/* Enhanced Results Panel with AI Insights */}
        <div className="results-panel ai-enhanced">
          {loading ? (
            <div className="loading-state ai">
              <div className="ai-loader">
                <div className="ai-spinner">🤖</div>
                <p>AI is analyzing 15+ variables...</p>
                <p className="loading-detail">Weather • Soil • Crop Stage • Water Source • Energy • Costs</p>
              </div>
            </div>
          ) : optimizationResults && (
            <>
              {/* AI Insights Panel */}
              <div className="ai-insights-panel">
                <h3>🧠 AI Insights</h3>
                <div className="ai-insights-grid">
                  {aiInsights.map((insight, index) => (
                    <div key={index} className={`ai-insight ${insight.type}`}>
                      <div className="insight-icon">{insight.icon}</div>
                      <div className="insight-content">
                        <div className="insight-title">{insight.title}</div>
                        <div className="insight-message">{insight.message}</div>
                        <div className="insight-impact">{insight.impact}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Enhanced Summary with AI Score */}
              <div className="summary-card ai">
                <div className="summary-header ai">
                  <h3>📊 AI Irrigation Summary</h3>
                  <div className="ai-score">
                    <span className="score-label">AI Score:</span>
                    <span className="score-value">{optimizationResults.totals.aiScore}/100</span>
                  </div>
                </div>

                {/* Carbon Footprint */}
                <div className="carbon-footprint">
                  <h4>🌿 Carbon Impact</h4>
                  <div className="carbon-metrics">
                    <div className="carbon-metric">
                      <span className="metric-label">Water Footprint:</span>
                      <span className="metric-value">{optimizationResults.totals.carbonFootprint} kg CO2</span>
                    </div>
                    <div className="carbon-metric">
                      <span className="metric-label">Equivalent to:</span>
                      <span className="metric-value">{Math.round(optimizationResults.totals.carbonFootprint / 0.5)} tree days</span>
                    </div>
                    <div className="carbon-metric">
                      <span className="metric-label">Offset Potential:</span>
                      <span className="metric-value">${Math.round(optimizationResults.totals.carbonFootprint * 0.05)} in credits</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ... (rest of the enhanced panels) */}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SmartIrrigation;