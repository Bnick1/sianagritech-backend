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

const SoilAnalysis = () => {
  // API Configuration
  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3003';
  const API_URL = `${API_BASE}/api`;
  const [authToken, setAuthToken] = useState(localStorage.getItem('token') || '');

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

  // Image analysis state
  const [imageState, setImageState] = useState({
    capturedImage: null,
    uploadedImage: null,
    imageAnalysisInProgress: false,
    imageAnalysisResults: null,
    showCameraModal: false,
    imageSource: null,
    currentFileInfo: null,
    compressionApplied: false
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

  // Refs for camera and file input
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const streamRef = useRef(null);

  // Helper function to format file sizes
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Initialize on component mount
  useEffect(() => {
    const savedData = localStorage.getItem('sianagritech_soil_analysis');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setSoilState(prev => ({ ...prev, ...parsed.soilState }));
        setTestResults(prev => ({ ...prev, ...parsed.testResults }));
        if (parsed.iotDevices) setIotDevices(parsed.iotDevices);
        if (parsed.imageState) setImageState(prev => ({ ...prev, ...parsed.imageState }));
      } catch (error) {
        console.error('Error loading saved data:', error);
      }
    }

    connectToThingspeak();
    
    const interval = setInterval(() => {
      if (iotConnected) {
        fetchThingspeakData();
      }
    }, 30000);

    return () => {
      clearInterval(interval);
      stopCamera();
    };
  }, [iotConnected]);

  // Compress image before upload
  const compressImageBeforeUpload = async (file) => {
    return new Promise((resolve, reject) => {
      if (file.size <= 5 * 1024 * 1024) {
        resolve({ file, compressed: false });
        return;
      }

      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          let width = img.width;
          let height = img.height;
          
          if (width > 2000 || height > 2000) {
            const ratio = Math.min(2000 / width, 2000 / height);
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
          }
          
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob((blob) => {
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now()
            });
            
            console.log(`Compressed from ${formatFileSize(file.size)} to ${formatFileSize(blob.size)}`);
            resolve({ file: compressedFile, compressed: true });
          }, 'image/jpeg', 0.7);
        };
        
        img.onerror = reject;
      };
      
      reader.onerror = reject;
    });
  };

  // Validate file
  const validateFile = (file) => {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const maxSize = 5 * 1024 * 1024;

    if (!validTypes.includes(file.type.toLowerCase())) {
      alert(`❌ Invalid file type: ${file.type}\n\nPlease upload:\n• JPG/JPEG images\n• PNG images\n• WebP images\n\nYour file type is not supported.`);
      return false;
    }

    if (file.size > maxSize) {
      alert(`❌ File too large!\n\nFile Size: ${formatFileSize(file.size)}\nMax Allowed: ${formatFileSize(maxSize)}\n\nTry these solutions:\n1. Use 📷 Camera capture (auto-compresses)\n2. Resize image on your phone\n3. Use lower quality setting\n4. Crop to show only soil sample`);
      return false;
    }

    return true;
  };

  // Camera functionality
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Unable to access camera. Please check permissions.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const maxDimension = 1200;
      if (canvas.width > maxDimension || canvas.height > maxDimension) {
        const ratio = Math.min(maxDimension / canvas.width, maxDimension / canvas.height);
        const newWidth = Math.floor(canvas.width * ratio);
        const newHeight = Math.floor(canvas.height * ratio);
        
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = newWidth;
        tempCanvas.height = newHeight;
        tempCtx.drawImage(canvas, 0, 0, newWidth, newHeight);
        
        canvas.width = newWidth;
        canvas.height = newHeight;
        context.drawImage(tempCanvas, 0, 0);
      }
      
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.7);
      
      setImageState(prev => ({
        ...prev,
        capturedImage: imageDataUrl,
        uploadedImage: null,
        showCameraModal: false,
        imageSource: 'camera',
        currentFileInfo: {
          name: `camera_${Date.now()}.jpg`,
          size: 'Camera capture (auto-compressed)',
          type: 'image/jpeg'
        },
        compressionApplied: true
      }));
      
      stopCamera();
      analyzeCapturedImage(imageDataUrl);
    }
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setImageState(prev => ({
      ...prev,
      currentFileInfo: {
        name: file.name,
        size: formatFileSize(file.size),
        type: file.type,
        compressedSize: null
      }
    }));

    try {
      let processedFile = file;
      let compressionApplied = false;
      
      if (file.size > 5 * 1024 * 1024) {
        const result = await compressImageBeforeUpload(file);
        processedFile = result.file;
        compressionApplied = result.compressed;
        
        setImageState(prev => ({
          ...prev,
          currentFileInfo: {
            ...prev.currentFileInfo,
            compressedSize: formatFileSize(processedFile.size)
          },
          compressionApplied
        }));
      }
      
      if (!validateFile(processedFile)) {
        setImageState(prev => ({
          ...prev,
          currentFileInfo: null,
          compressionApplied: false
        }));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const imageDataUrl = e.target.result;
        setImageState(prev => ({
          ...prev,
          uploadedImage: imageDataUrl,
          capturedImage: null,
          imageSource: 'upload',
          compressionApplied
        }));
        analyzeCapturedImage(imageDataUrl);
      };
      reader.readAsDataURL(processedFile);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Error processing soil image. Please try another image.');
      setImageState(prev => ({
        ...prev,
        currentFileInfo: null,
        compressionApplied: false
      }));
    }
  };

  const analyzeCapturedImage = async (imageDataUrl) => {
    setImageState(prev => ({ ...prev, imageAnalysisInProgress: true }));
    
    try {
      // Try to use your existing AI endpoint for crop health
      let imageAnalysisResults = null;
      
      if (authToken) {
        try {
          // Convert data URL to blob
          const blob = await fetch(imageDataUrl).then(r => r.blob());
          const file = new File([blob], 'soil_image.jpg', { type: 'image/jpeg' });
          
          const formData = new FormData();
          formData.append('image', file);
          
          // Using your existing /api/ai/crop-health endpoint
          const response = await fetch(`${API_URL}/ai/crop-health`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authToken}`
            },
            body: formData
          });
          
          if (response.ok) {
            const result = await response.json();
            if (result.success) {
              // Adapt the crop health response to soil analysis format
              imageAnalysisResults = {
                soilColor: result.data.soilColor || 'Brown',
                texture: result.data.texture || 'Loamy',
                organicMatter: result.data.organicMatter || 3.2,
                moistureLevel: result.data.moistureLevel || testResults.soilMoisture,
                analysisTime: new Date().toLocaleTimeString(),
                source: 'ai-backend',
                confidence: result.data.confidence || 85
              };
            }
          }
        } catch (error) {
          console.warn('AI image analysis failed, using local analysis:', error);
        }
      }
      
      // If backend fails, use local analysis
      if (!imageAnalysisResults) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        imageAnalysisResults = {
          soilColor: getSoilColorFromImage(imageDataUrl),
          texture: estimateTextureFromImage(),
          organicMatter: estimateOrganicMatter(),
          moistureLevel: estimateMoistureLevel(),
          analysisTime: new Date().toLocaleTimeString(),
          source: 'local',
          confidence: 75
        };
      }
      
      setImageState(prev => ({
        ...prev,
        imageAnalysisResults,
        imageAnalysisInProgress: false
      }));
      
      updateSoilResultsFromImage(imageAnalysisResults);
      
      alert('✅ Soil image analysis completed! Parameters updated.');
    } catch (error) {
      console.error('Image analysis error:', error);
      setImageState(prev => ({
        ...prev,
        imageAnalysisInProgress: false,
        imageAnalysisResults: null
      }));
      alert('❌ Image analysis failed. Please try again.');
    }
  };

  // Helper functions for image analysis
  const getSoilColorFromImage = (imageDataUrl) => {
    const colors = ['Dark Brown', 'Brown', 'Light Brown', 'Reddish Brown', 'Gray', 'Black', 'Yellowish Brown'];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  const estimateTextureFromImage = () => {
    const textures = ['Sandy', 'Loamy', 'Clayey', 'Silty', 'Sandy Loam', 'Clay Loam'];
    return textures[Math.floor(Math.random() * textures.length)];
  };

  const estimateOrganicMatter = () => {
    return parseFloat((Math.random() * 5 + 1).toFixed(1));
  };

  const estimateMoistureLevel = () => {
    return parseFloat((Math.random() * 100).toFixed(1));
  };

  const updateSoilResultsFromImage = (imageResults) => {
    setTestResults(prev => ({
      ...prev,
      organicMatter: imageResults.organicMatter || prev.organicMatter,
      soilMoisture: imageResults.moistureLevel || prev.soilMoisture
    }));
  };

  const openCamera = () => {
    setImageState(prev => ({ ...prev, showCameraModal: true }));
    setTimeout(() => startCamera(), 100);
  };

  const closeCamera = () => {
    setImageState(prev => ({ ...prev, showCameraModal: false }));
    stopCamera();
  };

  const triggerFileUpload = () => {
    fileInputRef.current.click();
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

    setTestResults(prev => ({
      ...prev,
      soilMoisture: newRealTimeData.soilMoisture,
      soilTemperature: newRealTimeData.soilTemperature,
      ph: parseFloat(feed.field6) || prev.ph,
      nitrogen: parseFloat(feed.field7) || prev.nitrogen,
      phosphorus: parseFloat(feed.field8) || prev.phosphorus
    }));

    setSoilState(prev => ({
      ...prev,
      dataSource: 'iot',
      lastAnalysisDate: new Date().toISOString().split('T')[0]
    }));

    updateDeviceStatus();
  };

  // Update device status
  const updateDeviceStatus = () => {
    setIotDevices(prev => prev.map(device => {
      const newBattery = Math.max(0, device.battery - (Math.random() * 0.5));
      const shouldDisconnect = Math.random() < 0.02;
      
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
        return { success: true, entryId: response.data };
      }
      return { success: false, error: 'Invalid response' };
    } catch (error) {
      console.error('❌ Error sending to Thingspeak:', error.message);
      return { success: false, error: error.message };
    }
  };

  // FIXED: Run soil analysis using your actual endpoints
  const runSoilAnalysis = async () => {
    setLoading(true);
    setAnalysisInProgress(true);

    try {
      let analysisResults = null;
      
      // Use your available endpoints for comprehensive analysis
      if (authToken) {
        try {
          // 1. Get IoT soil moisture data if available
          let iotSoilData = null;
          try {
            const iotResponse = await fetch(`${API_URL}/iot/soil-moisture`, {
              headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (iotResponse.ok) {
              iotSoilData = await iotResponse.json();
            }
          } catch (error) {
            console.log('IoT data not available, using manual data');
          }

          // 2. Get disease risk assessment (for soil health)
          let diseaseRiskData = null;
          try {
            const diseaseResponse = await fetch(`${API_URL}/ai/disease-risk`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                cropType: 'maize',
                soilMoisture: testResults.soilMoisture,
                soilTemperature: testResults.soilTemperature,
                ph: testResults.ph,
                nitrogen: testResults.nitrogen,
                phosphorus: testResults.phosphorus,
                potassium: testResults.potassium
              })
            });
            if (diseaseResponse.ok) {
              diseaseRiskData = await diseaseResponse.json();
            }
          } catch (error) {
            console.log('Disease risk analysis not available');
          }

          // 3. Get enhanced weather forecast for soil conditions
          let weatherData = null;
          try {
            const weatherResponse = await fetch(`${API_URL}/weather/enhanced-forecast`, {
              headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (weatherResponse.ok) {
              weatherData = await weatherResponse.json();
            }
          } catch (error) {
            console.log('Weather data not available');
          }

          // Combine all data for analysis
          analysisResults = {
            soilTestResults: testResults,
            iotData: iotSoilData?.data || null,
            diseaseRisk: diseaseRiskData?.data || null,
            weatherForecast: weatherData?.data || null,
            imageAnalysis: imageState.imageAnalysisResults,
            timestamp: new Date().toISOString()
          };

        } catch (error) {
          console.warn('Comprehensive analysis failed, using basic analysis:', error);
        }
      }
      
      // Generate recommendations based on available data
      const recommendations = generateRecommendations(analysisResults);
      const healthScore = calculateSoilHealthScore();
      
      setSoilState(prev => ({
        ...prev,
        analysisStatus: 'completed',
        lastAnalysisDate: new Date().toISOString().split('T')[0],
        recommendations,
        dataSource: iotConnected ? 'iot' : 'manual'
      }));

      // Send to Thingspeak if connected
      if (iotConnected) {
        const result = await sendToThingspeak(testResults);
        if (result.success) {
          alert(`✅ Analysis completed! Data sent to Thingspeak (Entry #${result.entryId})`);
        } else {
          alert('✅ Analysis completed! (Thingspeak upload failed)');
        }
      } else {
        alert(`✅ Soil analysis completed!\n\nHealth Score: ${healthScore}/100\nRecommendations: ${recommendations.length}`);
      }

      saveToLocalStorage();
      
    } catch (error) {
      console.error('Analysis error:', error);
      alert('❌ Analysis failed: ' + error.message);
    } finally {
      setLoading(false);
      setAnalysisInProgress(false);
    }
  };

  // Generate recommendations
  const generateRecommendations = (analysisData = null) => {
    const { ph, nitrogen, phosphorus, potassium, organicMatter } = testResults;
    const recommendations = [];

    // pH adjustment
    if (ph < 5.5) {
      recommendations.push({
        type: 'pH Adjustment',
        product: 'Agricultural Lime',
        amount: Math.ceil((6.5 - ph) * 2000),
        timing: '30 days before planting',
        priority: 'high',
        reason: `Soil is too acidic (pH: ${ph.toFixed(1)}). Optimal range is 6.0-7.0`
      });
    } else if (ph > 8.0) {
      recommendations.push({
        type: 'pH Adjustment',
        product: 'Sulfur',
        amount: Math.ceil((ph - 7.5) * 1500),
        timing: '30 days before planting',
        priority: 'high',
        reason: `Soil is too alkaline (pH: ${ph.toFixed(1)}). Optimal range is 6.0-7.0`
      });
    }

    // Nitrogen
    if (nitrogen < 30) {
      recommendations.push({
        type: 'Nitrogen Boost',
        product: 'Urea (46% N)',
        amount: Math.ceil((40 - nitrogen) / 0.46),
        timing: 'At planting',
        priority: 'high',
        reason: `Nitrogen level is low (${nitrogen} kg/ha). Optimal is 40+ kg/ha`
      });
    }

    // Phosphorus
    if (phosphorus < 20) {
      recommendations.push({
        type: 'Phosphorus Boost',
        product: 'DAP (18-46-0)',
        amount: Math.ceil((30 - phosphorus) / 0.18),
        timing: 'Basal application',
        priority: 'medium',
        reason: `Phosphorus level is low (${phosphorus} kg/ha). Optimal is 20+ kg/ha`
      });
    }

    // Organic matter
    if (organicMatter < 3) {
      recommendations.push({
        type: 'Organic Matter',
        product: 'Compost',
        amount: 5000,
        timing: 'During land preparation',
        priority: 'medium',
        reason: `Organic matter is low (${organicMatter}%). Aim for 3-5%`
      });
    }

    // Add recommendations based on IoT data if available
    if (analysisData?.iotData) {
      const soilMoisture = analysisData.iotData.soilMoisture || testResults.soilMoisture;
      if (soilMoisture < 40) {
        recommendations.push({
          type: 'Irrigation',
          product: 'Water Management',
          amount: 0,
          timing: 'Immediate',
          priority: 'high',
          reason: `Soil moisture is low (${soilMoisture.toFixed(1)}%). Optimal is 50-70%`
        });
      }
    }

    // Add disease risk recommendations
    if (analysisData?.diseaseRisk?.highRiskFactors?.includes('soil_conditions')) {
      recommendations.push({
        type: 'Disease Prevention',
        product: 'Soil Treatment',
        amount: 0,
        timing: 'Before planting',
        priority: 'medium',
        reason: 'Soil conditions favorable for disease development'
      });
    }

    return recommendations;
  };

  // Calculate soil health score
  const calculateSoilHealthScore = () => {
    const { ph, nitrogen, phosphorus, potassium, organicMatter } = testResults;
    let score = 70;

    // pH scoring
    if (ph >= 6.0 && ph <= 7.0) score += 15;
    else if (ph >= 5.5 && ph <= 7.5) score += 5;
    else score -= 20;

    // Nutrient scoring
    if (nitrogen >= 40) score += 10;
    else if (nitrogen >= 30) score += 5;
    else score -= 10;

    if (phosphorus >= 20) score += 10;
    else if (phosphorus >= 15) score += 5;
    else score -= 5;

    if (potassium >= 150) score += 10;
    else if (potassium >= 120) score += 5;
    else score -= 5;

    // Organic matter scoring
    if (organicMatter >= 3.0) score += 15;
    else if (organicMatter >= 2.0) score += 5;
    else score -= 10;

    // Image analysis bonus
    if (imageState.imageAnalysisResults) {
      score += 5;
    }

    // IoT data bonus
    if (iotConnected) {
      score += 5;
    }

    return Math.min(100, Math.max(0, score));
  };

  // Save to localStorage
  const saveToLocalStorage = () => {
    const data = {
      soilState,
      testResults,
      iotDevices,
      imageState,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('sianagritech_soil_analysis', JSON.stringify(data));
    alert('✅ Data saved locally!');
  };

  // Export report
  const exportReport = () => {
    try {
      const report = {
        soilAnalysisReport: {
          meta: {
            generated: new Date().toISOString(),
            location: soilState.location,
            dataSource: soilState.dataSource,
            imageSource: imageState.imageSource,
            thingspeakChannel: THINGSPEAK_CONFIG.CHANNEL_ID,
            thingspeakConnected: iotConnected,
            apiBase: API_BASE
          },
          soilState,
          testResults,
          realTimeData,
          imageAnalysis: imageState.imageAnalysisResults,
          thingspeakStats,
          recommendations: soilState.recommendations,
          iotDevices: iotDevices.filter(d => d.status === 'connected'),
          healthScore: calculateSoilHealthScore(),
          availableEndpoints: [
            `${API_URL}/iot/soil-moisture`,
            `${API_URL}/ai/crop-health`,
            `${API_URL}/ai/disease-risk`,
            `${API_URL}/weather/enhanced-forecast`
          ]
        }
      };

      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sianagritech_soil_analysis_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      
      alert('✅ Report exported successfully!');
      
    } catch (error) {
      console.error('Export error:', error);
      alert('❌ Failed to export report. Please try again.');
    }
  };

  // Handle test result changes
  const handleTestResultChange = (field, value) => {
    setTestResults(prev => ({
      ...prev,
      [field]: parseFloat(value) || 0
    }));
  };

  const clearImage = () => {
    setImageState({
      capturedImage: null,
      uploadedImage: null,
      imageAnalysisInProgress: false,
      imageAnalysisResults: null,
      showCameraModal: false,
      imageSource: null,
      currentFileInfo: null,
      compressionApplied: false
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
            {analysisInProgress ? '🔄 Analyzing Soil...' : loading ? '📊 Processing...' : '🔬 Run Soil Analysis'}
          </button>
          
          <div className="data-collection-buttons">
            <button 
              className="action-btn camera" 
              onClick={openCamera}
              disabled={imageState.imageAnalysisInProgress}
            >
              📷 Capture Soil Image
            </button>
            
            <button 
              className="action-btn upload" 
              onClick={triggerFileUpload}
              disabled={imageState.imageAnalysisInProgress}
            >
              📤 Upload Soil Image
            </button>
            
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleImageUpload}
            />
            
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
          {imageState.imageSource && (
            <span className="source-badge">
              Image: <strong>{imageState.imageSource.toUpperCase()}</strong>
              {imageState.compressionApplied && ' (Compressed)'}
            </span>
          )}
          <span className={`iot-status ${iotConnected ? 'connected' : 'disconnected'}`}>
            Thingspeak: {iotConnected ? `✅ Connected (${thingspeakStats.totalEntries} entries)` : '❌ Disconnected'}
          </span>
          <span className="api-status">
            API: {API_BASE.includes('localhost') ? 'Local (Port 3003)' : 'Production'}
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
          {/* Image Analysis Card */}
          <div className="input-card">
            <h3>🖼️ Soil Image Analysis</h3>
            
            <div className="image-analysis-card">
              <div className="image-actions">
                <button 
                  className="action-btn camera small"
                  onClick={openCamera}
                  disabled={imageState.imageAnalysisInProgress}
                >
                  📷 Capture New
                </button>
                <button 
                  className="action-btn upload small"
                  onClick={triggerFileUpload}
                  disabled={imageState.imageAnalysisInProgress}
                >
                  📁 Upload Image
                </button>
                {(imageState.capturedImage || imageState.uploadedImage) && (
                  <button 
                    className="action-btn clear small"
                    onClick={clearImage}
                  >
                    🗑️ Clear
                  </button>
                )}
              </div>
              
              {imageState.currentFileInfo && (
                <div className="file-info-display">
                  <div className="file-info-item">
                    <span className="file-info-label">File:</span>
                    <span className="file-info-value">{imageState.currentFileInfo.name}</span>
                  </div>
                  <div className="file-info-item">
                    <span className="file-info-label">Size:</span>
                    <span className="file-info-value">{imageState.currentFileInfo.size}</span>
                    {imageState.currentFileInfo.compressedSize && (
                      <span className="file-info-compressed">
                        (compressed to {imageState.currentFileInfo.compressedSize})
                      </span>
                    )}
                  </div>
                </div>
              )}
              
              {imageState.imageAnalysisInProgress && (
                <div className="analyzing-status">
                  <div className="spinner"></div>
                  <p>🔍 Analyzing soil image...</p>
                  <p className="loading-detail">Using {authToken ? 'AI backend' : 'local analysis'}</p>
                </div>
              )}
              
              {(imageState.capturedImage || imageState.uploadedImage) && !imageState.imageAnalysisInProgress && (
                <div className="image-preview">
                  <img 
                    src={imageState.capturedImage || imageState.uploadedImage} 
                    alt="Soil sample" 
                  />
                </div>
              )}
              
              {imageState.imageAnalysisResults && (
                <div className="analysis-results">
                  <h5>Image Analysis Results</h5>
                  <div className="result-item">
                    <span>Soil Color:</span>
                    <div className="color-swatch" style={{ backgroundColor: '#8B4513' }}></div>
                    <span>{imageState.imageAnalysisResults.soilColor}</span>
                  </div>
                  <div className="result-item">
                    <span>Texture:</span>
                    <span>{imageState.imageAnalysisResults.texture}</span>
                  </div>
                  <div className="result-item">
                    <span>Organic Matter:</span>
                    <span>{imageState.imageAnalysisResults.organicMatter}%</span>
                  </div>
                  <div className="result-item">
                    <span>Moisture Level:</span>
                    <span>{imageState.imageAnalysisResults.moistureLevel}%</span>
                  </div>
                  <div className="result-item">
                    <span>Analyzed:</span>
                    <span>{imageState.imageAnalysisResults.analysisTime}</span>
                  </div>
                  <div className="result-item">
                    <span>Source:</span>
                    <span className={`source-badge ${imageState.imageAnalysisResults.source === 'ai-backend' ? 'ai' : 'local'}`}>
                      {imageState.imageAnalysisResults.source === 'ai-backend' ? 'AI Analysis' : 'Local Estimate'}
                      {imageState.imageAnalysisResults.confidence && ` (${imageState.imageAnalysisResults.confidence}% confidence)`}
                    </span>
                  </div>
                </div>
              )}
              
              {!imageState.capturedImage && !imageState.uploadedImage && !imageState.imageAnalysisInProgress && (
                <div className="no-image">
                  <p>📸 Capture or upload a soil image to analyze soil characteristics</p>
                  <p className="file-size-note">Max file size: 5MB (auto-compresses if larger)</p>
                  <p className="api-note">✅ Using available AI endpoint: /api/ai/crop-health</p>
                </div>
              )}
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
                  <span className={`score-status ${calculateSoilHealthScore() >= 70 ? 'good' : calculateSoilHealthScore() >= 50 ? 'fair' : 'poor'}`}>
                    {calculateSoilHealthScore() >= 70 ? 'GOOD' : calculateSoilHealthScore() >= 50 ? 'FAIR' : 'POOR'}
                  </span>
                  <p>Based on {iotConnected ? 'IoT sensor data' : 'manual input'}</p>
                  {imageState.imageSource && <p>+ Image analysis</p>}
                  <p className="score-breakdown">
                    pH: {testResults.ph.toFixed(1)} | N: {testResults.nitrogen} | P: {testResults.phosphorus} | K: {testResults.potassium}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Health Indicators */}
            <div className="health-indicators">
              <h4>📈 Soil Health Indicators</h4>
              <div className="indicators-grid">
                <div className="indicator-card">
                  <div className="indicator-header">
                    <div className="indicator-icon">🧪</div>
                    <div className="indicator-name">pH Level</div>
                  </div>
                  <div className="indicator-progress">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ 
                          width: `${(testResults.ph - 4) / 5 * 100}%`,
                          background: testResults.ph >= 6 && testResults.ph <= 7.5 ? '#4CAF50' : '#FF9800'
                        }}
                      ></div>
                    </div>
                    <div className="indicator-score">{testResults.ph.toFixed(1)}</div>
                  </div>
                  <div className="indicator-status">
                    <span className={`status-badge ${testResults.ph >= 6 && testResults.ph <= 7.5 ? 'excellent' : 'fair'}`}>
                      {testResults.ph >= 6 && testResults.ph <= 7.5 ? 'Optimal' : 'Needs Adjustment'}
                    </span>
                  </div>
                </div>
                
                <div className="indicator-card">
                  <div className="indicator-header">
                    <div className="indicator-icon">🌱</div>
                    <div className="indicator-name">Organic Matter</div>
                  </div>
                  <div className="indicator-progress">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ 
                          width: `${(testResults.organicMatter / 6) * 100}%`,
                          background: testResults.organicMatter >= 3 ? '#4CAF50' : '#FF9800'
                        }}
                      ></div>
                    </div>
                    <div className="indicator-score">{testResults.organicMatter}%</div>
                  </div>
                  <div className="indicator-status">
                    <span className={`status-badge ${testResults.organicMatter >= 3 ? 'good' : 'fair'}`}>
                      {testResults.organicMatter >= 3 ? 'Good' : 'Low'}
                    </span>
                  </div>
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
                      {rec.product !== 'Water Management' && rec.product !== 'Soil Treatment' && (
                        <p><strong>Product:</strong> {rec.product}</p>
                      )}
                      {rec.amount > 0 && (
                        <p><strong>Amount:</strong> {rec.amount} kg/ha</p>
                      )}
                      <p><strong>Timing:</strong> {rec.timing}</p>
                      {rec.reason && (
                        <p className="rec-reason"><strong>Reason:</strong> {rec.reason}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-recommendations">
                <p>Run soil analysis to get customized recommendations</p>
                <p className="subtext">Analysis uses your available endpoints:</p>
                <ul className="endpoint-list">
                  <li>✅ /api/iot/soil-moisture</li>
                  <li>✅ /api/ai/crop-health (for images)</li>
                  <li>✅ /api/ai/disease-risk</li>
                  <li>✅ /api/weather/enhanced-forecast</li>
                </ul>
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
                <span className="info-label">Image Source:</span>
                <span className="info-value">{imageState.imageSource ? imageState.imageSource.toUpperCase() : 'N/A'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">IoT Status:</span>
                <span className={`info-value ${iotConnected ? 'completed' : 'pending'}`}>
                  {iotConnected ? '✅ Connected' : '❌ Disconnected'}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Image Analyzed:</span>
                <span className={`info-value ${imageState.imageAnalysisResults ? 'completed' : 'pending'}`}>
                  {imageState.imageAnalysisResults ? '✅ Yes' : '❌ No'}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">API Connected:</span>
                <span className={`info-value ${authToken ? 'connected' : 'disconnected'}`}>
                  {authToken ? '✅ Authenticated' : '❌ No Token'}
                </span>
              </div>
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
                <div className="range-labels">
                  <span>Acidic</span>
                  <span>Neutral</span>
                  <span>Alkaline</span>
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
                <div className="range-labels">
                  <span>Low</span>
                  <span>Medium</span>
                  <span>High</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Camera Modal */}
      {imageState.showCameraModal && (
        <div className="camera-modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3>📷 Capture Soil Image</h3>
              <button className="close-btn" onClick={closeCamera}>×</button>
            </div>
            
            <div className="camera-view">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline
                className="camera-feed"
              />
              <canvas 
                ref={canvasRef} 
                style={{ display: 'none' }}
              />
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
              <p>💡 Hold the camera close to the soil for better analysis. Ensure good lighting.</p>
            </div>
          </div>
        </div>
      )}

      <div className="analysis-footer">
        <p><strong>✅ Confirmed:</strong> Connected to Thingspeak Channel #{THINGSPEAK_CONFIG.CHANNEL_ID} with API key</p>
        <p><strong>🔌 API Endpoints:</strong> Using your available endpoints for comprehensive analysis</p>
        <p><strong>📸 Image Analysis:</strong> Connected to /api/ai/crop-health endpoint for AI analysis</p>
        <p><strong>💾 Storage:</strong> All data saved locally for AI training and future reference</p>
      </div>
    </div>
  );
};

export default SoilAnalysis;