// src/components/CreditScoreWidget.jsx
import React, { useState, useEffect } from 'react';

const CreditScoreWidget = ({ farmId = 'TEST001' }) => {
  const [creditData, setCreditData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [apiUrl, setApiUrl] = useState(null);

  // List of possible API endpoints (fallback order)
  const API_ENDPOINTS = [
    `https://api.siangeo.siantechnologies.tech/api/credit/score/${farmId}`,
    `https://siangeo-api.onrender.com/api/credit/score/${farmId}`,
    `https://sian-geo-api.vercel.app/api/credit/score/${farmId}`,
    `http://localhost:3000/api/credit/score/${farmId}`
  ];

  useEffect(() => {
    fetchCreditScoreWithFallback();
    const interval = setInterval(fetchCreditScoreWithFallback, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [farmId]);

  const fetchCreditScoreWithFallback = async () => {
    setLoading(true);
    
    for (let i = 0; i < API_ENDPOINTS.length; i++) {
      const url = API_ENDPOINTS[i];
      try {
        console.log(`Attempting to fetch credit score from: ${url}`);
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          mode: 'cors',
          signal: AbortSignal.timeout(10000) // 10 second timeout
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            setCreditData(result.data);
            setError(null);
            setApiUrl(url);
            console.log(`✅ Credit score fetched successfully from: ${url}`);
            setLoading(false);
            return;
          }
        }
        console.log(`❌ Failed from ${url}, trying next...`);
      } catch (err) {
        console.log(`❌ Error from ${url}: ${err.message}`);
      }
    }
    
    // All endpoints failed
    console.error('All API endpoints failed');
    setError('Unable to connect to credit service. Please try again later.');
    setLoading(false);
  };

  const fetchCreditScore = async () => {
    setLoading(true);
    setError(null);
    await fetchCreditScoreWithFallback();
  };

  if (loading) {
    return (
      <div className="metric-card credit-card" style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: 'white' }}>
        <div className="metric-header">
          <h3 style={{ color: 'white' }}>💰 Credit Score</h3>
        </div>
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <div className="spinner" style={{ width: '40px', height: '40px', margin: '0 auto 15px' }}></div>
          <p>Loading credit score...</p>
        </div>
      </div>
    );
  }

  if (error || !creditData) {
    return (
      <div className="metric-card credit-card" style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: 'white' }}>
        <div className="metric-header">
          <h3 style={{ color: 'white' }}>💰 Credit Score</h3>
        </div>
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <p>⚠️ {error || 'Credit data temporarily unavailable'}</p>
          <button 
            onClick={fetchCreditScore} 
            className="refresh-btn" 
            style={{ marginTop: '10px', background: '#22c55e', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}
          >
            🔄 Retry Connection
          </button>
          <p style={{ fontSize: '11px', marginTop: '10px', opacity: 0.6 }}>
            Demo Mode: Credit scoring will be available soon
          </p>
        </div>
      </div>
    );
  }

  const getRiskColor = () => {
    if (creditData.riskLevel === 'Low') return '#22c55e';
    if (creditData.riskLevel === 'Medium') return '#f97316';
    return '#ef4444';
  };

  const getScoreClass = () => {
    if (creditData.creditScore >= 70) return 'optimal';
    if (creditData.creditScore >= 50) return 'low';
    return 'critical';
  };

  return (
    <div className="metric-card credit-card" style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: 'white' }}>
      <div className="metric-header">
        <h3 style={{ color: 'white' }}>💰 Agricultural Credit Score</h3>
        <span className={`metric-status ${getScoreClass()}`} style={{ backgroundColor: getRiskColor(), color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>
          {creditData.riskLevel} Risk
        </span>
      </div>
      
      <div className="metric-value" style={{ fontSize: '3rem', textAlign: 'center', margin: '20px 0' }}>
        {creditData.creditScore}
        <span style={{ fontSize: '1rem', opacity: 0.7 }}>/100</span>
      </div>

      <div className="loan-eligibility" style={{ 
        background: 'rgba(255,255,255,0.1)', 
        borderRadius: '12px', 
        padding: '15px', 
        textAlign: 'center',
        marginBottom: '20px'
      }}>
        <p style={{ margin: 0, fontSize: '12px', opacity: 0.8 }}>🏦 Maximum Loan Eligibility</p>
        <p style={{ margin: '5px 0', fontSize: '20px', fontWeight: 'bold', color: '#22c55e' }}>
          UGX {creditData.maxLoanAmountUGX?.toLocaleString() || '0'}
        </p>
        <p style={{ margin: 0, fontSize: '11px', opacity: 0.6 }}>
          ≈ ${Math.round((creditData.maxLoanAmountUGX || 0) / 3700)} USD
        </p>
      </div>

      <div className="score-factors" style={{ marginBottom: '15px' }}>
        <p style={{ fontSize: '12px', opacity: 0.8, marginBottom: '10px' }}>📊 Score Breakdown</p>
        
        <div className="factor-row" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', fontSize: '11px' }}>
          <span style={{ width: '80px' }}>🌾 Farm Size</span>
          <div className="factor-bar" style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.2)', borderRadius: '3px', overflow: 'hidden' }}>
            <div className="factor-fill" style={{ width: `${((creditData.components?.areaScore || 0) / 25) * 100}%`, height: '100%', background: '#22c55e' }}></div>
          </div>
          <span style={{ width: '40px', textAlign: 'right' }}>{creditData.components?.areaScore || 0}/25</span>
        </div>
        
        <div className="factor-row" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', fontSize: '11px' }}>
          <span style={{ width: '80px' }}>🛰️ Crop Health</span>
          <div className="factor-bar" style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.2)', borderRadius: '3px', overflow: 'hidden' }}>
            <div className="factor-fill" style={{ width: `${((creditData.components?.ndviScore || 0) / 35) * 100}%`, height: '100%', background: '#22c55e' }}></div>
          </div>
          <span style={{ width: '40px', textAlign: 'right' }}>{creditData.components?.ndviScore || 0}/35</span>
        </div>
        
        <div className="factor-row" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', fontSize: '11px' }}>
          <span style={{ width: '80px' }}>📜 History</span>
          <div className="factor-bar" style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.2)', borderRadius: '3px', overflow: 'hidden' }}>
            <div className="factor-fill" style={{ width: `${((creditData.components?.historyScore || 0) / 20) * 100}%`, height: '100%', background: '#f97316' }}></div>
          </div>
          <span style={{ width: '40px', textAlign: 'right' }}>{creditData.components?.historyScore || 0}/20</span>
        </div>
        
        <div className="factor-row" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', fontSize: '11px' }}>
          <span style={{ width: '80px' }}>⚡ Stability</span>
          <div className="factor-bar" style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.2)', borderRadius: '3px', overflow: 'hidden' }}>
            <div className="factor-fill" style={{ width: `${((creditData.components?.stabilityScore || 0) / 10) * 100}%`, height: '100%', background: '#22c55e' }}></div>
          </div>
          <span style={{ width: '40px', textAlign: 'right' }}>{creditData.components?.stabilityScore || 0}/10</span>
        </div>
      </div>

      <button 
        className="apply-loan-btn" 
        onClick={() => window.open('https://fintech.siantechnologies.tech/apply', '_blank')}
        style={{
          width: '100%',
          padding: '12px',
          background: '#22c55e',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: 'bold',
          cursor: 'pointer',
          transition: 'background 0.3s'
        }}
        onMouseEnter={(e) => e.target.style.background = '#16a34a'}
        onMouseLeave={(e) => e.target.style.background = '#22c55e'}
      >
        Apply for Loan →
      </button>
      
      {apiUrl && (
        <p style={{ fontSize: '9px', opacity: 0.3, marginTop: '10px', textAlign: 'center' }}>
          Connected to credit service
        </p>
      )}
    </div>
  );
};

export default CreditScoreWidget;