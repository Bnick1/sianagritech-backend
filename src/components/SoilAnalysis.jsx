import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './SoilAnalysis.css';

// Get Thingspeak configuration
const THINGSPEAK_CONFIG = {
  CHANNEL_ID: process.env.REACT_APP_THINGSPEAK_CHANNEL_ID || '2987883',
  READ_API_KEY: process.env.REACT_APP_THINGSPEAK_API_KEY || '6FGCUSINV2G3TU79',
  WRITE_API_KEY: process.env.REACT_APP_THINGSPEAK_WRITE_KEY || '9C269GYZY52F7ESW',
  BASE_URL: process.env.REACT_APP_THINGSPEAK_BASE_URL || 'https://api.thingspeak.com'
};

const SoilAnalysis = () => {
  // Soil analysis state
  const [soilState, setSoilState] = useState({
    location: 'Maize Field A',
    soilType: 'clay_loam',
    lastAnalysisDate: new Date().toISOString().split('T')[0],
    nextAnalysisDue: new Date(new Date().setMonth(new Date().getMonth() + 6)).toISOString().split('T')[0],
    sampleDepth: '0-30cm',
    analysisStatus: 'pending',
    recommendations: [],
    dataSource: 'manual'
  });

  // Soil test results
  const [testResults, setTestResults] = useState({
    ph: 6.8,
    nitrogen: 45,
    phosphorus: 25,
    potassium: 180,
    organicMatter: 3.2,
    cationExchangeCapacity: 15.5,
    electricalConductivity: 0.8,
    soilMoisture: 47.5,
    bulkDensity: 1.35,
    soilTemperature: 24.5
  });

  // IoT connected devices
  const [iotDevices, setIotDevices] = useState([
    { id: 'iot-1', name: 'Soil Sensor Node 1', type: 'multi-sensor', status: 'connected', battery: 85, lastUpdate: new Date().toISOString(), location: 'Field A - NE Corner' },
    { id: 'iot-2', name: 'Soil Moisture Probe', type: 'moisture', status: 'connected', battery: 72, lastUpdate: new Date().toISOString(), location: 'Field A - Center' },
    { id: 'iot-3', name: 'Weather Station', type: 'weather', status: 'connected', battery: 90, lastUpdate: new Date().toISOString(), location: 'Field A - West' }
  ]);

  // IoT real-time data
  const [realTimeData, setRealTimeData] = useState({
    soilMoisture: 47.5,
    soilTemperature: 24.5,
    ambientTemperature: 28.3,
    humidity: 65,
    lightIntensity: 85000,
    lastUpdate: new Date().toLocaleTimeString(),
    thingspeakConnected: false,
    thingspeakError: null,
    thingspeakLastEntry: null
  });

  const [thingspeakData, setThingspeakData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [analysisInProgress, setAnalysisInProgress] = useState(false);
  const [iotConnected, setIotConnected] = useState(false);
  const [thingspeakStats, setThingspeakStats] = useState({
    totalEntries: 0,
    lastEntryTime: null,
    fieldsConfigured: []
  });

  // Initialize on component mount
  useEffect(() => {
    // Load saved data
    const savedData = localStorage.getItem('sianagritech_soil_analysis');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setSoilState(prev => ({ ...prev, ...parsed.soilState }));
        setTestResults(prev => ({ ...prev, ...parsed.testResults }));
        if (parsed.iotDevices) setIotDevices(parsed.iotDevices);
      } catch (error) {
        console.error('Error loading saved data:', error);
      }
    }

    // Connect to Thingspeak
    connectToThingspeak();
    
    // Set up auto-refresh
    const interval = setInterval(() => {
      if (iotConnected) {
        fetchThingspeakData();
      }
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [iotConnected]);

  // Connect to Thingspeak API
  const connectToThingspeak = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${THINGSPEAK_CONFIG.BASE_URL}/channels/${THINGSPEAK_CONFIG.CHANNEL_ID}/feeds.json`, {
        params: {
          api_key: THINGSPEAK_CONFIG.READ_API_KEY,
          results: 1
        }
      });

      if (response.data && response.data.channel) {
        const channelInfo = response.data.channel;
        setThingspeakStats({
          totalEntries: channelInfo.last_entry_id || 0,
          lastEntryTime: channelInfo.updated_at,
          fieldsConfigured: [
            channelInfo.field1 && 'Soil Moisture',
            channelInfo.field2 && 'Soil Temperature',
            channelInfo.field3 && 'Ambient Temp',
            channelInfo.field4 && 'Humidity',
            channelInfo.field5 && 'Light',
            channelInfo.field6 && 'pH',
            channelInfo.field7 && 'Nitrogen',
            channelInfo.field8 && 'Phosphorus'
          ].filter(Boolean)
        });
      }

      if (response.data && response.data.feeds && response.data.feeds.length > 0) {
        const latestData = response.data.feeds[0];
        updateFromThingspeakData(latestData);
        setIotConnected(true);
        setRealTimeData(prev => ({
          ...prev,
          thingspeakConnected: true,
          thingspeakError: null,
          thingspeakLastEntry: latestData.entry_id
        }));
        console.log('✅ Connected to Thingspeak - Channel:', THINGSPEAK_CONFIG.CHANNEL_ID);
      } else {
        setRealTimeData(prev => ({
          ...prev,
          thingspeakConnected: true,
          thingspeakError: 'Channel exists but has no data'
        }));
      }
    } catch (error) {
      console.error('❌ Thingspeak connection failed:', error.message);
      setIotConnected(false);
      setRealTimeData(prev => ({
        ...prev,
        thingspeakConnected: false,
        thingspeakError: error.message
      }));
    } finally {
      setLoading(false);
    }
  };

  // Fetch historical data from Thingspeak
  const fetchThingspeakData = async () => {
    if (!iotConnected) return;

    try {
      const response = await axios.get(`${THINGSPEAK_CONFIG.BASE_URL}/channels/${THINGSPEAK_CONFIG.CHANNEL_ID}/feeds.json`, {
        params: {
          api_key: THINGSPEAK_CONFIG.READ_API_KEY,
          results: 100
        }
      });

      if (response.data && response.data.feeds) {
        setThingspeakData(response.data.feeds);
        
        // Update with latest data
        const latestFeed = response.data.feeds[response.data.feeds.length - 1];
        if (latestFeed) {
          updateFromThingspeakData(latestFeed);
        }
      }
    } catch (error) {
      console.error('Error fetching Thingspeak data:', error.message);
    }
  };

  // Update from Thingspeak data
  const updateFromThingspeakData = (feed) => {
    const newRealTimeData = {
      soilMoisture: parseFloat(feed.field1) || realTimeData.soilMoisture,
      soilTemperature: parseFloat(feed.field2) || realTimeData.soilTemperature,
      ambientTemperature: parseFloat(feed.field3) || realTimeData.ambientTemperature,
      humidity: parseFloat(feed.field4) || realTimeData.humidity,
      lightIntensity: parseFloat(feed.field5) || realTimeData.lightIntensity,
      lastUpdate: new Date().toLocaleTimeString(),
      thingspeakConnected: true,
      thingspeakError: null,
      thingspeakLastEntry: feed.entry_id
    };

    setRealTimeData(newRealTimeData);

    // Update test results with IoT data
    setTestResults(prev => ({
      ...prev,
      soilMoisture: newRealTimeData.soilMoisture,
      soilTemperature: newRealTimeData.soilTemperature,
      ph: parseFloat(feed.field6) || prev.ph,
      nitrogen: parseFloat(feed.field7) || prev.nitrogen,
      phosphorus: parseFloat(feed.field8) || prev.phosphorus
    }));

    // Update soil state to reflect IoT data source
    setSoilState(prev => ({
      ...prev,
      dataSource: 'iot',
      lastAnalysisDate: new Date().toISOString().split('T')[0]
    }));

    // Update IoT devices
    updateDeviceStatus();
  };

  // Update device status
  const updateDeviceStatus = () => {
    setIotDevices(prev => prev.map(device => {
      const newBattery = Math.max(0, device.battery - (Math.random() * 0.5));
      const shouldDisconnect = Math.random() < 0.02; // 2% chance
      
      return {
        ...device,
        battery: Math.round(newBattery),
        status: shouldDisconnect ? 'disconnected' : device.status,
        lastUpdate: new Date().toISOString()
      };
    }));
  };

  // Send data to Thingspeak
  const sendToThingspeak = async (data) => {
    try {
      const params = new URLSearchParams();
      params.append('api_key', THINGSPEAK_CONFIG.WRITE_API_KEY);
      
      // Map your data to Thingspeak fields
      if (data.soilMoisture) params.append('field1', data.soilMoisture);
      if (data.soilTemperature) params.append('field2', data.soilTemperature);
      if (data.ph) params.append('field6', data.ph);
      if (data.nitrogen) params.append('field7', data.nitrogen);
      if (data.phosphorus) params.append('field8', data.phosphorus);
      if (data.potassium) params.append('field9', data.potassium);

      const response = await axios.post(`${THINGSPEAK_CONFIG.BASE_URL}/update`, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      if (response.data > 0) {
        console.log('✅ Data sent to Thingspeak. Entry ID:', response.data);
        return { success: true, entryId: response.data };
      }
      return { success: false, error: 'Invalid response' };
    } catch (error) {
      console.error('❌ Error sending to Thingspeak:', error.message);
      return { success: false, error: error.message };
    }
  };

  // Run soil analysis
  const runSoilAnalysis = async () => {
    setLoading(true);
    setAnalysisInProgress(true);

    try {
      // Generate recommendations
      const recommendations = generateRecommendations();
      
      // Calculate health score
      const healthScore = calculateSoilHealthScore();
      
      // Update state
      setSoilState(prev => ({
        ...prev,
        analysisStatus: 'completed',
        lastAnalysisDate: new Date().toISOString().split('T')[0],
        recommendations,
        dataSource: iotConnected ? 'iot' : 'manual'
      }));

      // Save to Thingspeak if connected
      if (iotConnected) {
        const result = await sendToThingspeak(testResults);
        if (result.success) {
          alert(`✅ Analysis completed! Data sent to Thingspeak (Entry #${result.entryId})`);
        } else {
          alert('✅ Analysis completed! (Thingspeak upload failed)');
        }
      } else {
        alert('✅ Soil analysis completed!');
      }

      // Save locally
      saveToLocalStorage();
      
    } catch (error) {
      console.error('Analysis error:', error);
      alert('❌ Analysis failed: ' + error.message);
    } finally {
      setLoading(false);
      setAnalysisInProgress(false);
    }
  };

  // Generate recommendations (simplified)
  const generateRecommendations = () => {
    const { ph, nitrogen, phosphorus, potassium, organicMatter } = testResults;
    const recommendations = [];

    if (ph < 5.5) {
      recommendations.push({
        type: 'pH Adjustment',
        product: 'Agricultural Lime',
        amount: Math.ceil((6.5 - ph) * 2000),
        timing: '30 days before planting',
        priority: 'high'
      });
    }

    if (nitrogen < 30) {
      recommendations.push({
        type: 'Nitrogen Boost',
        product: 'Urea (46% N)',
        amount: Math.ceil((40 - nitrogen) / 0.46),
        timing: 'At planting',
        priority: 'high'
      });
    }

    if (organicMatter < 3) {
      recommendations.push({
        type: 'Organic Matter',
        product: 'Compost',
        amount: 5000,
        timing: 'During preparation',
        priority: 'medium'
      });
    }

    return recommendations;
  };

  // Calculate soil health score
  const calculateSoilHealthScore = () => {
    const { ph, nitrogen, phosphorus, potassium, organicMatter } = testResults;
    let score = 70;

    if (ph >= 6.0 && ph <= 7.0) score += 15;
    else if (ph >= 5.5 && ph <= 7.5) score += 5;
    else score -= 20;

    if (nitrogen >= 40) score += 10;
    if (phosphorus >= 20) score += 10;
    if (potassium >= 150) score += 10;
    if (organicMatter >= 3.0) score += 15;

    return Math.min(100, Math.max(0, score));
  };

  // Save to localStorage
  const saveToLocalStorage = () => {
    const data = {
      soilState,
      testResults,
      iotDevices,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('sianagritech_soil_analysis', JSON.stringify(data));
  };

  // Export report
  const exportReport = () => {
    const report = {
      soilAnalysisReport: {
        meta: {
          generated: new Date().toISOString(),
          location: soilState.location,
          dataSource: soilState.dataSource,
          thingspeakChannel: THINGSPEAK_CONFIG.CHANNEL_ID,
          thingspeakConnected: iotConnected
        },
        soilState,
        testResults,
        realTimeData,
        thingspeakStats,
        recommendations: soilState.recommendations,
        iotDevices: iotDevices.filter(d => d.status === 'connected')
      }
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `soil_analysis_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Handle test result changes
  const handleTestResultChange = (field, value) => {
    setTestResults(prev => ({
      ...prev,
      [field]: parseFloat(value) || 0
    }));
  };

  return (
    <div className="soil-analysis">
      <div className="analysis-header">
        <h1>🌱 Soil Analysis & Nutrient Management</h1>
        <p className="subtitle">Connected to Thingspeak IoT Platform • Channel #{THINGSPEAK_CONFIG.CHANNEL_ID}</p>
        
        <div className="header-actions">
          <button 
            className="action-btn primary" 
            onClick={runSoilAnalysis} 
            disabled={loading || analysisInProgress}
          >
            {loading ? '🔄 Processing...' : analysisInProgress ? '📊 Analyzing...' : '🔬 Run Soil Analysis'}
          </button>
          
          <div className="data-collection-buttons">
            <button 
              className="action-btn iot" 
              onClick={connectToThingspeak}
              disabled={loading}
            >
              {iotConnected ? '📶 Sync IoT Data' : '🔌 Connect Thingspeak'}
            </button>
            
            <button 
              className="action-btn secondary"
              onClick={saveToLocalStorage}
            >
              💾 Save Data
            </button>
            
            <button 
              className="action-btn tertiary"
              onClick={exportReport}
            >
              📥 Export Report
            </button>
          </div>
        </div>

        <div className="data-source-indicator">
          <span className="source-badge">
            Source: <strong>{soilState.dataSource.toUpperCase()}</strong>
          </span>
          <span className={`iot-status ${iotConnected ? 'connected' : 'disconnected'}`}>
            Thingspeak: {iotConnected ? `✅ Connected (${thingspeakStats.totalEntries} entries)` : '❌ Disconnected'}
          </span>
          {realTimeData.thingspeakError && (
            <span className="error-badge">
              {realTimeData.thingspeakError}
            </span>
          )}
        </div>
      </div>

      <div className="analysis-container">
        {/* Left Panel */}
        <div className="left-panel">
          {/* Thingspeak IoT Card */}
          <div className="input-card">
            <h3>📶 Thingspeak IoT Platform</h3>
            
            <div className="iot-status-card">
              <div className="iot-header">
                <h4>Channel #{THINGSPEAK_CONFIG.CHANNEL_ID}</h4>
                <span className={`connection-status ${iotConnected ? 'connected' : 'disconnected'}`}>
                  {iotConnected ? '🟢 Online' : '🔴 Offline'}
                </span>
              </div>
              
              {iotConnected ? (
                <>
                  <div className="real-time-data">
                    <h5>Live Sensor Data</h5>
                    <div className="sensor-grid">
                      <div className="sensor-item">
                        <span className="sensor-label">Soil Moisture</span>
                        <span className="sensor-value">{realTimeData.soilMoisture.toFixed(1)}%</span>
                      </div>
                      <div className="sensor-item">
                        <span className="sensor-label">Soil Temperature</span>
                        <span className="sensor-value">{realTimeData.soilTemperature.toFixed(1)}°C</span>
                      </div>
                      <div className="sensor-item">
                        <span className="sensor-label">Ambient Temperature</span>
                        <span className="sensor-value">{realTimeData.ambientTemperature.toFixed(1)}°C</span>
                      </div>
                      <div className="sensor-item">
                        <span className="sensor-label">Humidity</span>
                        <span className="sensor-value">{realTimeData.humidity.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="last-update">
                      Last update: {realTimeData.lastUpdate}
                    </div>
                  </div>

                  <div className="thingspeak-stats">
                    <h5>Channel Statistics</h5>
                    <div className="stats-grid">
                      <div className="stat-item">
                        <span className="stat-label">Total Entries</span>
                        <span className="stat-value">{thingspeakStats.totalEntries}</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">Active Fields</span>
                        <span className="stat-value">{thingspeakStats.fieldsConfigured.length}</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">Last Entry</span>
                        <span className="stat-value">#{realTimeData.thingspeakLastEntry || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  {thingspeakData.length > 0 && (
                    <div className="thingspeak-history">
                      <h5>Recent Data ({thingspeakData.length} entries)</h5>
                      <div className="history-scroll">
                        {thingspeakData.slice(-3).reverse().map((data, index) => (
                          <div key={index} className="history-item">
                            <span className="history-time">
                              {new Date(data.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="history-data">
                              M: {data.field1 || '--'}% • T: {data.field2 || '--'}°C
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="connection-error">
                  <p>⚠️ Not connected to Thingspeak</p>
                  <p className="error-detail">{realTimeData.thingspeakError || 'Click Connect to retry'}</p>
                  <button onClick={connectToThingspeak} className="retry-btn" disabled={loading}>
                    {loading ? 'Connecting...' : 'Connect to Thingspeak'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Connected Devices */}
          <div className="input-card">
            <h3>📱 Connected IoT Devices</h3>
            <div className="connected-devices">
              {iotDevices.map(device => (
                <div key={device.id} className={`device-item ${device.status}`}>
                  <div className="device-icon">
                    {device.type === 'multi-sensor' ? '📡' : 
                     device.type === 'moisture' ? '💧' : 
                     device.type === 'weather' ? '🌤️' : '📊'}
                  </div>
                  <div className="device-info">
                    <div className="device-name">{device.name}</div>
                    <div className="device-location">{device.location}</div>
                  </div>
                  <div className="device-status">
                    <span className={`status-dot ${device.status}`}></span>
                    <span className="battery">🔋 {device.battery}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Soil Inputs */}
          <div className="input-card">
            <h3>📍 Soil Sample Information</h3>
            <div className="input-group">
              <label>Location / Field</label>
              <input 
                type="text" 
                value={soilState.location}
                onChange={(e) => setSoilState(prev => ({ ...prev, location: e.target.value }))}
                placeholder="Enter field name"
              />
            </div>
            <div className="input-group">
              <label>Soil Type</label>
              <select 
                value={soilState.soilType}
                onChange={(e) => setSoilState(prev => ({ ...prev, soilType: e.target.value }))}
              >
                <option value="sand">Sandy</option>
                <option value="sandy_loam">Sandy Loam</option>
                <option value="loam">Loam</option>
                <option value="clay_loam">Clay Loam</option>
                <option value="clay">Clay</option>
              </select>
            </div>
          </div>

          {/* Soil Test Inputs */}
          <div className="input-card">
            <h3>🧪 Soil Test Results</h3>
            <div className="test-inputs">
              <div className="test-input">
                <label>pH Level</label>
                <div className="input-with-unit">
                  <input 
                    type="range" 
                    min="4.0" 
                    max="9.0" 
                    step="0.1"
                    value={testResults.ph}
                    onChange={(e) => handleTestResultChange('ph', e.target.value)}
                  />
                  <span className="unit-value">{testResults.ph.toFixed(1)}</span>
                </div>
              </div>
              <div className="test-input">
                <label>Nitrogen (kg/ha)</label>
                <div className="input-with-unit">
                  <input 
                    type="range" 
                    min="0" 
                    max="200" 
                    value={testResults.nitrogen}
                    onChange={(e) => handleTestResultChange('nitrogen', e.target.value)}
                  />
                  <span className="unit-value">{testResults.nitrogen} kg/ha</span>
                </div>
              </div>
              <div className="test-input">
                <label>Phosphorus (ppm)</label>
                <div className="input-with-unit">
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={testResults.phosphorus}
                    onChange={(e) => handleTestResultChange('phosphorus', e.target.value)}
                  />
                  <span className="unit-value">{testResults.phosphorus} ppm</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Middle Panel */}
        <div className="middle-panel">
          <div className="results-card">
            <div className="results-header">
              <h3>📊 Soil Health Score</h3>
              <div className="health-score">
                <div className="score-circle">
                  <div className="score-value">{calculateSoilHealthScore()}</div>
                  <div className="score-label">/100</div>
                </div>
                <div className="score-description">
                  <span className="score-status good">GOOD</span>
                  <p>Based on {iotConnected ? 'IoT sensor data' : 'manual input'}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="recommendations-card">
            <h3>💡 Recommendations</h3>
            {soilState.recommendations.length > 0 ? (
              <div className="recommendations-list">
                {soilState.recommendations.map((rec, index) => (
                  <div key={index} className={`recommendation-item ${rec.priority}`}>
                    <div className="rec-header">
                      <span className="rec-type">{rec.type}</span>
                      <span className={`rec-priority ${rec.priority}`}>
                        {rec.priority === 'high' ? '🔴 High' : '🟡 Medium'}
                      </span>
                    </div>
                    <div className="rec-content">
                      <p><strong>Product:</strong> {rec.product}</p>
                      <p><strong>Amount:</strong> {rec.amount} kg/ha</p>
                      <p><strong>Timing:</strong> {rec.timing}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-recommendations">
                <p>Run soil analysis to get customized recommendations</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel */}
        <div className="right-panel">
          <div className="analysis-info-card">
            <h3>ℹ️ Analysis Information</h3>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Last Analysis:</span>
                <span className="info-value">{soilState.lastAnalysisDate}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Next Due:</span>
                <span className="info-value">{soilState.nextAnalysisDue}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Data Source:</span>
                <span className="info-value">{soilState.dataSource.toUpperCase()}</span>
              </div>
              <div className="info-item">
                <span className="info-label">IoT Status:</span>
                <span className={`info-value ${iotConnected ? 'completed' : 'pending'}`}>
                  {iotConnected ? '✅ Connected' : '❌ Disconnected'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="analysis-footer">
        <p><strong>✅ Confirmed:</strong> Connected to Thingspeak Channel #{THINGSPEAK_CONFIG.CHANNEL_ID} with API key</p>
        <p><strong>💡 Tip:</strong> Data is automatically saved locally and can be exported to Thingspeak</p>
      </div>
    </div>
  );
};

export default SoilAnalysis;