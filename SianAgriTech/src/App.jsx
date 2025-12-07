import { useState, useEffect } from 'react';
import './App.css';
import DiseaseScanner from './components/DiseaseScanner';
import FertilizerCalculator from './components/FertilizerCalculator';
import InsuranceRisk from './components/InsuranceRisk';
import USSDGateway from './components/USSDGateway';
import SoilAnalysis from './components/SoilAnalysis'; // Add this import
import { useSensorData } from './hooks/useSensorData';
import dataService from './services/dataService';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [irrigationStatus, setIrrigationStatus] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState({
    online: navigator.onLine,
    lastSync: null,
    queuedActions: 0
  });
  const [countdown, setCountdown] = useState(30);

  // Use the data service hook
  const { 
    sensorData, 
    loading, 
    offline, 
    controlIrrigation,
    getConnectionStatus,
    refresh,
    getQueueLength
  } = useSensorData(30000);

  // Initialize irrigation status from cache
  useEffect(() => {
    const cachedData = dataService.cache;
    if (cachedData && cachedData.irrigationStatus !== undefined) {
      setIrrigationStatus(cachedData.irrigationStatus);
    }
  }, []);

  // Update connection status
  useEffect(() => {
    const updateStatus = () => {
      const status = getConnectionStatus();
      setConnectionStatus({
        online: !offline,
        lastSync: status.lastSync,
        queuedActions: getQueueLength() || status.queuedActions
      });
    };

    updateStatus();
    const interval = setInterval(updateStatus, 10000);
    return () => clearInterval(interval);
  }, [offline, getConnectionStatus, getQueueLength]);

  // Countdown timer for auto-refresh
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          refresh();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [refresh]);

  const toggleIrrigation = async () => {
    const newStatus = !irrigationStatus;
    const result = await controlIrrigation(newStatus);
    
    if (result.success) {
      setIrrigationStatus(newStatus);
      
      if (result.offline) {
        console.log('Irrigation command queued for sync when online');
        setConnectionStatus(prev => ({
          ...prev,
          queuedActions: getQueueLength()
        }));
      }
    } else {
      console.error('Failed to control irrigation:', result.message);
    }
  };

  const getStatusClass = (status) => {
    if (!status) return '';
    
    const statusLower = status.toLowerCase();
    if (statusLower.includes('optimal') || statusLower.includes('ideal') || statusLower.includes('good')) {
      return 'optimal';
    }
    if (statusLower.includes('low') || statusLower.includes('warning')) {
      return 'low';
    }
    if (statusLower.includes('critical') || statusLower.includes('high') || statusLower.includes('very')) {
      return 'critical';
    }
    return '';
  };

  const getTemperatureWidth = (temp) => {
    const value = temp || 27.3;
    return Math.max(0, Math.min(100, ((value - 10) / 30) * 100));
  };

  const getHumidityWidth = (humidity) => {
    const value = humidity || 31.97;
    return Math.max(0, Math.min(100, value));
  };

  const getSoilMoistureWidth = (moisture) => {
    const value = moisture || 47.75;
    return Math.max(0, Math.min(100, value));
  };

  const getLightWidth = (light) => {
    const value = light || 350;
    return Math.max(0, Math.min(100, (value / 1000) * 100));
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Never';
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Invalid time';
    }
  };

  const handleQuickAction = (action) => {
    switch(action) {
      case 'water':
        if (offline) {
          console.log('Watering action queued for sync');
        } else {
          console.log('Starting 15-minute watering cycle');
        }
        break;
      case 'report':
        console.log('Generating detailed report...');
        break;
      case 'alert':
        console.log('Sending alert to farmer...');
        break;
      default:
        break;
    }
  };

  return (
    <div className="sian-agritech-app">
      <header className="app-header">
        <div className="header-content">
          <div className="logo-section">
            <h1 className="app-title">🌿 SianAgriTech</h1>
            <p className="app-subtitle">Smart Farming, Smarter Harvests</p>
          </div>
          
          <div className={`connection-status ${offline ? 'offline' : 'online'}`}>
            <span className="status-dot"></span>
            {offline ? 'Offline Mode' : 'Online'}
            {connectionStatus.queuedActions > 0 && (
              <span className="queue-badge">{connectionStatus.queuedActions} pending</span>
            )}
          </div>

          <nav className="app-nav">
            <button 
              className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              📊 Dashboard
            </button>
            <button 
              className={`nav-btn ${activeTab === 'disease' ? 'active' : ''}`}
              onClick={() => setActiveTab('disease')}
            >
              🔬 Disease Scanner
            </button>
            <button 
              className={`nav-btn ${activeTab === 'fertilizer' ? 'active' : ''}`}
              onClick={() => setActiveTab('fertilizer')}
            >
              🌱 Fertilizer Calc
            </button>
            <button 
              className={`nav-btn ${activeTab === 'irrigation' ? 'active' : ''}`}
              onClick={() => setActiveTab('irrigation')}
            >
              💧 Irrigation
            </button>
            <button 
              className={`nav-btn ${activeTab === 'market' ? 'active' : ''}`}
              onClick={() => setActiveTab('market')}
            >
              🛒 Marketplace
            </button>
            <button 
              className={`nav-btn ${activeTab === 'insurance' ? 'active' : ''}`}
              onClick={() => setActiveTab('insurance')}
            >
              🛡️ Insurance
            </button>
            <button 
              className={`nav-btn ${activeTab === 'ussd' ? 'active' : ''}`}
              onClick={() => setActiveTab('ussd')}
            >
              📱 USSD/SMS
            </button>
            {/* Add Soil Analysis Tab */}
            <button 
              className={`nav-btn ${activeTab === 'soil' ? 'active' : ''}`}
              onClick={() => setActiveTab('soil')}
            >
              🌱 Soil Analysis
            </button>
          </nav>
        </div>
      </header>

      <main className="app-main">
        {activeTab === 'dashboard' && (
          <div className="dashboard">
            <div className="dashboard-header">
              <h2>🌾 Farm Dashboard - Live Monitoring</h2>
              <div className="dashboard-controls">
                <button 
                  className="refresh-btn" 
                  onClick={refresh} 
                  disabled={loading}
                >
                  {loading ? '🔄 Updating...' : '🔄 Refresh Now'}
                </button>
                {offline && (
                  <span className="offline-alert">
                    ⚠️ Offline - Showing {sensorData?.simulated ? 'simulated' : 'cached'} data
                  </span>
                )}
              </div>
            </div>
            
            {loading && !sensorData ? (
              <div className="loading-indicator">
                <div className="spinner"></div>
                <p>Loading sensor data...</p>
                <p className="loading-detail">Connecting to ThingSpeak...</p>
              </div>
            ) : (
              <>
                <div className="dashboard-grid">
                  <div className="metric-card">
                    <div className="metric-header">
                      <h3>🌡️ Temperature</h3>
                      <span className={`metric-status ${getStatusClass(sensorData?.temperature?.status)}`}>
                        {sensorData?.temperature?.status || 'Optimal'}
                      </span>
                    </div>
                    <p className="metric-value">
                      {sensorData?.temperature?.value?.toFixed(1) || '27.3'}°C
                    </p>
                    <p className="metric-trend">
                      {sensorData?.temperature?.trend || '↗️ +0.5°C'}
                    </p>
                    <p className="metric-source">
                      {sensorData?.temperature?.source || 'ThingSpeak Channel 2987883'}
                    </p>
                    <div className="metric-range">
                      <div className="range-bar">
                        <div className="range-fill" style={{ 
                          width: `${getTemperatureWidth(sensorData?.temperature?.value)}%` 
                        }}></div>
                      </div>
                      <div className="range-labels">
                        <span>10°C</span>
                        <span>Optimal: 20-30°C</span>
                        <span>40°C</span>
                      </div>
                    </div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-header">
                      <h3>💧 Humidity</h3>
                      <span className={`metric-status ${getStatusClass(sensorData?.humidity?.status)}`}>
                        {sensorData?.humidity?.status || 'Low'}
                      </span>
                    </div>
                    <p className="metric-value">
                      {sensorData?.humidity?.value?.toFixed(2) || '31.97'}% RH
                    </p>
                    <p className="metric-trend">
                      {sensorData?.humidity?.trend || '↘️ -2.1%'}
                    </p>
                    <p className="metric-source">
                      {sensorData?.humidity?.source || 'Field Station #1'}
                    </p>
                    <div className="metric-range">
                      <div className="range-bar">
                        <div className="range-fill" style={{ 
                          width: `${getHumidityWidth(sensorData?.humidity?.value)}%` 
                        }}></div>
                      </div>
                      <div className="range-labels">
                        <span>0%</span>
                        <span>Optimal: 40-60%</span>
                        <span>100%</span>
                      </div>
                    </div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-header">
                      <h3>🌱 Soil Moisture</h3>
                      <span className={`metric-status ${getStatusClass(sensorData?.soilMoisture?.status)}`}>
                        {sensorData?.soilMoisture?.status || 'Optimal'}
                      </span>
                    </div>
                    <p className="metric-value">
                      {sensorData?.soilMoisture?.value?.toFixed(2) || '47.75'}%
                    </p>
                    <p className="metric-trend">
                      {sensorData?.soilMoisture?.trend || '→ Stable'}
                    </p>
                    <p className="metric-source">
                      {sensorData?.soilMoisture?.source || 'Sensor Node A-12'}
                    </p>
                    <div className="metric-range">
                      <div className="range-bar">
                        <div className="range-fill" style={{ 
                          width: `${getSoilMoistureWidth(sensorData?.soilMoisture?.value)}%` 
                        }}></div>
                      </div>
                      <div className="range-labels">
                        <span>Dry</span>
                        <span>Optimal</span>
                        <span>Wet</span>
                      </div>
                    </div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-header">
                      <h3>🔆 Light Intensity</h3>
                      <span className={`metric-status ${getStatusClass(sensorData?.lightIntensity?.status)}`}>
                        {sensorData?.lightIntensity?.status || 'Good'}
                      </span>
                    </div>
                    <p className="metric-value">
                      {sensorData?.lightIntensity?.value?.toFixed(0) || '350'} lux
                    </p>
                    <p className="metric-trend">
                      {sensorData?.lightIntensity?.trend || '↗️ +50 lux'}
                    </p>
                    <p className="metric-source">
                      {sensorData?.lightIntensity?.source || 'Photosynthesis Active'}
                    </p>
                    <div className="metric-range">
                      <div className="range-bar">
                        <div className="range-fill" style={{ 
                          width: `${getLightWidth(sensorData?.lightIntensity?.value)}%` 
                        }}></div>
                      </div>
                      <div className="range-labels">
                        <span>0 lux</span>
                        <span>Min: 200 lux</span>
                        <span>1000 lux</span>
                      </div>
                    </div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-header">
                      <h3>🧪 pH Level</h3>
                      <span className="metric-status optimal">Ideal</span>
                    </div>
                    <p className="metric-value">6.8 pH</p>
                    <p className="metric-trend">→ Stable</p>
                    <p className="metric-source">Soil Test Lab</p>
                    <div className="metric-range">
                      <div className="range-bar">
                        <div className="range-fill" style={{ width: '68%' }}></div>
                      </div>
                      <div className="range-labels">
                        <span>Acidic 4.0</span>
                        <span>Ideal 6.0-7.0</span>
                        <span>Alkaline 9.0</span>
                      </div>
                    </div>
                    <div className="ph-recommendation">
                      <p>✅ Soil acidity optimal for most crops</p>
                    </div>
                  </div>

                  <div className="metric-card irrigation-card">
                    <div className="metric-header">
                      <h3>🚿 Irrigation System</h3>
                      <span className={`irrigation-status ${irrigationStatus ? 'on' : 'off'}`}>
                        {irrigationStatus ? 'ACTIVE' : 'INACTIVE'}
                        {offline && connectionStatus.queuedActions > 0 ? ' (Queued)' : ''}
                      </span>
                    </div>
                    
                    <div className="irrigation-control">
                      <div className="irrigation-visual">
                        <div className={`water-drop ${irrigationStatus ? 'active' : ''}`}>
                          💧
                        </div>
                        <div className="irrigation-text">
                          <p className="irrigation-value">
                            {irrigationStatus ? 'ON' : 'OFF'}
                          </p>
                          <p className="irrigation-subtext">
                            {offline ? 'Manual (Offline Mode)' : 'Manual Control'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="irrigation-buttons">
                        <button 
                          className={`control-btn ${irrigationStatus ? 'active' : ''}`}
                          onClick={toggleIrrigation}
                          disabled={loading}
                        >
                          {loading ? '⚡ Processing...' : '⚡ TURN ON'}
                        </button>
                        <button 
                          className="control-btn secondary"
                          onClick={toggleIrrigation}
                          disabled={loading}
                        >
                          ⛔ TURN OFF
                        </button>
                      </div>
                      
                      <div className="irrigation-schedule">
                        <h4>Next Scheduled:</h4>
                        <p>Tomorrow 06:00 AM (Auto)</p>
                        <p className="schedule-detail">
                          Based on soil moisture: {sensorData?.soilMoisture?.value?.toFixed(2) || '47.75'}%
                        </p>
                      </div>
                      
                      <div className="irrigation-stats">
                        <div className="stat">
                          <span className="stat-label">Today's Usage:</span>
                          <span className="stat-value">0 L</span>
                        </div>
                        <div className="stat">
                          <span className="stat-label">This Month:</span>
                          <span className="stat-value">1,250 L</span>
                        </div>
                        <div className="stat">
                          <span className="stat-label">Cost:</span>
                          <span className="stat-value">$3.75</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="quick-actions">
                  <h3>⚡ Quick Actions</h3>
                  <div className="action-buttons">
                    <button 
                      className="action-btn"
                      onClick={() => handleQuickAction('water')}
                    >
                      💧 Water Now (15 mins)
                    </button>
                    <button 
                      className="action-btn"
                      onClick={() => handleQuickAction('report')}
                    >
                      📊 View Detailed Report
                    </button>
                    <button 
                      className="action-btn"
                      onClick={() => handleQuickAction('alert')}
                    >
                      ⚠️ Send Alert to Farmer
                    </button>
                    <button 
                      className="action-btn" 
                      onClick={refresh}
                    >
                      🔄 Sync All Sensors
                    </button>
                  </div>
                </div>

                <div className="update-time">
                  <p>
                    🕒 Last updated: {sensorData?.timestamp ? 
                      formatTime(sensorData.timestamp) : 
                      'Never'} 
                    | Next update in: {countdown} seconds
                    {offline && ' | ⚠️ Offline Mode'}
                    {sensorData?.simulated && ' | 📊 Simulated Data'}
                  </p>
                  {connectionStatus.lastSync && (
                    <p className="sync-info">
                      Last sync: {formatTime(connectionStatus.lastSync)}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'disease' && <DiseaseScanner />}
        {activeTab === 'fertilizer' && <FertilizerCalculator />}
        {activeTab === 'insurance' && <InsuranceRisk />}
        {activeTab === 'ussd' && <USSDGateway />}
        {/* Add Soil Analysis Tab Handler */}
        {activeTab === 'soil' && <SoilAnalysis />}
        
        {activeTab === 'irrigation' && (
          <div className="coming-soon">
            <h2>Smart Irrigation Optimization</h2>
            <p>Coming soon - Weather + soil moisture scheduling</p>
          </div>
        )}
        
        {activeTab === 'market' && (
          <div className="coming-soon">
            <h2>Sian Marketplace</h2>
            <p>Coming soon - Integrated with SianFinTech</p>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>© 2025 Sian Technologies | AgriTech + FinTech Integration</p>
        <p>
          {offline ? '🔴 Offline Mode • ' : '🟢 Online • '}
          Real-time IoT Monitoring • AI-Powered Insights • Sustainable Farming
          {connectionStatus.queuedActions > 0 && ` • ${connectionStatus.queuedActions} actions pending sync`}
        </p>
        <p className="ussd-info">
          📞 For farmers without smartphones: Dial <strong>*384#</strong> or SMS to <strong>384</strong>
        </p>
      </footer>
    </div>
  );
}

export default App;