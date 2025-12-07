import React, { useState, useEffect } from 'react';
import './InsuranceRisk.css';

const InsuranceRisk = () => {
  // Insurance products
  const insuranceProducts = [
    {
      id: 'drought_index',
      name: 'Drought Index Insurance',
      icon: '🏜️',
      coverage: 'Rainfall deficit protection',
      premiumRate: 3.5, // % of sum insured
      payoutTrigger: 'Rainfall < 80% of historical average',
      waitingPeriod: '14 days',
      maxCoverage: '$10,000/acre',
      partners: ['Pula', 'ACRE Africa', 'OKO Finance']
    },
    {
      id: 'excess_rain',
      name: 'Excess Rainfall Insurance',
      icon: '🌧️',
      coverage: 'Flood and waterlogging damage',
      premiumRate: 2.8,
      payoutTrigger: 'Rainfall > 120% of average',
      waitingPeriod: '7 days',
      maxCoverage: '$8,000/acre',
      partners: ['World Bank FCPI', 'HortiFarm']
    },
    {
      id: 'temperature',
      name: 'Temperature Index Insurance',
      icon: '🌡️',
      coverage: 'Heat stress and frost damage',
      premiumRate: 4.2,
      payoutTrigger: 'Temperature outside optimal range',
      waitingPeriod: '10 days',
      maxCoverage: '$6,000/acre',
      partners: ['SatSure', 'Skymet']
    },
    {
      id: 'yield_guarantee',
      name: 'Yield Guarantee Insurance',
      icon: '📊',
      coverage: 'Guaranteed minimum yield',
      premiumRate: 5.0,
      payoutTrigger: 'Yield < 70% of expected',
      waitingPeriod: 'Harvest period',
      maxCoverage: '$15,000/acre',
      partners: ['SianFinTech', 'AXA Climate']
    },
    {
      id: 'input_cost',
      name: 'Input Cost Insurance',
      icon: '🌱',
      coverage: 'Fertilizer and seed cost protection',
      premiumRate: 3.0,
      payoutTrigger: 'Input prices increase > 20%',
      waitingPeriod: 'Pre-planting',
      maxCoverage: '$5,000',
      partners: ['AgroCenta', 'FarmDrive']
    },
    {
      id: 'price_floors',
      name: 'Price Floor Insurance',
      icon: '💰',
      coverage: 'Minimum selling price guarantee',
      premiumRate: 4.5,
      payoutTrigger: 'Market price < agreed floor',
      waitingPeriod: 'Post-harvest',
      maxCoverage: '$12,000',
      partners: ['CropIn', 'Etherisc']
    }
  ];

  // Risk factors for assessment
  const riskFactors = [
    { id: 'rainfall', name: 'Rainfall Variability', weight: 0.25, icon: '🌧️' },
    { id: 'soil', name: 'Soil Quality', weight: 0.20, icon: '🌱' },
    { id: 'crop', name: 'Crop Type', weight: 0.15, icon: '🌽' },
    { id: 'location', name: 'Location Risk', weight: 0.15, icon: '📍' },
    { id: 'farming', name: 'Farming Practices', weight: 0.10, icon: '👨‍🌾' },
    { id: 'history', name: 'Historical Yields', weight: 0.10, icon: '📈' },
    { id: 'market', name: 'Market Access', weight: 0.05, icon: '🏪' }
  ];

  // Initial state
  const [insuranceState, setInsuranceState] = useState({
    farmerProfile: {
      name: 'John Kamau',
      location: 'Kiambu, Kenya',
      farmSize: 2.5, // acres
      mainCrop: 'maize',
      secondaryCrop: 'beans',
      farmingExperience: 8, // years
      hasIrrigation: true,
      usesImprovedSeeds: true,
      hasSoilTesting: false,
      previousClaims: 1,
      creditScore: 720
    },
    selectedProducts: ['drought_index', 'yield_guarantee'],
    coverageAmount: 5000, // USD
    coveragePeriod: '2025 Season',
    deductible: 20, // %
    paymentFrequency: 'seasonal',
    weatherDataIntegration: true,
    satelliteMonitoring: true,
    mobileClaims: true,
    premiumDiscount: 0,
    riskScore: 65
  });

  const [riskAssessment, setRiskAssessment] = useState(null);
  const [premiumCalculation, setPremiumCalculation] = useState(null);
  const [lenderOffers, setLenderOffers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [simulationResults, setSimulationResults] = useState(null);
  const [selectedScenario, setSelectedScenario] = useState('normal');

  // Calculate risk assessment
  const calculateRiskAssessment = () => {
    setLoading(true);
    
    setTimeout(() => {
      const profile = insuranceState.farmerProfile;
      
      // Calculate individual risk scores (0-100, higher = better)
      const rainfallRisk = profile.location.includes('Kiambu') ? 75 : 50;
      const soilRisk = profile.hasSoilTesting ? 85 : 60;
      const cropRisk = profile.mainCrop === 'maize' ? 70 : 60;
      const locationRisk = profile.farmingExperience > 5 ? 80 : 50;
      const practiceRisk = (profile.usesImprovedSeeds ? 20 : 0) + 
                         (profile.hasIrrigation ? 30 : 0);
      const historyRisk = profile.previousClaims === 0 ? 90 : 
                         profile.previousClaims === 1 ? 70 : 50;
      const marketRisk = profile.creditScore > 700 ? 85 : 60;
      
      const totalRiskScore = Math.round(
        (rainfallRisk * 0.25) +
        (soilRisk * 0.20) +
        (cropRisk * 0.15) +
        (locationRisk * 0.15) +
        (practiceRisk * 0.10) +
        (historyRisk * 0.10) +
        (marketRisk * 0.05)
      );
      
      const assessment = {
        factors: [
          { id: 'rainfall', score: rainfallRisk, status: rainfallRisk > 70 ? 'low' : rainfallRisk > 50 ? 'medium' : 'high' },
          { id: 'soil', score: soilRisk, status: soilRisk > 70 ? 'low' : soilRisk > 50 ? 'medium' : 'high' },
          { id: 'crop', score: cropRisk, status: cropRisk > 70 ? 'low' : cropRisk > 50 ? 'medium' : 'high' },
          { id: 'location', score: locationRisk, status: locationRisk > 70 ? 'low' : locationRisk > 50 ? 'medium' : 'high' },
          { id: 'farming', score: practiceRisk, status: practiceRisk > 70 ? 'low' : practiceRisk > 50 ? 'medium' : 'high' },
          { id: 'history', score: historyRisk, status: historyRisk > 70 ? 'low' : historyRisk > 50 ? 'medium' : 'high' },
          { id: 'market', score: marketRisk, status: marketRisk > 70 ? 'low' : marketRisk > 50 ? 'medium' : 'high' }
        ],
        overallScore: totalRiskScore,
        riskLevel: totalRiskScore > 75 ? 'Low Risk' : 
                  totalRiskScore > 60 ? 'Medium Risk' : 'High Risk',
        recommendations: generateRiskRecommendations(totalRiskScore, profile)
      };
      
      setRiskAssessment(assessment);
      
      // Update premium based on risk score
      const discount = calculatePremiumDiscount(totalRiskScore);
      setInsuranceState(prev => ({ ...prev, riskScore: totalRiskScore, premiumDiscount: discount }));
      
      calculatePremiums(totalRiskScore, discount);
      generateLenderOffers(totalRiskScore);
      runRiskSimulation();
      
      setLoading(false);
    }, 1500);
  };

  const calculatePremiumDiscount = (riskScore) => {
    if (riskScore > 80) return 25;
    if (riskScore > 70) return 15;
    if (riskScore > 60) return 5;
    return 0;
  };

  const calculatePremiums = (riskScore, discount) => {
    const selected = insuranceProducts.filter(p => 
      insuranceState.selectedProducts.includes(p.id)
    );
    
    const calculations = selected.map(product => {
      const basePremium = (insuranceState.coverageAmount * product.premiumRate) / 100;
      const discountedPremium = basePremium * (1 - discount / 100);
      const partnerDiscount = 10; // Partner discount %
      const finalPremium = discountedPremium * (1 - partnerDiscount / 100);
      
      return {
        product: product.name,
        coverage: insuranceState.coverageAmount,
        basePremium: Math.round(basePremium * 100) / 100,
        riskDiscount: `${discount}%`,
        partnerDiscount: `${partnerDiscount}%`,
        finalPremium: Math.round(finalPremium * 100) / 100,
        payoutTrigger: product.payoutTrigger,
        waitingPeriod: product.waitingPeriod,
        partners: product.partners
      };
    });
    
    const totalPremium = calculations.reduce((sum, calc) => sum + calc.finalPremium, 0);
    
    setPremiumCalculation({
      products: calculations,
      totalPremium: Math.round(totalPremium * 100) / 100,
      premiumPerAcre: Math.round(totalPremium / insuranceState.farmerProfile.farmSize * 100) / 100,
      coveragePerAcre: Math.round(insuranceState.coverageAmount / insuranceState.farmerProfile.farmSize * 100) / 100,
      lossRatio: '65%', // Historical loss ratio
      claimsSettlement: '15 days average'
    });
  };

  const generateLenderOffers = (riskScore) => {
    const offers = [
      {
        lender: 'SianFinTech',
        loanAmount: insuranceState.coverageAmount * 2,
        interestRate: riskScore > 70 ? '8%' : riskScore > 60 ? '12%' : '18%',
        term: '12 months',
        collateral: 'Insurance Policy',
        processingFee: '1.5%',
        approvalTime: '24 hours',
        features: ['Insurance-linked', 'Grace period', 'Flexible repayment'],
        eligibility: riskScore > 60 ? 'Approved' : 'Conditional'
      },
      {
        lender: 'Equity Bank Agri',
        loanAmount: insuranceState.coverageAmount * 1.5,
        interestRate: riskScore > 75 ? '9%' : riskScore > 65 ? '13%' : 'Not eligible',
        term: '10 months',
        collateral: 'Crop lien',
        processingFee: '2%',
        approvalTime: '48 hours',
        features: ['Weather-indexed', 'Input financing', 'Harvest advance'],
        eligibility: riskScore > 65 ? 'Approved' : 'Not eligible'
      },
      {
        lender: 'ACRE Africa (Insured Loan)',
        loanAmount: insuranceState.coverageAmount * 3,
        interestRate: '11%',
        term: '14 months',
        collateral: 'None (Insurance covered)',
        processingFee: '1%',
        approvalTime: '72 hours',
        features: ['Full insurance', 'Technical support', 'Market access'],
        eligibility: riskScore > 55 ? 'Approved' : 'Conditional'
      }
    ];
    
    setLenderOffers(offers);
  };

  const generateRiskRecommendations = (riskScore, profile) => {
    const recommendations = [];
    
    if (!profile.hasSoilTesting) {
      recommendations.push({
        type: 'improvement',
        icon: '🧪',
        title: 'Soil Testing',
        impact: 'Reduce premium by 15%',
        cost: '$75',
        roi: '2x in first season'
      });
    }
    
    if (!profile.hasIrrigation && riskScore < 70) {
      recommendations.push({
        type: 'improvement',
        icon: '💧',
        title: 'Drip Irrigation',
        impact: 'Reduce drought risk by 40%',
        cost: '$350/acre',
        roi: '3x in 2 seasons'
      });
    }
    
    if (profile.previousClaims > 0) {
      recommendations.push({
        type: 'mitigation',
        icon: '📋',
        title: 'Claim Prevention Training',
        impact: 'Reduce future claims by 30%',
        cost: 'Free',
        roi: 'Immediate'
      });
    }
    
    if (riskScore < 65) {
      recommendations.push({
        type: 'product',
        icon: '🛡️',
        title: 'Add Excess Rainfall Cover',
        impact: 'Complete risk coverage',
        cost: '+$120/year',
        benefit: 'Full season protection'
      });
    }
    
    return recommendations;
  };

  const runRiskSimulation = () => {
    const scenarios = [
      {
        id: 'drought',
        name: 'Severe Drought',
        probability: '15%',
        rainfall: '-50%',
        yieldImpact: '-65%',
        insurancePayout: '$3,250',
        loanDefaultRisk: 'High → Low with insurance'
      },
      {
        id: 'normal',
        name: 'Normal Season',
        probability: '60%',
        rainfall: '±10%',
        yieldImpact: '±5%',
        insurancePayout: '$0',
        loanDefaultRisk: 'Low'
      },
      {
        id: 'excess_rain',
        name: 'Excess Rainfall',
        probability: '20%',
        rainfall: '+40%',
        yieldImpact: '-30%',
        insurancePayout: '$1,800',
        loanDefaultRisk: 'Medium → Low with insurance'
      },
      {
        id: 'pest_outbreak',
        name: 'Pest Outbreak',
        probability: '5%',
        rainfall: 'Normal',
        yieldImpact: '-40%',
        insurancePayout: '$2,000',
        loanDefaultRisk: 'High → Medium with insurance'
      }
    ];
    
    setSimulationResults(scenarios);
  };

  const handleProfileUpdate = (field, value) => {
    setInsuranceState(prev => ({
      ...prev,
      farmerProfile: {
        ...prev.farmerProfile,
        [field]: value
      }
    }));
  };

  const toggleProduct = (productId) => {
    setInsuranceState(prev => {
      const newProducts = prev.selectedProducts.includes(productId)
        ? prev.selectedProducts.filter(id => id !== productId)
        : [...prev.selectedProducts, productId];
      return { ...prev, selectedProducts: newProducts };
    });
  };

  const purchaseInsurance = () => {
    setLoading(true);
    
    setTimeout(() => {
      alert(`Insurance purchased successfully! Policy number: INS${Date.now().toString().slice(-8)}\nTotal Premium: $${premiumCalculation?.totalPremium}\nCoverage activated immediately.`);
      setLoading(false);
    }, 2000);
  };

  const applyForLoan = (lender) => {
    alert(`Loan application submitted to ${lender}!\nApplication ID: LOAN${Date.now().toString().slice(-8)}\nYou will receive a decision within 24 hours.`);
  };

  // Initialize calculations
  useEffect(() => {
    calculateRiskAssessment();
  }, []);

  const formatCurrency = (amount) => {
    return `$${amount.toLocaleString()}`;
  };

  return (
    <div className="insurance-risk">
      <div className="insurance-header">
        <h1>🛡️ Agricultural Insurance & Risk Management</h1>
        <p className="subtitle">Protect your farm, unlock credit, and manage risks with AI-powered insurance</p>
      </div>

      <div className="insurance-container">
        {/* Left Panel - Farmer Profile & Products */}
        <div className="left-panel">
          {/* Farmer Profile Card */}
          <div className="profile-card">
            <div className="profile-header">
              <h3>👨‍🌾 Farmer Profile</h3>
              <div className="risk-badge">
                <span className="risk-level">{riskAssessment?.riskLevel || 'Calculating...'}</span>
                <span className="risk-score">Score: {insuranceState.riskScore}/100</span>
              </div>
            </div>
            
            <div className="profile-details">
              <div className="profile-row">
                <span className="profile-label">Name:</span>
                <span className="profile-value">{insuranceState.farmerProfile.name}</span>
              </div>
              <div className="profile-row">
                <span className="profile-label">Location:</span>
                <span className="profile-value">{insuranceState.farmerProfile.location}</span>
              </div>
              <div className="profile-row">
                <span className="profile-label">Farm Size:</span>
                <span className="profile-value">{insuranceState.farmerProfile.farmSize} acres</span>
              </div>
              <div className="profile-row">
                <span className="profile-label">Main Crop:</span>
                <span className="profile-value">
                  <select 
                    value={insuranceState.farmerProfile.mainCrop}
                    onChange={(e) => handleProfileUpdate('mainCrop', e.target.value)}
                    className="profile-select"
                  >
                    <option value="maize">Maize</option>
                    <option value="beans">Beans</option>
                    <option value="tomatoes">Tomatoes</option>
                    <option value="coffee">Coffee</option>
                    <option value="tea">Tea</option>
                  </select>
                </span>
              </div>
              <div className="profile-row">
                <span className="profile-label">Experience:</span>
                <span className="profile-value">
                  <input 
                    type="range"
                    min="0"
                    max="30"
                    value={insuranceState.farmerProfile.farmingExperience}
                    onChange={(e) => handleProfileUpdate('farmingExperience', parseInt(e.target.value))}
                    className="experience-slider"
                  />
                  <span>{insuranceState.farmerProfile.farmingExperience} years</span>
                </span>
              </div>
              <div className="profile-features">
                <label className="feature-checkbox">
                  <input
                    type="checkbox"
                    checked={insuranceState.farmerProfile.hasIrrigation}
                    onChange={(e) => handleProfileUpdate('hasIrrigation', e.target.checked)}
                  />
                  <span>💧 Irrigation System</span>
                </label>
                <label className="feature-checkbox">
                  <input
                    type="checkbox"
                    checked={insuranceState.farmerProfile.usesImprovedSeeds}
                    onChange={(e) => handleProfileUpdate('usesImprovedSeeds', e.target.checked)}
                  />
                  <span>🌱 Improved Seeds</span>
                </label>
                <label className="feature-checkbox">
                  <input
                    type="checkbox"
                    checked={insuranceState.farmerProfile.hasSoilTesting}
                    onChange={(e) => handleProfileUpdate('hasSoilTesting', e.target.checked)}
                  />
                  <span>🧪 Soil Testing</span>
                </label>
              </div>
            </div>
            
            <button 
              className="update-profile-btn"
              onClick={calculateRiskAssessment}
              disabled={loading}
            >
              {loading ? '🔄 Updating...' : '📊 Update Risk Assessment'}
            </button>
          </div>

          {/* Insurance Products Card */}
          <div className="products-card">
            <h3>🛡️ Select Insurance Products</h3>
            <p className="card-subtitle">Choose coverage based on your specific risks</p>
            
            <div className="coverage-slider">
              <label>Coverage Amount: {formatCurrency(insuranceState.coverageAmount)}</label>
              <input
                type="range"
                min="1000"
                max="20000"
                step="500"
                value={insuranceState.coverageAmount}
                onChange={(e) => setInsuranceState(prev => ({ ...prev, coverageAmount: parseInt(e.target.value) }))}
                className="coverage-range"
              />
              <div className="slider-labels">
                <span>$1,000</span>
                <span>$10,000</span>
                <span>$20,000</span>
              </div>
            </div>
            
            <div className="products-grid">
              {insuranceProducts.map(product => (
                <div 
                  key={product.id}
                  className={`product-card ${insuranceState.selectedProducts.includes(product.id) ? 'selected' : ''}`}
                  onClick={() => toggleProduct(product.id)}
                >
                  <div className="product-icon">{product.icon}</div>
                  <div className="product-info">
                    <h4 className="product-name">{product.name}</h4>
                    <p className="product-coverage">{product.coverage}</p>
                    <div className="product-premium">
                      <span className="premium-rate">{product.premiumRate}% premium</span>
                      <span className="max-coverage">{product.maxCoverage}</span>
                    </div>
                    <div className="product-trigger">
                      <span className="trigger-label">Payout:</span>
                      <span className="trigger-value">{product.payoutTrigger}</span>
                    </div>
                    <div className="product-partners">
                      {product.partners.slice(0, 2).map((partner, index) => (
                        <span key={index} className="partner-tag">{partner}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="smart-features">
              <h4>🚀 Smart Features</h4>
              <div className="features-grid">
                <label className="feature-toggle">
                  <input
                    type="checkbox"
                    checked={insuranceState.weatherDataIntegration}
                    onChange={(e) => setInsuranceState(prev => ({ ...prev, weatherDataIntegration: e.target.checked }))}
                  />
                  <span>🌤️ Automatic Weather Data</span>
                  <span className="feature-desc">Real-time triggers</span>
                </label>
                <label className="feature-toggle">
                  <input
                    type="checkbox"
                    checked={insuranceState.satelliteMonitoring}
                    onChange={(e) => setInsuranceState(prev => ({ ...prev, satelliteMonitoring: e.target.checked }))}
                  />
                  <span>🛰️ Satellite Monitoring</span>
                  <span className="feature-desc">NDVI-based claims</span>
                </label>
                <label className="feature-toggle">
                  <input
                    type="checkbox"
                    checked={insuranceState.mobileClaims}
                    onChange={(e) => setInsuranceState(prev => ({ ...prev, mobileClaims: e.target.checked }))}
                  />
                  <span>📱 Mobile Claims</span>
                  <span className="feature-desc">Instant submission</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Middle Panel - Risk Assessment & Premiums */}
        <div className="middle-panel">
          {loading ? (
            <div className="loading-assessment">
              <div className="loader"></div>
              <p>Analyzing your farm risks...</p>
              <p className="loading-detail">Checking weather patterns, soil data, and historical yields</p>
            </div>
          ) : (
            <>
              {/* Risk Assessment Card */}
              <div className="risk-assessment-card">
                <div className="assessment-header">
                  <h3>📊 Risk Assessment</h3>
                  <div className="premium-discount">
                    <span className="discount-label">Premium Discount:</span>
                    <span className="discount-value">{insuranceState.premiumDiscount}%</span>
                  </div>
                </div>
                
                <div className="risk-score-display">
                  <div className="score-circle">
                    <div className="score-value">{insuranceState.riskScore}</div>
                    <div className="score-label">Risk Score</div>
                  </div>
                  
                  <div className="risk-factors">
                    {riskAssessment?.factors.map(factor => (
                      <div key={factor.id} className="risk-factor">
                        <div className="factor-header">
                          <span className="factor-icon">
                            {riskFactors.find(f => f.id === factor.id)?.icon}
                          </span>
                          <span className="factor-name">
                            {riskFactors.find(f => f.id === factor.id)?.name}
                          </span>
                          <span className={`factor-score ${factor.status}`}>
                            {factor.score}/100
                          </span>
                        </div>
                        <div className="factor-bar">
                          <div 
                            className={`bar-fill ${factor.status}`}
                            style={{ width: `${factor.score}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Risk Recommendations */}
                {riskAssessment?.recommendations.length > 0 && (
                  <div className="risk-recommendations">
                    <h4>💡 Risk Improvement Recommendations</h4>
                    <div className="recommendations-grid">
                      {riskAssessment.recommendations.map((rec, index) => (
                        <div key={index} className="recommendation">
                          <div className="rec-icon">{rec.icon}</div>
                          <div className="rec-content">
                            <div className="rec-title">{rec.title}</div>
                            <div className="rec-impact">Impact: {rec.impact}</div>
                            <div className="rec-cost">Cost: {rec.cost} • ROI: {rec.roi}</div>
                          </div>
                          <button className="apply-rec-btn">
                            Apply
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Premium Calculation Card */}
              {premiumCalculation && (
                <div className="premium-card">
                  <div className="premium-header">
                    <h3>💰 Premium Calculation</h3>
                    <button 
                      className="purchase-btn"
                      onClick={purchaseInsurance}
                      disabled={loading}
                    >
                      {loading ? 'Processing...' : '🛒 Purchase Insurance'}
                    </button>
                  </div>
                  
                  <div className="premium-summary">
                    <div className="summary-row">
                      <span className="summary-label">Total Coverage:</span>
                      <span className="summary-value">{formatCurrency(insuranceState.coverageAmount)}</span>
                    </div>
                    <div className="summary-row">
                      <span className="summary-label">Coverage per Acre:</span>
                      <span className="summary-value">{formatCurrency(premiumCalculation.coveragePerAcre)}</span>
                    </div>
                    <div className="summary-row">
                      <span className="summary-label">Total Premium:</span>
                      <span className="summary-value total-premium">
                        {formatCurrency(premiumCalculation.totalPremium)}
                        <span className="premium-savings">Save {insuranceState.premiumDiscount}%</span>
                      </span>
                    </div>
                    <div className="summary-row">
                      <span className="summary-label">Premium per Acre:</span>
                      <span className="summary-value">{formatCurrency(premiumCalculation.premiumPerAcre)}</span>
                    </div>
                  </div>
                  
                  <div className="premium-breakdown">
                    <h4>📋 Premium Breakdown</h4>
                    <div className="breakdown-list">
                      {premiumCalculation.products.map((product, index) => (
                        <div key={index} className="breakdown-item">
                          <div className="product-name">{product.product}</div>
                          <div className="product-premium">
                            <span className="base-premium">${product.basePremium}</span>
                            <span className="discounts">-{product.riskDiscount}, -{product.partnerDiscount}</span>
                            <span className="final-premium">${product.finalPremium}</span>
                          </div>
                          <div className="product-details">
                            <span className="payout-trigger">Trigger: {product.payoutTrigger}</span>
                            <span className="partners">Partners: {product.partners.join(', ')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="insurance-stats">
                    <div className="stat">
                      <span className="stat-label">Historical Loss Ratio</span>
                      <span className="stat-value">{premiumCalculation.lossRatio}</span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">Claims Settlement</span>
                      <span className="stat-value">{premiumCalculation.claimsSettlement}</span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">Policy Activation</span>
                      <span className="stat-value">Immediate</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Risk Simulation Card */}
              {simulationResults && (
                <div className="simulation-card">
                  <h3>🎮 Risk Simulation</h3>
                  <p className="card-subtitle">See how insurance protects you in different scenarios</p>
                  
                  <div className="scenario-tabs">
                    {simulationResults.map(scenario => (
                      <button
                        key={scenario.id}
                        className={`scenario-tab ${selectedScenario === scenario.id ? 'active' : ''}`}
                        onClick={() => setSelectedScenario(scenario.id)}
                      >
                        {scenario.name}
                      </button>
                    ))}
                  </div>
                  
                  {simulationResults.map(scenario => (
                    selectedScenario === scenario.id && (
                      <div key={scenario.id} className="scenario-details">
                        <div className="scenario-header">
                          <span className="scenario-probability">Probability: {scenario.probability}</span>
                          <span className="scenario-impact">Yield Impact: {scenario.yieldImpact}</span>
                        </div>
                        
                        <div className="scenario-comparison">
                          <div className="comparison-column">
                            <h5>📉 Without Insurance</h5>
                            <div className="comparison-item">
                              <span className="item-label">Financial Loss:</span>
                              <span className="item-value loss">{formatCurrency(insuranceState.coverageAmount * 0.65)}</span>
                            </div>
                            <div className="comparison-item">
                              <span className="item-label">Loan Default Risk:</span>
                              <span className="item-value high-risk">{scenario.loanDefaultRisk.split('→')[0]}</span>
                            </div>
                            <div className="comparison-item">
                              <span className="item-label">Recovery Time:</span>
                              <span className="item-value">2-3 seasons</span>
                            </div>
                          </div>
                          
                          <div className="comparison-column">
                            <h5>🛡️ With Insurance</h5>
                            <div className="comparison-item">
                              <span className="item-label">Insurance Payout:</span>
                              <span className="item-value payout">{scenario.insurancePayout}</span>
                            </div>
                            <div className="comparison-item">
                              <span className="item-label">Loan Default Risk:</span>
                              <span className="item-value low-risk">{scenario.loanDefaultRisk.split('→')[1]}</span>
                            </div>
                            <div className="comparison-item">
                              <span className="item-label">Recovery Time:</span>
                              <span className="item-value">Immediate</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="scenario-insight">
                          💡 <strong>Insight:</strong> Insurance reduces your loan default risk from 
                          <span className="risk-change"> {scenario.loanDefaultRisk.split('→')[0]} to {scenario.loanDefaultRisk.split('→')[1]}</span>
                          , making you more attractive to lenders.
                        </div>
                      </div>
                    )
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Right Panel - Lender Offers */}
        <div className="right-panel">
          <div className="lender-offers-card">
            <div className="offers-header">
              <h3>🏦 Loan Offers with Insurance</h3>
              <p className="offers-subtitle">Better rates with insured collateral</p>
            </div>
            
            {lenderOffers.length === 0 ? (
              <div className="no-offers">
                <div className="no-offers-icon">🏦</div>
                <p>Complete risk assessment to see loan offers</p>
              </div>
            ) : (
              <>
                <div className="offers-list">
                  {lenderOffers.map((offer, index) => (
                    <div key={index} className={`lender-offer ${offer.eligibility === 'Not eligible' ? 'ineligible' : ''}`}>
                      <div className="offer-header">
                        <span className="lender-name">{offer.lender}</span>
                        <span className={`eligibility-badge ${offer.eligibility.toLowerCase().replace(' ', '-')}`}>
                          {offer.eligibility}
                        </span>
                      </div>
                      
                      <div className="offer-details">
                        <div className="offer-amount">
                          <span className="amount-label">Loan Amount:</span>
                          <span className="amount-value">{formatCurrency(offer.loanAmount)}</span>
                        </div>
                        <div className="offer-interest">
                          <span className="interest-label">Interest Rate:</span>
                          <span className="interest-value">{offer.interestRate}</span>
                        </div>
                        <div className="offer-term">
                          <span className="term-label">Term:</span>
                          <span className="term-value">{offer.term}</span>
                        </div>
                        <div className="offer-collateral">
                          <span className="collateral-label">Collateral:</span>
                          <span className="collateral-value">{offer.collateral}</span>
                        </div>
                      </div>
                      
                      <div className="offer-features">
                        {offer.features.map((feature, fIndex) => (
                          <span key={fIndex} className="feature-tag">{feature}</span>
                        ))}
                      </div>
                      
                      <div className="offer-footer">
                        <div className="offer-meta">
                          <span className="meta-item">Fee: {offer.processingFee}</span>
                          <span className="meta-item">Approval: {offer.approvalTime}</span>
                        </div>
                        <button 
                          className="apply-loan-btn"
                          onClick={() => applyForLoan(offer.lender)}
                          disabled={offer.eligibility === 'Not eligible'}
                        >
                          {offer.eligibility === 'Not eligible' ? 'Not Eligible' : 'Apply Now'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="lender-benefits">
                  <h4>🎯 Benefits of Insured Loans</h4>
                  <div className="benefits-list">
                    <div className="benefit">
                      <span className="benefit-icon">📉</span>
                      <span className="benefit-text">Lower interest rates (up to 50% reduction)</span>
                    </div>
                    <div className="benefit">
                      <span className="benefit-icon">🛡️</span>
                      <span className="benefit-text">Reduced collateral requirements</span>
                    </div>
                    <div className="benefit">
                      <span className="benefit-icon">⚡</span>
                      <span className="benefit-text">Faster approval process</span>
                    </div>
                    <div className="benefit">
                      <span className="benefit-icon">🔄</span>
                      <span className="benefit-text">Flexible repayment during bad seasons</span>
                    </div>
                  </div>
                </div>
                
                <div className="insurance-impact">
                  <h4>📈 Insurance Impact on Credit</h4>
                  <div className="impact-metrics">
                    <div className="metric">
                      <span className="metric-label">Default Rate Reduction</span>
                      <span className="metric-value">65%</span>
                    </div>
                    <div className="metric">
                      <span className="metric-label">Loan Approval Increase</span>
                      <span className="metric-value">40%</span>
                    </div>
                    <div className="metric">
                      <span className="metric-label">Interest Rate Reduction</span>
                      <span className="metric-value">6-8%</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
          
          {/* Claims Process Card */}
          <div className="claims-card">
            <h3>⚡ Smart Claims Process</h3>
            <div className="claims-steps">
              <div className="claim-step">
                <div className="step-number">1</div>
                <div className="step-content">
                  <span className="step-title">Automatic Trigger</span>
                  <span className="step-desc">Weather/satellite data triggers claim automatically</span>
                </div>
              </div>
              <div className="claim-step">
                <div className="step-number">2</div>
                <div className="step-content">
                  <span className="step-title">AI Verification</span>
                  <span className="step-desc">Satellite imagery and IoT data verify damage</span>
                </div>
              </div>
              <div className="claim-step">
                <div className="step-number">3</div>
                <div className="step-content">
                  <span className="step-title">Mobile Notification</span>
                  <span className="step-desc">You receive claim notification on phone</span>
                </div>
              </div>
              <div className="claim-step">
                <div className="step-number">4</div>
                <div className="step-content">
                  <span className="step-title">Instant Payout</span>
                  <span className="step-desc">Money sent to mobile wallet within 72 hours</span>
                </div>
              </div>
            </div>
            
            <div className="claims-stats">
              <div className="claim-stat">
                <span className="stat-value">72h</span>
                <span className="stat-label">Average Payout</span>
              </div>
              <div className="claim-stat">
                <span className="stat-value">95%</span>
                <span className="stat-label">Claim Accuracy</span>
              </div>
              <div className="claim-stat">
                <span className="stat-value">$0</span>
                <span className="stat-label">Paperwork</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InsuranceRisk;