import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './SoilAnalysis.css';

// Get Thingspeak configuration
const THINGSPEAK_CONFIG = {
  CHANNEL_ID: '2987883',
  READ_API_KEY: '6FGCUSINV2G3TU79',
  WRITE_API_KEY: '9C269GYZY52F7ESW',
  BASE_URL: 'https://api.thingspeak.com'
};

// Backend API URL
const BACKEND_API = 'http://localhost:3003';

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
    dataSource: 'manual',
    gpsCoordinates: { lat: -1.286389, lng: 36.817223 } // Nairobi coordinates
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
    { id: 'iot-3', name: 'Weather Station', type: 'weather', status: 'connected', battery: 90, lastUpdate: new Date().toISOString(), location: 'Field A - West' },
    { id: 'iot-4', name: 'AI Camera Trap', type: 'camera', status: 'connected', battery: 68, lastUpdate: new Date().toISOString(), location: 'Field Perimeter' }
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

  // Camera & Image Analysis State
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [imageAnalysis, setImageAnalysis] = useState({
    analyzing: false,
    results: null,
    error: null
  });
  const [uploadedImages, setUploadedImages] = useState([]);
  
  // Satellite Imagery State
  const [satelliteData, setSatelliteData] = useState({
    loading: false,
    available: false,
    lastUpdate: null,
    ndvi: 0.65, // Normalized Difference Vegetation Index
    evi: 0.72, // Enhanced Vegetation Index
    soilMoistureIndex: 0.58,
    cloudCover: 15,
    source: 'Sentinel-2'
  });

  // Edge Computing State
  const [edgeProcessing, setEdgeProcessing] = useState({
    enabled: true,
    localModel: 'SoilNet-Mobile',
    processingTime: 'Offline',
    accuracy: '92%',
    lastSync: new Date().toLocaleTimeString()
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

  // Refs for camera
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

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
        if (parsed.uploadedImages) setUploadedImages(parsed.uploadedImages);
      } catch (error) {
        console.error('Error loading saved data:', error);
      }
    }

    // Connect to Thingspeak
    connectToThingspeak();
    
    // Fetch satellite data
    fetchSatelliteData();
    
    // Set up auto-refresh
    const interval = setInterval(() => {
      if (iotConnected) {
        fetchThingspeakData();
      }
      // Refresh satellite data every 5 minutes
      if (Date.now() - new Date(satelliteData.lastUpdate).getTime() > 300000) {
        fetchSatelliteData();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [iotConnected]);

  // Camera Functions
  const startCamera = async () => {
    setCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } // Use back camera
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Camera error:', error);
      alert('Camera access denied. Please enable camera permissions.');
      setCameraActive(false);
    }
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const imageData = canvas.toDataURL('image/jpeg');
      setCapturedImage(imageData);
      
      // Stop camera
      const stream = video.srcObject;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      setCameraActive(false);
      
      // Start AI analysis
      analyzeImageWithAI(imageData);
    }
  };

  const closeCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject;
      stream.getTracks().forEach(track => track.stop());
    }
    setCameraActive(false);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageData = event.target.result;
        setUploadedImages(prev => [...prev, {
          id: Date.now(),
          data: imageData,
          timestamp: new Date().toISOString(),
          analyzed: false
        }]);
        
        // Analyze the uploaded image
        analyzeImageWithAI(imageData);
      };
      reader.readAsDataURL(file);
    }
  };

  // AI Image Analysis
  const analyzeImageWithAI = async (imageData) => {
    setImageAnalysis({ analyzing: true, results: null, error: null });
    
    try {
      // Edge Computing: First try local model
      if (edgeProcessing.enabled) {
        // Simulate edge processing
        setTimeout(() => {
          const mockResults = {
            soilColor: '#8B4513',
            texture: 'Clay Loam',
            organicMatter: 3.2,
            moistureLevel: 'Optimal',
            compaction: 'Low',
            confidence: 87
          };
          
          setImageAnalysis({
            analyzing: false,
            results: mockResults,
            error: null
          });
          
          // Update soil analysis based on image
          updateFromImageAnalysis(mockResults);
          
        }, 2000);
      }
      
      // For production: Send to backend AI service
      // const response = await axios.post(`${BACKEND_API}/api/ai/analyze-soil-image`, {
      //   image: imageData.split(',')[1], // Remove data URL prefix
      //   location: soilState.location,
      //   coordinates: soilState.gpsCoordinates
      // });
      
    } catch (error) {
      console.error('AI analysis error:', error);
      setImageAnalysis({
        analyzing: false,
        results: null,
        error: 'AI analysis failed. Using edge processing only.'
      });
    }
  };

  const updateFromImageAnalysis = (results) => {
    // Update test results based on image analysis
    setTestResults(prev => ({
      ...prev,
      organicMatter: results.organicMatter || prev.organicMatter,
      soilMoisture: results.moistureLevel === 'Optimal' ? 50 : 
                   results.moistureLevel === 'Dry' ? 30 : 70
    }));
    
    // Update soil type if detected
    if (results.texture && results.texture !== 'Unknown') {
      const textureMap = {
        'Clay': 'clay',
        'Clay Loam': 'clay_loam',
        'Loam': 'loam',
        'Sandy Loam': 'sandy_loam',
        'Sandy': 'sand'
      };
      
      setSoilState(prev => ({
        ...prev,
        soilType: textureMap[results.texture] || prev.soilType,
        dataSource: 'ai_camera'
      }));
    }
  };

  // Satellite Imagery Functions
  const fetchSatelliteData = async () => {
    setSatelliteData(prev => ({ ...prev, loading: true }));
    
    try {
      // For demo - simulate satellite data
      setTimeout(() => {
        setSatelliteData({
          loading: false,
          available: true,
          lastUpdate: new Date().toISOString(),
          ndvi: 0.65 + (Math.random() * 0.1 - 0.05),
          evi: 0.72 + (Math.random() * 0.1 - 0.05),
          soilMoistureIndex: 0.58 + (Math.random() * 0.1 - 0.05),
          cloudCover: Math.floor(Math.random() * 30),
          source: 'Sentinel-2'
        });
      }, 1500);
      
      // For production: Call your backend satellite service
      // const response = await axios.get(`${BACKEND_API}/api/satellite/imagery`, {
      //   params: {
      //     lat: soilState.gpsCoordinates.lat,
      //     lng: soilState.gpsCoordinates.lng,
      //     date: new Date().toISOString().split('T')[0]
      //   }
      // });
      
    } catch (error) {
      console.error('Satellite data error:', error);
      setSatelliteData(prev => ({ 
        ...prev, 
        loading: false,
        available: false 
      }));
    }
  };

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
        dataSource: iotConnected ? 'iot' : (imageAnalysis.results ? 'ai_camera' : 'manual')
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
      uploadedImages,
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
          thingspeakConnected: iotConnected,
          aiUsed: !!imageAnalysis.results,
          satelliteUsed: satelliteData.available,
          edgeProcessing: edgeProcessing.enabled
        },
        soilState,
        testResults,
        realTimeData,
        satelliteData,
        imageAnalysis,
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

  // Get satellite health color
  const getSatelliteHealthColor = (value) => {
    if (value >= 0.7) return '#4CAF50'; // Good
    if (value >= 0.5) return '#FF9800'; // Moderate
    return '#F44336'; // Poor
  };

  return (
    <div className="soil-analysis">
      <div className="analysis-header">
        <h1>🌱 AI Soil Analysis & Nutrient Management</h1>
        <p className="subtitle">IoT + AI + Satellite • Edge Computing • Offline Capable • Farmer-First Design</p>
        
        <div className="header-actions">
          <button 
            className="action-btn primary" 
            onClick={runSoilAnalysis} 
            disabled={loading || analysisInProgress}
          >
            {loading ? '🔄 Processing...' : analysisInProgress ? '📊 Analyzing...' : '🤖 AI Soil Analysis'}
          </button>
          
          <div className="data-collection-buttons">
            <button 
              className="action-btn camera"
              onClick={startCamera}
            >
              📸 Take Soil Photo
            </button>
            
            <label className="action-btn upload">
              📁 Upload Image
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                style={{ display: 'none' }}
              />
            </label>
            
            <button 
              className="action-btn iot" 
              onClick={connectToThingspeak}
              disabled={loading}
            >
              {iotConnected ? '📶 Sync IoT Data' : '🔌 Connect Thingspeak'}
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
            Thingspeak: {iotConnected ? `✅ Connected` : '❌ Offline'}
          </span>
          <span className="edge-badge">
            Edge AI: {edgeProcessing.enabled ? '✅ Active' : '❌ Inactive'}
          </span>
          <span className="satellite-badge">
            Satellite: {satelliteData.available ? '✅ Live' : '🔄 Loading'}
          </span>
        </div>
      </div>

      <div className="analysis-container">
        {/* Left Panel */}
        <div className="left-panel">
          {/* Camera & Image Analysis Card */}
          <div className="input-card">
            <h3>📸 AI Soil Photo Analysis</h3>
            
            <div className="camera-controls">
              <button 
                className="action-btn camera"
                onClick={startCamera}
              >
                📸 Open Camera
              </button>
              
              <label className="action-btn upload">
                📁 Upload Photo
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
            
            {capturedImage && (
              <div className="image-preview">
                <img src={capturedImage} alt="Captured soil" />
              </div>
            )}
            
            {imageAnalysis.analyzing ? (
              <div className="analyzing-status">
                <p>🔍 Analyzing soil image with AI...</p>
                <p>Edge Processing: {edgeProcessing.processingTime}</p>
              </div>
            ) : imageAnalysis.results ? (
              <div className="analysis-results">
                <h5>AI Analysis Results</h5>
                <div className="result-item">
                  <span>Soil Color:</span>
                  <div className="color-swatch" style={{ backgroundColor: imageAnalysis.results.soilColor }}></div>
                  <span>{imageAnalysis.results.soilColor}</span>
                </div>
                <div className="result-item">
                  <span>Texture:</span>
                  <span><strong>{imageAnalysis.results.texture}</strong></span>
                </div>
                <div className="result-item">
                  <span>Organic Matter:</span>
                  <span>{imageAnalysis.results.organicMatter}%</span>
                </div>
                <div className="result-item">
                  <span>Confidence:</span>
                  <span>{imageAnalysis.results.confidence}%</span>
                </div>
              </div>
            ) : uploadedImages.length > 0 ? (
              <div className="uploaded-images">
                <h5>Uploaded Images ({uploadedImages.length})</h5>
                <div className="image-thumbnails">
                  {uploadedImages.slice(-3).map(img => (
                    <div key={img.id} className="image-thumb">
                      <img src={img.data} alt="Soil sample" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="no-images">
                <p>Take or upload a soil photo for AI analysis</p>
              </div>
            )}
          </div>

          {/* Satellite Imagery Card */}
          <div className="input-card">
            <h3>🛰️ Satellite Vegetation Index</h3>
            
            {satelliteData.loading ? (
              <div className="satellite-loading">
                <p>🛰️ Loading satellite data...</p>
              </div>
            ) : satelliteData.available ? (
              <div className="satellite-data">
                <div className="satellite-source">
                  <span>Source: <strong>{satelliteData.source}</strong></span>
                  <span>Cloud: {satelliteData.cloudCover}%</span>
                </div>
                
                <div className="satellite-indicators">
                  <div className="satellite-item">
                    <div className="satellite-header">
                      <span className="satellite-label">NDVI</span>
                      <span className="satellite-value" style={{ color: getSatelliteHealthColor(satelliteData.ndvi) }}>
                        {satelliteData.ndvi.toFixed(2)}
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ 
                          width: `${satelliteData.ndvi * 100}%`,
                          backgroundColor: getSatelliteHealthColor(satelliteData.ndvi)
                        }}
                      ></div>
                    </div>
                    <div className="satellite-info">
                      <span>Poor</span>
                      <span>Optimal</span>
                      <span>Excellent</span>
                    </div>
                  </div>
                  
                  <div className="satellite-item">
                    <div className="satellite-header">
                      <span className="satellite-label">Soil Moisture Index</span>
                      <span className="satellite-value" style={{ color: getSatelliteHealthColor(satelliteData.soilMoistureIndex) }}>
                        {satelliteData.soilMoistureIndex.toFixed(2)}
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ 
                          width: `${satelliteData.soilMoistureIndex * 100}%`,
                          backgroundColor: getSatelliteHealthColor(satelliteData.soilMoistureIndex)
                        }}
                      ></div>
                    </div>
                    <div className="satellite-info">
                      <span>Dry</span>
                      <span>Optimal</span>
                      <span>Wet</span>
                    </div>
                  </div>
                </div>
                
                <div className="satellite-update">
                  <span>Last update: {new Date(satelliteData.lastUpdate).toLocaleTimeString()}</span>
                  <button onClick={fetchSatelliteData} className="refresh-btn">
                    🔄 Refresh
                  </button>
                </div>
              </div>
            ) : (
              <div className="satellite-unavailable">
                <p>⚠️ Satellite data unavailable</p>
                <button onClick={fetchSatelliteData} className="retry-btn">
                  Retry Connection
                </button>
              </div>
            )}
          </div>

          {/* Edge Computing Card */}
          <div className="input-card">
            <h3>⚡ Edge AI Processing</h3>
            
            <div className="edge-status">
              <div className="edge-header">
                <span className="edge-label">Status:</span>
                <span className={`edge-value ${edgeProcessing.enabled ? 'enabled' : 'disabled'}`}>
                  {edgeProcessing.enabled ? '✅ Active' : '❌ Inactive'}
                </span>
              </div>
              
              <div className="edge-info">
                <div className="info-item">
                  <span className="info-label">Model:</span>
                  <span className="info-value">{edgeProcessing.localModel}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Accuracy:</span>
                  <span className="info-value">{edgeProcessing.accuracy}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Last Sync:</span>
                  <span className="info-value">{edgeProcessing.lastSync}</span>
                </div>
              </div>
              
              <div className="edge-benefits">
                <p><strong>✅ Works Offline</strong> - No internet needed</p>
                <p><strong>⚡ Fast Processing</strong> - Local analysis</p>
                <p><strong>🔒 Privacy</strong> - Data stays on device</p>
              </div>
              
              <div className="edge-toggle">
                <label className="toggle-switch">
                  <input 
                    type="checkbox" 
                    checked={edgeProcessing.enabled}
                    onChange={(e) => setEdgeProcessing(prev => ({ ...prev, enabled: e.target.checked }))}
                  />
                  <span className="toggle-slider"></span>
                </label>
                <span className="toggle-label">
                  {edgeProcessing.enabled ? 'Edge AI Enabled' : 'Edge AI Disabled'}
                </span>
              </div>
            </div>
          </div>

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
                     device.type === 'weather' ? '🌤️' :
                     device.type === 'camera' ? '📸' : '📊'}
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
                  <p>Powered by AI + IoT + Satellite</p>
                </div>
              </div>
            </div>
          </div>

          <div className="recommendations-card">
            <h3>💡 AI-Powered Recommendations</h3>
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
                <p>Run AI soil analysis to get customized recommendations</p>
                <p><small>Uses camera, satellite, and sensor data</small></p>
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
                <span className="info-label">AI Used:</span>
                <span className={`info-value ${imageAnalysis.results ? 'completed' : 'pending'}`}>
                  {imageAnalysis.results ? '✅ Yes' : '❌ No'}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Satellite Used:</span>
                <span className={`info-value ${satelliteData.available ? 'completed' : 'pending'}`}>
                  {satelliteData.available ? '✅ Yes' : '❌ No'}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Edge AI:</span>
                <span className={`info-value ${edgeProcessing.enabled ? 'completed' : 'pending'}`}>
                  {edgeProcessing.enabled ? '✅ Active' : '❌ Inactive'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Camera Modal */}
      {cameraActive && (
        <div className="camera-modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3>📸 Take Soil Photo</h3>
              <button className="close-btn" onClick={closeCamera}>×</button>
            </div>
            <div className="camera-view">
              <video ref={videoRef} autoPlay className="camera-feed"></video>
              <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
            </div>
            <div className="camera-controls">
              <button className="capture-btn" onClick={captureImage}>
                📸 Capture Photo
              </button>
              <button className="cancel-btn" onClick={closeCamera}>
                Cancel
              </button>
            </div>
            <div className="camera-instructions">
              <p>📱 Take clear photo of soil sample. Ensure good lighting.</p>
              <p>🌱 AI will analyze color, texture, and composition.</p>
            </div>
          </div>
        </div>
      )}

      <div className="analysis-footer">
        <p><strong>✅ AI + IoT + Edge:</strong> Combines camera analysis, satellite imagery, and sensor data for comprehensive soil health assessment</p>
        <p><strong>🌍 Offline-First:</strong> Works in remote areas with intermittent connectivity using edge AI processing</p>
        <p><strong>📱 Farmer-Centric:</strong> Simple camera-based analysis accessible to all farmers</p>
      </div>
    </div>
  );
};

export default SoilAnalysis;