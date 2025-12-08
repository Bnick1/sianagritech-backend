// src/App.jsx
import { useState } from 'react';
import './App.css';
import DiseaseScanner from './components/DiseaseScanner';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="sian-agritech-app">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="logo-section">
            <h1 className="app-title">🌿 SianAgriTech</h1>
            <p className="app-subtitle">Smart Farming, Smarter Harvests</p>
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
              🔬 Disease Detection
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
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="app-main">
        {activeTab === 'dashboard' && (
          <div className="dashboard">
            <h2>Farm Dashboard</h2>
            <div className="dashboard-grid">
              <div className="metric-card">
                <h3>🌡️ Temperature</h3>
                <p className="metric-value">27.3°C</p>
                <p className="metric-source">ThingSpeak Channel 2987883</p>
              </div>
              <div className="metric-card">
                <h3>💧 Soil Moisture</h3>
                <p className="metric-value">47.75%</p>
                <p className="metric-source">Optimal Range: 40-60%</p>
              </div>
              <div className="metric-card">
                <h3>🌤️ Humidity</h3>
                <p className="metric-value">31.97% RH</p>
                <p className="metric-source">Field Station #1</p>
              </div>
              <div className="metric-card">
                <h3>🔆 Light Intensity</h3>
                <p className="metric-value">350 lux</p>
                <p className="metric-source">Photosynthesis Active</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'disease' && <DiseaseScanner />}
        
        {activeTab === 'fertilizer' && (
          <div className="coming-soon">
            <h2>Fertilizer Recommendation Engine</h2>
            <p>Coming soon - Soil analysis + AI recommendations</p>
          </div>
        )}
        
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

      {/* Footer */}
      <footer className="app-footer">
        <p>© 2025 Sian Technologies | AgriTech + FinTech Integration</p>
        <p>Real-time IoT Monitoring • AI-Powered Insights • Sustainable Farming</p>
      </footer>
    </div>
  );
}

export default App;