import React, { useState, useEffect } from 'react';

const SianGeoWidget = () => {
  const [cropData, setCropData] = useState({
    cropHealth: 85,
    soilMoisture: 42,
    irrigationNeeds: 'Moderate',
    lastScan: new Date().toLocaleDateString()
  });
  const [loading, setLoading] = useState(false);

  // Mock data fetch - will be replaced with real API call later
  const fetchCropData = async () => {
    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      setCropData({
        cropHealth: Math.floor(Math.random() * 20) + 70,
        soilMoisture: Math.floor(Math.random() * 30) + 30,
        irrigationNeeds: ['Low', 'Moderate', 'High'][Math.floor(Math.random() * 3)],
        lastScan: new Date().toLocaleDateString()
      });
    } catch (error) {
      console.error('Failed to fetch crop data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCropData();
    const interval = setInterval(fetchCropData, 300000); // Refresh every 5 minutes
    return () => clearInterval(interval);
  }, []);

  const getHealthColor = (health) => {
    if (health > 85) return '#22c55e';
    if (health > 70) return '#eab308';
    return '#dc2626';
  };

  return (
    <div style={{
      padding: '1.5rem',
      backgroundColor: '#f0fdf4',
      borderRadius: '12px',
      border: '1px solid #bbf7d0',
      marginBottom: '2rem',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <span style={{ fontSize: '2rem' }}>🌾</span>
        <div>
          <h3 style={{ margin: 0, color: '#15803d', fontSize: '1.25rem' }}>Satellite Crop Health</h3>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>Powered by SianGeo Intelligence</p>
        </div>
      </div>
      
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <MetricCard 
          label="Crop Health" 
          value={`${cropData.cropHealth}%`} 
          color={getHealthColor(cropData.cropHealth)} 
        />
        <MetricCard 
          label="Soil Moisture" 
          value={`${cropData.soilMoisture}%`} 
          color="#3b82f6" 
        />
        <MetricCard 
          label="Irrigation Needs" 
          value={cropData.irrigationNeeds} 
          color={cropData.irrigationNeeds === 'High' ? '#dc2626' : cropData.irrigationNeeds === 'Moderate' ? '#eab308' : '#22c55e'} 
        />
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: '0.8rem', color: '#666' }}>Last scan: {cropData.lastScan}</span>
        </div>
        <a 
          href="https://sian-geo-frontend.vercel.app" 
          target="_blank"
          rel="noopener noreferrer"
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#16a34a',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '6px',
            fontSize: '0.9rem',
            fontWeight: '500',
            transition: 'background-color 0.2s',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#15803d'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#16a34a'}
        >
          View Satellite View <span style={{ fontSize: '1.2rem' }}>→</span>
        </a>
      </div>
      {loading && <div style={{ textAlign: 'center', marginTop: '0.5rem', fontSize: '0.8rem', color: '#666' }}>🔄 Updating...</div>}
    </div>
  );
};

const MetricCard = ({ label, value, color }) => (
  <div style={{
    padding: '1rem',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    textAlign: 'center'
  }}>
    <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.5rem' }}>{label}</div>
    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color }}>{value}</div>
  </div>
);

export default SianGeoWidget;