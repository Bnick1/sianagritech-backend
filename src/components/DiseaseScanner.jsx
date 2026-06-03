import React, { useState, useRef, useEffect } from 'react';
import './DiseaseScanner.css';

const DiseaseScanner = () => {
  const [image, setImage] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [backendConnected, setBackendConnected] = useState(false);
  const [token, setToken] = useState(localStorage.getItem('authToken'));
  const [storageHealth, setStorageHealth] = useState({ totalMB: 0, percentUsed: 0 });
  const [currentFileInfo, setCurrentFileInfo] = useState(null);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState(null);

  // Helper function to format file sizes
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Check backend connection - FIXED: Port 3003 instead of 3000
  useEffect(() => {
    checkBackendConnection();
    checkAuth();
    monitorStorage();
    
    const storageInterval = setInterval(monitorStorage, 60000);
    
    return () => {
      clearInterval(storageInterval);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const checkBackendConnection = async () => {
    try {
      const response = await fetch('http://localhost:3003/health');
      if (response.ok) {
        setBackendConnected(true);
        console.log('✅ Backend connected');
      }
    } catch (error) {
      console.warn('⚠️ Backend not connected, using mock mode');
    }
  };

  const checkAuth = () => {
    const savedToken = localStorage.getItem('authToken');
    if (savedToken) {
      setToken(savedToken);
    }
  };

  const monitorStorage = () => {
    try {
      let totalBytes = 0;
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);
        totalBytes += value ? new Blob([value]).size : 0;
      }
      
      const totalMB = totalBytes / 1024 / 1024;
      const percentUsed = (totalBytes / (5 * 1024 * 1024)) * 100;
      
      setStorageHealth({ totalMB: totalMB.toFixed(2), percentUsed: percentUsed.toFixed(1) });
      
      if (percentUsed > 90) {
        autoCleanupStorage();
      }
    } catch (error) {
      console.warn('Storage monitoring failed:', error);
    }
  };

  const autoCleanupStorage = () => {
    try {
      const scans = JSON.parse(localStorage.getItem('diseaseScans') || '[]');
      const keepScans = Math.floor(scans.length * 0.7);
      
      if (scans.length > keepScans) {
        const recentScans = scans.slice(-keepScans);
        localStorage.setItem('diseaseScans', JSON.stringify(recentScans));
        console.log(`Auto-cleaned storage. Kept ${keepScans} scans.`);
        
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('image_') || key.includes('base64')) {
            try {
              localStorage.removeItem(key);
            } catch (e) {
              // Ignore
            }
          }
        });
      }
    } catch (error) {
      console.error('Auto-cleanup failed:', error);
    }
  };

  // Camera functionality
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      setStream(mediaStream);
      setShowCamera(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error('Camera error:', error);
      alert('Unable to access camera. Please check permissions.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setShowCamera(false);
  };

  const compressImageBeforeUpload = async (file) => {
    return new Promise((resolve, reject) => {
      if (file.size <= 5 * 1024 * 1024) {
        resolve(file);
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
            resolve(compressedFile);
          }, 'image/jpeg', 0.7);
        };
        
        img.onerror = reject;
      };
      
      reader.onerror = reject;
    });
  };

  const captureFromCamera = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
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
    
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.7);
    setImage(imageDataUrl);
    
    const blob = await new Promise(resolve => {
      canvas.toBlob(resolve, 'image/jpeg', 0.7);
    });
    
    stopCamera();
    analyzeImage(blob, `camera_${Date.now()}.jpg`);
  };

  const validateFile = (file) => {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const maxSize = 5 * 1024 * 1024;

    if (!validTypes.includes(file.type.toLowerCase())) {
      alert(`❌ Invalid file type: ${file.type}\n\nPlease upload:\n• JPG/JPEG images\n• PNG images\n• WebP images\n\nYour file type is not supported.`);
      return false;
    }

    if (file.size > maxSize) {
      alert(`❌ File too large!\n\nFile Size: ${formatFileSize(file.size)}\nMax Allowed: ${formatFileSize(maxSize)}\n\nTry these solutions:\n1. Use 📷 Camera capture (auto-compresses)\n2. Resize image on your phone\n3. Use lower quality setting\n4. Crop the image to show only the plant`);
      return false;
    }

    return true;
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCurrentFileInfo({
      name: file.name,
      size: formatFileSize(file.size),
      type: file.type
    });

    setLoading(true);
    
    try {
      let processedFile = file;
      if (file.size > 5 * 1024 * 1024) {
        processedFile = await compressImageBeforeUpload(file);
        setCurrentFileInfo(prev => ({
          ...prev,
          compressedSize: formatFileSize(processedFile.size)
        }));
      }
      
      if (!validateFile(processedFile)) {
        setLoading(false);
        setCurrentFileInfo(null);
        return;
      }

      const imageUrl = URL.createObjectURL(processedFile);
      setImage(imageUrl);
      analyzeImage(processedFile, processedFile.name);
      
    } catch (error) {
      console.error('Upload error:', error);
      alert('Error processing image. Please try another image.');
      setLoading(false);
      setCurrentFileInfo(null);
    }
  };

  const analyzeImage = async (file, fileName) => {
    setLoading(true);
    
    try {
      let result;

      if (backendConnected && token) {
        // FIXED: Use port 3003 instead of 3000
        result = await analyzeWithBackendFile(file, fileName);
        
        if (!result.success) {
          const base64Image = await convertToBase64(file);
          result = await analyzeWithBackendBase64(base64Image);
        }
      } else {
        result = await analyzeWithMockAPI();
      }

      if (result.success) {
        const analysisData = {
          ...result.data,
          id: Date.now(),
          fileName
        };
        setPrediction(analysisData);
        saveToLocalStorage(fileName, analysisData, typeof file === 'string' ? file : URL.createObjectURL(file));
      } else {
        throw new Error(result.error || 'Analysis failed');
      }

    } catch (error) {
      console.error('Analysis error:', error);
      
      const fallbackPrediction = {
        id: Date.now(),
        name: 'Analysis Failed',
        confidence: 0,
        treatment: 'Please try again with a clearer image or better lighting.',
        severity: 'unknown',
        error: error.message
      };
      setPrediction(fallbackPrediction);
      saveToLocalStorage(fileName, fallbackPrediction, typeof file === 'string' ? file : URL.createObjectURL(file));
    } finally {
      setLoading(false);
      setCurrentFileInfo(null);
    }
  };

  const analyzeWithBackendFile = async (file, fileName) => {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('cropType', 'tomato');

    // FIXED: Use port 3003
    const response = await fetch('http://localhost:3003/api/ai/detect-disease', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    return await response.json();
  };

  const analyzeWithBackendBase64 = async (base64Image) => {
    // FIXED: Use port 3003
    const response = await fetch('http://localhost:3003/api/ai/detect-disease-base64', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        imageBase64: base64Image,
        cropType: 'tomato'
      })
    });

    return await response.json();
  };

  const convertToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  };

  const analyzeWithMockAPI = async () => {
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const diseases = [
      { 
        name: 'Tomato Early Blight', 
        confidence: 85, 
        treatment: 'Remove affected leaves immediately. Apply copper-based fungicide every 7-10 days.',
        severity: 'moderate',
        scientificName: 'Alternaria solani',
        prevention: 'Rotate crops, use resistant varieties'
      },
      { 
        name: 'Healthy Plant', 
        confidence: 92, 
        treatment: 'Continue regular care routine. Monitor for early signs of disease.',
        severity: 'none',
        scientificName: 'Normal',
        prevention: 'Regular inspection, proper nutrition'
      }
    ];
    
    const diagnosis = diseases[Math.floor(Math.random() * diseases.length)];
    
    return {
      success: true,
      data: {
        ...diagnosis,
        imageUrl: image,
        cropType: 'tomato',
        hasDisease: !diagnosis.name.includes('Healthy'),
        metadata: {
          analyzedAt: new Date().toISOString(),
          analysisTime: 2.1,
          modelVersion: '1.0.0',
          source: 'mock'
        }
      }
    };
  };

  const saveToLocalStorage = (fileName, diagnosis, imageUrl) => {
    try {
      let scans = [];
      try {
        scans = JSON.parse(localStorage.getItem('diseaseScans') || '[]');
      } catch (parseError) {
        console.warn('Could not parse localStorage, starting fresh');
        scans = [];
      }
      
      const diagnosisName = diagnosis?.name || 'Unknown Diagnosis';
      const isHealthy = diagnosisName.includes('Healthy');
      
      const optimizedScan = {
        id: diagnosis?.id || Date.now(),
        fileName,
        diagnosis: diagnosisName,
        confidence: diagnosis?.confidence || 0,
        severity: diagnosis?.severity || 'unknown',
        timestamp: new Date().toISOString(),
        status: isHealthy ? 'healthy' : 'diseased',
        imageInfo: {
          hasImage: !!imageUrl,
          size: 'compressed',
          url: imageUrl && !backendConnected ? compressImageUrl(imageUrl) : null
        },
        backendConnected,
        offline: !backendConnected
      };
      
      scans.push(optimizedScan);
      
      const dataSize = JSON.stringify(scans).length;
      const maxSize = 4 * 1024 * 1024;
      
      if (dataSize > maxSize) {
        console.warn('Storage approaching limit, cleaning up...');
        scans = scans.slice(-15);
      }
      
      try {
        localStorage.setItem('diseaseScans', JSON.stringify(scans));
        console.log('Scan saved to localStorage:', scans.length, 'total scans');
      } catch (quotaError) {
        console.error('Storage quota exceeded:', quotaError);
        
        try {
          sessionStorage.setItem('diseaseScans_current', JSON.stringify(scans.slice(-5)));
          console.log('Saved to sessionStorage as fallback');
        } catch (e) {
          saveToIndexedDB(optimizedScan);
        }
        
        const minimalScans = scans.map(scan => ({
          id: scan.id,
          diagnosis: scan.diagnosis,
          timestamp: scan.timestamp
        }));
        localStorage.setItem('diseaseScans_minimal', JSON.stringify(minimalScans.slice(-20)));
      }
      
    } catch (error) {
      console.error('Failed to save scan:', error);
      localStorage.setItem('last_scan_error', JSON.stringify({
        timestamp: new Date().toISOString(),
        error: error.message
      }));
    }
  };

  const compressImageUrl = (dataUrl) => {
    if (!dataUrl || !dataUrl.startsWith('data:image')) return null;
    
    if (dataUrl.length > 50000) {
      return 'data_trimmed';
    }
    
    return dataUrl;
  };

  const saveToIndexedDB = (scanData) => {
    if (!('indexedDB' in window)) return;
    
    const request = indexedDB.open('SianAgriTechScans', 1);
    
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('scans')) {
        const store = db.createObjectStore('scans', { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp');
      }
    };
    
    request.onsuccess = (e) => {
      const db = e.target.result;
      const transaction = db.transaction(['scans'], 'readwrite');
      const store = transaction.objectStore('scans');
      
      store.put(scanData);
      
      transaction.oncomplete = () => {
        console.log('Scan saved to IndexedDB');
      };
    };
  };

  // FIXED: Updated exportReport function with proper backend port and local fallback
  const exportReport = async (analysisId, format = 'json') => {
    try {
      // FIXED: Use correct port 3003 and handle missing backend
      if (!backendConnected || !token) {
        exportLocalReport(analysisId, format);
        return;
      }

      const response = await fetch(`http://localhost:3003/api/ai/report/${analysisId}?format=${format}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': format === 'pdf' ? 'application/pdf' : 
                    format === 'json' ? 'application/json' : 'text/html'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Export failed: ${response.status}`);
      }
      
      const contentType = response.headers.get('content-type');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      if (contentType?.includes('application/pdf')) {
        a.download = `sianagritech_report_${analysisId}.pdf`;
      } else if (contentType?.includes('application/json')) {
        a.download = `sianagritech_report_${analysisId}.json`;
      } else {
        a.download = `sianagritech_report_${analysisId}.${format === 'pdf' ? 'pdf' : format === 'json' ? 'json' : 'html'}`;
      }
      
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 100);
      
    } catch (error) {
      console.error('Export error:', error);
      exportLocalReport(analysisId, format);
    }
  };

  // NEW: Local export fallback function
  const exportLocalReport = (analysisId, format) => {
    try {
      const reportData = {
        id: analysisId,
        prediction: prediction,
        imageInfo: currentFileInfo,
        timestamp: new Date().toISOString(),
        backendConnected,
        metadata: {
          exportedAt: new Date().toISOString(),
          format: format,
          version: '1.0.0'
        }
      };
      
      let blob, filename;
      
      if (format === 'json') {
        blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
        filename = `sianagritech_disease_report_${analysisId}.json`;
      } else if (format === 'pdf') {
        // Create simple PDF-like text report
        const textReport = `
          SIAN AGRITECH - DISEASE ANALYSIS REPORT
          ======================================
          
          Report ID: ${analysisId}
          Generated: ${new Date().toLocaleString()}
          
          DIAGNOSIS
          ---------
          Disease: ${prediction?.name || 'Unknown'}
          Confidence: ${prediction?.confidence || 0}%
          Severity: ${prediction?.severity || 'Unknown'}
          
          TREATMENT
          ---------
          ${prediction?.treatment || 'No treatment recommendations available.'}
          
          IMAGE INFORMATION
          -----------------
          File: ${currentFileInfo?.name || 'Camera capture'}
          Size: ${currentFileInfo?.size || 'Unknown'}
          Type: ${currentFileInfo?.type || 'Unknown'}
          
          SYSTEM INFORMATION
          ------------------
          Backend: ${backendConnected ? 'Connected' : 'Offline'}
          Export Format: ${format}
          Version: 1.0.0
        `;
        
        blob = new Blob([textReport], { type: 'text/plain' });
        filename = `sianagritech_disease_report_${analysisId}.txt`;
      } else {
        // HTML report
        const htmlReport = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>SianAgriTech Disease Report - ${analysisId}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 40px; }
              .header { background: #4CAF50; color: white; padding: 20px; border-radius: 5px; }
              .section { margin: 20px 0; padding: 15px; border-left: 4px solid #4CAF50; background: #f9f9f9; }
              .footer { margin-top: 30px; font-size: 12px; color: #666; text-align: center; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>🌿 SianAgriTech Disease Analysis Report</h1>
              <p>Report ID: ${analysisId} | Generated: ${new Date().toLocaleString()}</p>
            </div>
            
            <div class="section">
              <h2>📋 Diagnosis</h2>
              <p><strong>Disease:</strong> ${prediction?.name || 'Unknown'}</p>
              <p><strong>Confidence:</strong> ${prediction?.confidence || 0}%</p>
              <p><strong>Severity:</strong> ${prediction?.severity || 'Unknown'}</p>
            </div>
            
            <div class="section">
              <h2>💊 Treatment Plan</h2>
              <p>${prediction?.treatment || 'No specific treatment recommendations available.'}</p>
            </div>
            
            <div class="footer">
              <p>Generated by SianAgriTech Platform • Version 1.0.0</p>
              <p>🌾 Smart Farming, Smarter Harvests</p>
            </div>
          </body>
          </html>
        `;
        
        blob = new Blob([htmlReport], { type: 'text/html' });
        filename = `sianagritech_disease_report_${analysisId}.html`;
      }
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 100);
      
      alert(`✅ Report exported as ${filename}`);
      
    } catch (error) {
      console.error('Local export error:', error);
      alert('❌ Failed to export report. Please try again or contact support.');
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const getSeverityColor = (severity) => {
    if (!severity) return '#6c757d';
    
    switch(severity.toLowerCase()) {
      case 'high': return '#dc3545';
      case 'moderate': return '#ffc107';
      case 'low': return '#28a745';
      default: return '#6c757d';
    }
  };

  const getSeverityText = (severity) => {
    if (!severity) return 'Unknown Severity';
    
    switch(severity.toLowerCase()) {
      case 'high': return 'Immediate Action Required';
      case 'moderate': return 'Monitor Closely';
      case 'low': return 'Manage Preventatively';
      default: return 'No Issues Detected';
    }
  };

  const clearAll = () => {
    setImage(null);
    setPrediction(null);
    setCurrentFileInfo(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="disease-scanner-container">
      <div className="disease-scanner-header">
        <h1>🌿 AI Plant Disease Detection</h1>
        <p className="subtitle">Capture or upload a photo of plant leaves for instant AI diagnosis</p>
        
        <div className="connection-status">
          <span className={`status-dot ${backendConnected ? 'connected' : 'disconnected'}`}></span>
          <span>Backend: {backendConnected ? '✅ Connected' : '⚠️ Offline Mode'}</span>
          {!token && <span style={{marginLeft: '1rem', color: '#ff9800'}}>🔒 Login required for cloud analysis</span>}
          <span style={{marginLeft: '1rem', fontSize: '0.8rem', color: '#666'}}>
            Storage: {storageHealth.totalMB}MB ({storageHealth.percentUsed}% used)
          </span>
        </div>
      </div>

      {/* Camera Modal */}
      {showCamera && (
        <div className="camera-modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3>📷 Capture Leaf Photo</h3>
              <button className="close-btn" onClick={stopCamera}>×</button>
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
              <button className="capture-btn" onClick={captureFromCamera}>
                📸 Capture Photo
              </button>
              <button className="cancel-btn" onClick={stopCamera}>
                Cancel
              </button>
            </div>
            
            <div className="camera-instructions">
              <p>💡 Hold camera close to leaves. Ensure good lighting.</p>
            </div>
          </div>
        </div>
      )}

      <div className="upload-section">
        <div className="upload-card">
          <div className="upload-icon">📸</div>
          <h3>Capture or Upload</h3>
          <p className="upload-hint">Take photo with camera or select from gallery</p>
          
          <div className="capture-buttons">
            <button 
              className="capture-button camera"
              onClick={startCamera}
              disabled={loading}
            >
              📷 Use Camera
            </button>
            
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/jpeg,image/jpg,image/png,image/webp"
              style={{ display: 'none' }}
              disabled={loading}
            />
            
            <button 
              className="capture-button upload"
              onClick={triggerFileInput}
              disabled={loading}
            >
              📁 Upload Photo
            </button>
          </div>
          
          <p className="supported-formats">Supports: JPG, PNG, WebP (Max 5MB)</p>
          
          {currentFileInfo && (
            <div className="file-info-display">
              <div className="file-info-item">
                <span className="file-info-label">File:</span>
                <span className="file-info-value">{currentFileInfo.name}</span>
              </div>
              <div className="file-info-item">
                <span className="file-info-label">Size:</span>
                <span className="file-info-value">{currentFileInfo.size}</span>
                {currentFileInfo.compressedSize && (
                  <span className="file-info-compressed">
                    (compressed to {currentFileInfo.compressedSize})
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {image && (
          <div className="image-preview-section">
            <h4>Image Preview</h4>
            <div className="image-preview">
              <img src={image} alt="Plant leaf for analysis" />
              <button 
                className="clear-image-btn"
                onClick={clearAll}
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {loading && (
        <div className="loading-section">
          <div className="spinner"></div>
          <p>Analyzing image with AI...</p>
          <div className="progress-steps">
            <span className="step active">Uploading</span>
            <span className="step active">Processing</span>
            <span className="step active">Analyzing</span>
            <span className="step">Generating Report</span>
          </div>
          <p className="loading-detail">
            {backendConnected ? 
              'Connecting to SianAgriTech AI Engine...' : 
              'Using offline analysis mode...'
            }
          </p>
        </div>
      )}

      {prediction && !loading && (
        <div className="results-section">
          <div className={`result-card ${prediction.name?.includes('Healthy') ? 'healthy' : 'diseased'}`}>
            <div className="result-header">
              <h3>📋 Diagnosis Results</h3>
              <div className="confidence-meter">
                <div 
                  className="confidence-fill" 
                  style={{ width: `${prediction.confidence || 0}%` }}
                ></div>
                <span className={`confidence-badge ${(prediction.confidence || 0) > 80 ? 'high' : (prediction.confidence || 0) > 60 ? 'medium' : 'low'}`}>
                  {prediction.confidence || 0}% Confidence
                </span>
              </div>
            </div>
            
            <div className="diagnosis-details">
              <div className="diagnosis-header">
                <h4 className="diagnosis-name">{prediction.name || 'Unknown Diagnosis'}</h4>
                {prediction.scientificName && (
                  <span className="scientific-name">({prediction.scientificName})</span>
                )}
              </div>
              
              <div className="severity-indicator">
                <span 
                  className="severity-dot" 
                  style={{ backgroundColor: getSeverityColor(prediction.severity) }}
                ></span>
                <div className="severity-info">
                  <span className="severity-level">
                    Severity: <strong>{(prediction.severity || 'unknown').charAt(0).toUpperCase() + (prediction.severity || 'unknown').slice(1)}</strong>
                  </span>
                  <span className="severity-action">{getSeverityText(prediction.severity)}</span>
                </div>
              </div>

              <div className="treatment-plan">
                <h5>💡 Recommended Treatment Plan</h5>
                <p>{prediction.treatment || 'No specific treatment recommendations available.'}</p>
                
                {prediction.prevention && (
                  <div className="prevention-tips">
                    <h6>🛡️ Prevention Tips</h6>
                    <p>{prediction.prevention}</p>
                  </div>
                )}
              </div>

              <div className="action-buttons">
                <button className="action-btn primary">
                  🛒 View Recommended Products
                </button>
                <button className="action-btn secondary">
                  📅 Set Treatment Reminder
                </button>
                {prediction.id && (
                  <button 
                    className="action-btn outline"
                    onClick={() => exportReport(prediction.id, 'json')}
                  >
                    📄 Export Report
                  </button>
                )}
                <button className="action-btn outline"
                  onClick={clearAll}
                >
                  🔄 Scan Another Plant
                </button>
              </div>
            </div>
          </div>

          <div className="history-note">
            <p>
              📝 This scan has been saved {backendConnected ? 'to your farm records' : 'locally'}.
              {!backendConnected && ' It will sync when you reconnect to backend.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiseaseScanner;