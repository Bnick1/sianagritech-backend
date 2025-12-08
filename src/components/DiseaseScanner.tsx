// src/components/DiseaseScanner.tsx
import React, { useState, useRef } from 'react';
import { storage, firestore } from '../lib/firebase-config'; // Adjust path if needed
import './DiseaseScanner.css';

const DiseaseScanner: React.FC = () => {
  const [image, setImage] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    
    // Create preview URL
    const imageUrl = URL.createObjectURL(file);
    setImage(imageUrl);

    try {
      // 1. Upload to Firebase Storage
      const storageRef = storage.ref(`disease-scans/${Date.now()}_${file.name}`);
      await storageRef.put(file);
      const downloadURL = await storageRef.getDownloadURL();

      // 2. Get AI Prediction (Simulated - will replace with real model)
      const diagnosis = await analyzeImage(file);

      // 3. Save to Firestore
      await firestore.collection('diseaseScans').add({
        imageUrl: downloadURL,
        diagnosis: diagnosis.name,
        confidence: diagnosis.confidence,
        treatment: diagnosis.treatment,
        timestamp: new Date(),
        status: diagnosis.name.includes('Healthy') ? 'healthy' : 'diseased'
      });

      setPrediction(diagnosis);
    } catch (error) {
      console.error('Error processing image:', error);
      setPrediction({
        name: 'Analysis Failed',
        confidence: 0,
        treatment: 'Please try again with a clearer image.'
      });
    } finally {
      setLoading(false);
    }
  };

  // Simulated AI analysis (Replace with TensorFlow.js model)
  const analyzeImage = async (file: File): Promise<any> => {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const diseases = [
      { 
        name: 'Tomato Early Blight', 
        confidence: Math.floor(Math.random() * 20) + 75, 
        treatment: 'Remove affected leaves immediately. Apply copper-based fungicide every 7-10 days. Avoid overhead watering.',
        severity: 'moderate'
      },
      { 
        name: 'Tomato Late Blight', 
        confidence: Math.floor(Math.random() * 20) + 70, 
        treatment: 'Apply fungicide containing chlorothalonil or mancozeb. Destroy severely infected plants. Improve air circulation.',
        severity: 'high'
      },
      { 
        name: 'Powdery Mildew', 
        confidence: Math.floor(Math.random() * 20) + 80, 
        treatment: 'Apply sulfur or potassium bicarbonate solution. Remove infected leaves. Ensure proper spacing between plants.',
        severity: 'low'
      },
      { 
        name: 'Bacterial Spot', 
        confidence: Math.floor(Math.random() * 20) + 65, 
        treatment: 'Apply copper-based bactericide. Avoid working with plants when wet. Use disease-free seeds.',
        severity: 'moderate'
      },
      { 
        name: 'Healthy Plant', 
        confidence: Math.floor(Math.random() * 20) + 85, 
        treatment: 'Continue regular care. Monitor for early signs. Maintain proper watering and fertilization.',
        severity: 'none'
      }
    ];
    
    return diseases[Math.floor(Math.random() * diseases.length)];
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="disease-scanner-container">
      <div className="disease-scanner-header">
        <h1>🌿 AI Plant Disease Detection</h1>
        <p className="subtitle">Upload a photo of your plant leaves for instant AI diagnosis</p>
      </div>

      <div className="upload-section">
        <div className="upload-card">
          <div className="upload-icon">📸</div>
          <h3>Upload Leaf Photo</h3>
          <p className="upload-hint">Clear, well-lit photos work best. Focus on affected leaves.</p>
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageUpload}
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
          />
          
          <button onClick={triggerFileInput} className="upload-button" disabled={loading}>
            {loading ? 'Processing...' : 'Select Image'}
          </button>
          
          <p className="supported-formats">Supports: JPG, PNG, WebP (Max 5MB)</p>
        </div>

        {image && (
          <div className="image-preview-section">
            <h4>Image Preview</h4>
            <div className="image-preview">
              <img src={image} alt="Uploaded plant leaf" />
            </div>
          </div>
        )}
      </div>

      {loading && (
        <div className="loading-section">
          <div className="spinner"></div>
          <p>Analyzing image with AI...</p>
          <p className="loading-detail">Comparing against 10,000+ disease patterns</p>
        </div>
      )}

      {prediction && !loading && (
        <div className="results-section">
          <div className={`result-card ${prediction.name.includes('Healthy') ? 'healthy' : 'diseased'}`}>
            <div className="result-header">
              <h3>📋 Diagnosis Results</h3>
              <span className={`confidence-badge ${prediction.confidence > 80 ? 'high' : 'medium'}`}>
                {prediction.confidence}% Confidence
              </span>
            </div>
            
            <div className="diagnosis-details">
              <h4 className="diagnosis-name">{prediction.name}</h4>
              
              <div className="severity-indicator">
                <span className={`severity-dot ${prediction.severity}`}></span>
                <span className="severity-text">
                  Severity: {prediction.severity.charAt(0).toUpperCase() + prediction.severity.slice(1)}
                </span>
              </div>

              <div className="treatment-plan">
                <h5>💡 Recommended Treatment Plan:</h5>
                <p>{prediction.treatment}</p>
              </div>

              <div className="action-buttons">
                <button className="action-btn primary">
                  🛒 View Recommended Products
                </button>
                <button className="action-btn secondary">
                  📅 Set Treatment Reminder
                </button>
                <button className="action-btn tertiary">
                  👥 Consult Expert
                </button>
              </div>
            </div>
          </div>

          <div className="history-note">
            <p>📝 This scan has been saved to your farm records. You can view history in your dashboard.</p>
          </div>
        </div>
      )}

      <div className="info-section">
        <h4>📋 Tips for Best Results</h4>
        <div className="tips-grid">
          <div className="tip">
            <span className="tip-icon">☀️</span>
            <p>Take photos in natural daylight</p>
          </div>
          <div className="tip">
            <span className="tip-icon">🔍</span>
            <p>Focus on affected leaves up close</p>
          </div>
          <div className="tip">
            <span className="tip-icon">📏</span>
            <p>Include healthy leaves for comparison</p>
          </div>
          <div className="tip">
            <span className="tip-icon">🌱</span>
            <p>Works best with tomatoes, potatoes, peppers</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiseaseScanner;