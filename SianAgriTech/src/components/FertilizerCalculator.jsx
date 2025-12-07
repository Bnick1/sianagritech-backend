import React, { useState, useEffect } from 'react';
import './FertilizerCalculator.css';

const FertilizerCalculator = () => {
  // Crop database for African smallholder farmers
  const crops = [
    { id: 'maize', name: 'Maize/Corn', icon: '🌽', season: 'Main Season', duration: '90-120 days' },
    { id: 'beans', name: 'Beans', icon: '🫘', season: 'All Seasons', duration: '60-90 days' },
    { id: 'rice', name: 'Rice', icon: '🍚', season: 'Rainy Season', duration: '90-150 days' },
    { id: 'cassava', name: 'Cassava', icon: '🥔', season: 'All Seasons', duration: '9-24 months' },
    { id: 'tomato', name: 'Tomatoes', icon: '🍅', season: 'Dry Season', duration: '70-90 days' },
    { id: 'cabbage', name: 'Cabbage', icon: '🥬', season: 'Cool Season', duration: '60-100 days' },
    { id: 'potato', name: 'Potatoes', icon: '🥔', season: 'Main Season', duration: '90-120 days' },
    { id: 'sorghum', name: 'Sorghum', icon: '🌾', season: 'Main Season', duration: '100-140 days' },
    { id: 'millet', name: 'Millet', icon: '🌾', season: 'Short Rain', duration: '75-90 days' },
    { id: 'soybean', name: 'Soybeans', icon: '🫘', season: 'Main Season', duration: '100-130 days' }
  ];

  // Soil types common in Africa
  const soilTypes = [
    { id: 'loam', name: 'Loam Soil', description: 'Balanced, good for most crops' },
    { id: 'clay', name: 'Clay Soil', description: 'Heavy, retains water and nutrients' },
    { id: 'sandy', name: 'Sandy Soil', description: 'Light, drains quickly, low nutrients' },
    { id: 'laterite', name: 'Laterite Soil', description: 'Red soil, common in tropics' },
    { id: 'volcanic', name: 'Volcanic Soil', description: 'Rich in minerals, very fertile' }
  ];

  // Fertilizer types available locally
  const fertilizers = [
    { id: 'npk_17_17_17', name: 'NPK 17-17-17', type: 'Compound', N: 17, P: 17, K: 17, pricePerKg: 2.5 },
    { id: 'urea', name: 'Urea (46-0-0)', type: 'Nitrogen', N: 46, P: 0, K: 0, pricePerKg: 1.8 },
    { id: 'dap', name: 'DAP (18-46-0)', type: 'Phosphorus', N: 18, P: 46, K: 0, pricePerKg: 3.2 },
    { id: 'mop', name: 'MOP (0-0-60)', type: 'Potassium', N: 0, P: 0, K: 60, pricePerKg: 2.1 },
    { id: 'can', name: 'CAN (27-0-0)', type: 'Nitrogen', N: 27, P: 0, K: 0, pricePerKg: 2.0 },
    { id: 'organic', name: 'Organic Manure', type: 'Organic', N: 1.5, P: 1, K: 1.5, pricePerKg: 0.5 },
    { id: 'compost', name: 'Compost', type: 'Organic', N: 2, P: 1.5, K: 2, pricePerKg: 0.3 }
  ];

  // Initial state
  const [formData, setFormData] = useState({
    crop: 'maize',
    area: 1, // in acres
    soilType: 'loam',
    soilTestAvailable: false,
    soilN: 15, // ppm
    soilP: 10, // ppm
    soilK: 150, // ppm
    expectedYield: 20, // bags per acre
    budget: 5000, // in local currency
    selectedFertilizers: ['npk_17_17_17', 'organic'],
    applicationMethod: 'broadcast',
    splitApplication: true
  });

  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState([]);

  // Calculate fertilizer requirements
  const calculateRequirements = () => {
    setLoading(true);
    
    // Simulate AI calculation delay
    setTimeout(() => {
      const selectedCrop = crops.find(c => c.id === formData.crop);
      const selectedSoil = soilTypes.find(s => s.id === formData.soilType);
      const selectedFerts = fertilizers.filter(f => formData.selectedFertilizers.includes(f.id));
      
      // Crop-specific nutrient requirements (kg per acre)
      const cropRequirements = {
        maize: { N: 120, P: 60, K: 80 },
        beans: { N: 40, P: 60, K: 40 },
        rice: { N: 90, P: 50, K: 60 },
        cassava: { N: 80, P: 40, K: 100 },
        tomato: { N: 150, P: 80, K: 120 },
        cabbage: { N: 180, P: 90, K: 150 },
        potato: { N: 100, P: 60, K: 120 },
        sorghum: { N: 80, P: 40, K: 40 },
        millet: { N: 60, P: 30, K: 30 },
        soybean: { N: 30, P: 60, K: 60 }
      };

      const requirements = cropRequirements[formData.crop] || { N: 100, P: 50, K: 70 };
      
      // Adjust based on soil type
      const soilMultiplier = {
        loam: 1.0,
        clay: 0.8, // clay retains more nutrients
        sandy: 1.2, // sandy needs more
        laterite: 1.1,
        volcanic: 0.7
      };

      const multiplier = soilMultiplier[formData.soilType] || 1.0;
      
      // Adjust for soil test results if available
      let soilAdjustment = { N: 0, P: 0, K: 0 };
      if (formData.soilTestAvailable) {
        soilAdjustment = {
          N: Math.max(0, requirements.N - (formData.soilN * 2)), // Rough conversion ppm to kg
          P: Math.max(0, requirements.P - (formData.soilP * 4)),
          K: Math.max(0, requirements.K - (formData.soilK * 0.1))
        };
      }

      // Calculate final requirements
      const finalRequirements = {
        N: Math.max(0, (requirements.N * multiplier) - soilAdjustment.N),
        P: Math.max(0, (requirements.P * multiplier) - soilAdjustment.P),
        K: Math.max(0, (requirements.K * multiplier) - soilAdjustment.K)
      };

      // Calculate fertilizer mix
      let fertMix = [];
      let totalCost = 0;
      let remainingN = finalRequirements.N;
      let remainingP = finalRequirements.P;
      let remainingK = finalRequirements.K;

      // Simple algorithm to allocate fertilizers
      selectedFerts.forEach(fert => {
        const amountN = remainingN > 0 ? remainingN / (fert.N / 100) : 0;
        const amountP = remainingP > 0 ? remainingP / (fert.P / 100) : 0;
        const amountK = remainingK > 0 ? remainingK / (fert.K / 100) : 0;
        
        // Use the largest requirement this fertilizer can address
        const amount = Math.max(amountN, amountP, amountK);
        
        if (amount > 0) {
          const cost = amount * fert.pricePerKg;
          fertMix.push({
            name: fert.name,
            type: fert.type,
            amount: Math.round(amount * 10) / 10,
            cost: Math.round(cost * 10) / 10,
            supplies: {
              N: Math.round((amount * fert.N / 100) * 10) / 10,
              P: Math.round((amount * fert.P / 100) * 10) / 10,
              K: Math.round((amount * fert.K / 100) * 10) / 10
            }
          });

          totalCost += cost;
          remainingN -= fertMix[fertMix.length - 1].supplies.N;
          remainingP -= fertMix[fertMix.length - 1].supplies.P;
          remainingK -= fertMix[fertMix.length - 1].supplies.K;
        }
      });

      // Calculate per acre and total
      const perAcreCost = totalCost;
      const totalCostForArea = totalCost * formData.area;
      const costPerBag = totalCostForArea / (formData.expectedYield * formData.area);

      // Generate recommendations
      const recs = generateRecommendations(selectedCrop, selectedSoil, finalRequirements, totalCostForArea);

      setResults({
        crop: selectedCrop.name,
        area: formData.area,
        requirements: finalRequirements,
        fertilizerMix: fertMix,
        totalCost: Math.round(totalCostForArea * 100) / 100,
        perAcreCost: Math.round(perAcreCost * 100) / 100,
        costPerBag: Math.round(costPerBag * 100) / 100,
        applicationMethod: formData.applicationMethod,
        timing: getApplicationTiming(selectedCrop),
        remainingNutrients: {
          N: Math.round(remainingN * 10) / 10,
          P: Math.round(remainingP * 10) / 10,
          K: Math.round(remainingK * 10) / 10
        }
      });

      setRecommendations(recs);
      setLoading(false);
    }, 1500);
  };

  const generateRecommendations = (crop, soil, requirements, totalCost) => {
    const recs = [];
    
    // Cost optimization
    if (totalCost > formData.budget) {
      recs.push({
        type: 'warning',
        icon: '💰',
        title: 'Budget Exceeded',
        message: `Total cost ($${totalCost.toFixed(2)}) exceeds your budget ($${formData.budget}). Consider using more organic fertilizer or reducing area.`,
        action: 'Adjust budget or fertilizer mix'
      });
    }

    // Soil-specific recommendations
    if (soil.id === 'sandy') {
      recs.push({
        type: 'info',
        icon: '🏜️',
        title: 'Sandy Soil Advice',
        message: 'Sandy soil drains quickly. Use split applications and add organic matter to improve retention.',
        action: 'Apply fertilizer in 3-4 splits'
      });
    }

    if (soil.id === 'clay') {
      recs.push({
        type: 'info',
        icon: '🟤',
        title: 'Clay Soil Advice',
        message: 'Clay soil retains nutrients well. You can reduce fertilizer rates by 20%.',
        action: 'Consider 20% reduction in fertilizer'
      });
    }

    // Crop-specific recommendations
    if (crop.id === 'maize') {
      recs.push({
        type: 'success',
        icon: '🌽',
        title: 'Maize Best Practice',
        message: 'Apply 1/3 of nitrogen at planting, 1/3 at knee-high, 1/3 at tasseling.',
        action: 'Follow split application schedule'
      });
    }

    if (crop.id === 'tomato') {
      recs.push({
        type: 'success',
        icon: '🍅',
        title: 'Tomato Nutrition',
        message: 'Tomatoes need extra calcium to prevent blossom end rot. Consider adding lime.',
        action: 'Add 200kg/ha of agricultural lime'
      });
    }

    // Environmental recommendation
    recs.push({
      type: 'eco',
      icon: '🌱',
      title: 'Sustainable Farming',
      message: 'Incorporate crop residues and consider intercropping with legumes to improve soil fertility.',
      action: 'Practice crop rotation'
    });

    return recs;
  };

  const getApplicationTiming = (crop) => {
    const timing = {
      maize: ['At planting', '4 weeks after planting', '8 weeks after planting'],
      beans: ['At planting', '3 weeks after planting'],
      rice: ['Basal application', 'Tillering stage', 'Panicle initiation'],
      tomato: ['Transplanting', 'First flowering', 'First fruiting'],
      default: ['At planting', '4-6 weeks after planting']
    };
    
    return timing[crop.id] || timing.default;
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : 
              type === 'number' ? parseFloat(value) : value
    }));
  };

  const handleFertilizerToggle = (fertId) => {
    setFormData(prev => {
      const newSelection = prev.selectedFertilizers.includes(fertId)
        ? prev.selectedFertilizers.filter(id => id !== fertId)
        : [...prev.selectedFertilizers, fertId];
      return { ...prev, selectedFertilizers: newSelection };
    });
  };

  const resetCalculator = () => {
    setFormData({
      crop: 'maize',
      area: 1,
      soilType: 'loam',
      soilTestAvailable: false,
      soilN: 15,
      soilP: 10,
      soilK: 150,
      expectedYield: 20,
      budget: 5000,
      selectedFertilizers: ['npk_17_17_17', 'organic'],
      applicationMethod: 'broadcast',
      splitApplication: true
    });
    setResults(null);
    setRecommendations([]);
  };

  // Calculate on initial load
  useEffect(() => {
    calculateRequirements();
  }, []);

  return (
    <div className="fertilizer-calculator">
      <div className="calculator-header">
        <h1>🌱 AI Fertilizer Calculator</h1>
        <p className="subtitle">Optimize fertilizer use for maximum yield and minimum cost</p>
      </div>

      <div className="calculator-container">
        {/* Input Section */}
        <div className="input-section">
          <div className="input-card">
            <h3>📋 Farm Details</h3>
            
            <div className="form-group">
              <label>Select Crop</label>
              <div className="crop-grid">
                {crops.map(crop => (
                  <button
                    key={crop.id}
                    className={`crop-option ${formData.crop === crop.id ? 'selected' : ''}`}
                    onClick={() => setFormData(prev => ({ ...prev, crop: crop.id }))}
                  >
                    <span className="crop-icon">{crop.icon}</span>
                    <span className="crop-name">{crop.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="area">Farm Area (Acres)</label>
              <input
                type="range"
                id="area"
                name="area"
                min="0.1"
                max="100"
                step="0.1"
                value={formData.area}
                onChange={handleInputChange}
              />
              <div className="value-display">
                <span>{formData.area} acres</span>
                <span>≈ {Math.round(formData.area * 0.4)} hectares</span>
              </div>
            </div>

            <div className="form-group">
              <label>Soil Type</label>
              <div className="soil-grid">
                {soilTypes.map(soil => (
                  <button
                    key={soil.id}
                    className={`soil-option ${formData.soilType === soil.id ? 'selected' : ''}`}
                    onClick={() => setFormData(prev => ({ ...prev, soilType: soil.id }))}
                  >
                    <span className="soil-name">{soil.name}</span>
                    <span className="soil-desc">{soil.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="soilTestAvailable"
                  checked={formData.soilTestAvailable}
                  onChange={handleInputChange}
                />
                <span>I have soil test results</span>
              </label>
              
              {formData.soilTestAvailable && (
                <div className="soil-test-inputs">
                  <div className="soil-input">
                    <label>Nitrogen (ppm)</label>
                    <input
                      type="number"
                      name="soilN"
                      value={formData.soilN}
                      onChange={handleInputChange}
                      min="0"
                      max="100"
                    />
                  </div>
                  <div className="soil-input">
                    <label>Phosphorus (ppm)</label>
                    <input
                      type="number"
                      name="soilP"
                      value={formData.soilP}
                      onChange={handleInputChange}
                      min="0"
                      max="100"
                    />
                  </div>
                  <div className="soil-input">
                    <label>Potassium (ppm)</label>
                    <input
                      type="number"
                      name="soilK"
                      value={formData.soilK}
                      onChange={handleInputChange}
                      min="0"
                      max="500"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="expectedYield">Expected Yield (Bags/Acre)</label>
              <input
                type="range"
                id="expectedYield"
                name="expectedYield"
                min="5"
                max="50"
                step="1"
                value={formData.expectedYield}
                onChange={handleInputChange}
              />
              <div className="value-display">
                <span>{formData.expectedYield} bags/acre</span>
                <span>≈ {Math.round(formData.expectedYield * 2.47)} bags/hectare</span>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="budget">Budget (USD)</label>
              <input
                type="range"
                id="budget"
                name="budget"
                min="100"
                max="10000"
                step="100"
                value={formData.budget}
                onChange={handleInputChange}
              />
              <div className="value-display">
                <span>${formData.budget}</span>
                <span>${Math.round(formData.budget / formData.area)}/acre</span>
              </div>
            </div>

            <div className="form-group">
              <label>Fertilizer Selection</label>
              <div className="fertilizer-grid">
                {fertilizers.map(fert => (
                  <div
                    key={fert.id}
                    className={`fertilizer-option ${formData.selectedFertilizers.includes(fert.id) ? 'selected' : ''}`}
                    onClick={() => handleFertilizerToggle(fert.id)}
                  >
                    <div className="fert-header">
                      <span className="fert-name">{fert.name}</span>
                      <span className="fert-npk">{fert.N}-{fert.P}-{fert.K}</span>
                    </div>
                    <div className="fert-details">
                      <span className="fert-type">{fert.type}</span>
                      <span className="fert-price">${fert.pricePerKg}/kg</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Application Method</label>
              <select
                name="applicationMethod"
                value={formData.applicationMethod}
                onChange={handleInputChange}
                className="method-select"
              >
                <option value="broadcast">Broadcast Spreading</option>
                <option value="banding">Banding</option>
                <option value="foliar">Foliar Spray</option>
                <option value="fertigation">Fertigation</option>
              </select>
            </div>

            <div className="form-actions">
              <button 
                className="calculate-btn" 
                onClick={calculateRequirements}
                disabled={loading}
              >
                {loading ? '🔄 Calculating...' : '🧮 Calculate Recommendations'}
              </button>
              <button 
                className="reset-btn" 
                onClick={resetCalculator}
              >
                🔄 Reset
              </button>
            </div>
          </div>
        </div>

        {/* Results Section */}
        <div className="results-section">
          {loading ? (
            <div className="loading-results">
              <div className="loader"></div>
              <p>Analyzing your farm data...</p>
              <p className="loading-detail">Considering soil type, crop requirements, and local prices</p>
            </div>
          ) : results && (
            <>
              <div className="results-card">
                <div className="results-header">
                  <h3>📊 Fertilizer Recommendation</h3>
                  <div className="results-summary">
                    <span className="crop-badge">{results.crop}</span>
                    <span className="area-badge">{results.area} acres</span>
                  </div>
                </div>

                <div className="requirements-section">
                  <h4>🌾 Nutrient Requirements</h4>
                  <div className="nutrient-grid">
                    <div className="nutrient">
                      <span className="nutrient-label">Nitrogen (N)</span>
                      <span className="nutrient-value">{results.requirements.N.toFixed(1)} kg</span>
                      <div className="nutrient-bar" style={{ width: `${(results.requirements.N / 200) * 100}%` }}></div>
                    </div>
                    <div className="nutrient">
                      <span className="nutrient-label">Phosphorus (P₂O₅)</span>
                      <span className="nutrient-value">{results.requirements.P.toFixed(1)} kg</span>
                      <div className="nutrient-bar" style={{ width: `${(results.requirements.P / 100) * 100}%` }}></div>
                    </div>
                    <div className="nutrient">
                      <span className="nutrient-label">Potassium (K₂O)</span>
                      <span className="nutrient-value">{results.requirements.K.toFixed(1)} kg</span>
                      <div className="nutrient-bar" style={{ width: `${(results.requirements.K / 150) * 100}%` }}></div>
                    </div>
                  </div>
                </div>

                <div className="fertilizer-mix">
                  <h4>🧪 Recommended Fertilizer Mix</h4>
                  <div className="mix-grid">
                    {results.fertilizerMix.map((fert, index) => (
                      <div key={index} className="mix-item">
                        <div className="mix-header">
                          <span className="mix-name">{fert.name}</span>
                          <span className="mix-amount">{fert.amount} kg</span>
                        </div>
                        <div className="mix-details">
                          <div className="mix-nutrients">
                            <span>N: {fert.supplies.N}kg</span>
                            <span>P: {fert.supplies.P}kg</span>
                            <span>K: {fert.supplies.K}kg</span>
                          </div>
                          <div className="mix-cost">${fert.cost}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="cost-analysis">
                  <h4>💰 Cost Analysis</h4>
                  <div className="cost-grid">
                    <div className="cost-item">
                      <span className="cost-label">Total Cost</span>
                      <span className="cost-value">${results.totalCost}</span>
                    </div>
                    <div className="cost-item">
                      <span className="cost-label">Cost per Acre</span>
                      <span className="cost-value">${results.perAcreCost}</span>
                    </div>
                    <div className="cost-item">
                      <span className="cost-label">Cost per Bag</span>
                      <span className="cost-value">${results.costPerBag}</span>
                    </div>
                    <div className="cost-item">
                      <span className="cost-label">Budget Status</span>
                      <span className={`budget-status ${results.totalCost > formData.budget ? 'over' : 'under'}`}>
                        {results.totalCost > formData.budget ? 'Over Budget' : 'Within Budget'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="application-guide">
                  <h4>📅 Application Schedule</h4>
                  <div className="timeline">
                    {results.timing.map((stage, index) => (
                      <div key={index} className="timeline-item">
                        <div className="timeline-marker">{index + 1}</div>
                        <div className="timeline-content">
                          <span className="timeline-stage">{stage}</span>
                          <span className="timeline-method">{results.applicationMethod}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              {recommendations.length > 0 && (
                <div className="recommendations-section">
                  <h3>💡 AI Recommendations</h3>
                  <div className="recommendations-grid">
                    {recommendations.map((rec, index) => (
                      <div key={index} className={`recommendation ${rec.type}`}>
                        <div className="rec-header">
                          <span className="rec-icon">{rec.icon}</span>
                          <span className="rec-title">{rec.title}</span>
                        </div>
                        <p className="rec-message">{rec.message}</p>
                        <div className="rec-action">
                          <span className="action-label">Action:</span>
                          <span className="action-text">{rec.action}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="action-buttons">
                <button className="action-btn primary">
                  🛒 Order Fertilizers
                </button>
                <button className="action-btn secondary">
                  📅 Set Application Reminders
                </button>
                <button className="action-btn tertiary">
                  📄 Download Report
                </button>
                <button className="action-btn">
                  📱 Share with Farmer
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FertilizerCalculator;