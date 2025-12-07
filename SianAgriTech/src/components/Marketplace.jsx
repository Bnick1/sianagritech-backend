import React, { useState, useEffect } from 'react';
import './Marketplace.css';

const Marketplace = () => {
  // Marketplace categories with AI/Edge features
  const categories = [
    { id: 'inputs', name: 'AI-Ready Inputs', icon: '🤖', color: '#4CAF50', description: 'Smart fertilizers, IoT sensors, AI seeds' },
    { id: 'produce', name: 'Smart Produce', icon: '📱', color: '#FF5722', description: 'QR-code traced, quality-scored produce' },
    { id: 'equipment', name: 'Edge Equipment', icon: '⚡', color: '#2196F3', description: 'Solar-powered, IoT-enabled tools' },
    { id: 'services', name: 'AI Services', icon: '🧠', color: '#9C27B0', description: 'Drone scanning, soil AI analysis' },
    { id: 'finance', name: 'Smart Finance', icon: '📊', color: '#FFC107', description: 'Crop-backed loans, insurance' },
    { id: 'transport', name: 'Smart Logistics', icon: '🚚', color: '#795548', description: 'GPS tracked, temp-controlled' },
    { id: 'carbon', name: 'Carbon Credits', icon: '🌱', color: '#2E7D32', description: 'Trade carbon offsets from farming' },
    { id: 'water', name: 'Water Trading', icon: '💧', color: '#0288D1', description: 'Smart irrigation, water credits' }
  ];

  // AI-Enhanced Products Database
  const products = [
    // AI-Ready Inputs
    { 
      id: 'ai_fertilizer', 
      name: 'Smart NPK Fertilizer', 
      category: 'inputs',
      supplier: 'AgroAI Solutions',
      price: 65.00,
      unit: 'smart-bag',
      location: 'Nairobi, Kenya',
      rating: 4.8,
      reviews: 234,
      delivery: '1-2 days',
      stock: 120,
      image: '🤖',
      description: 'AI-blended fertilizer with IoT sensors that monitor soil absorption',
      tags: ['ai-optimized', 'iot-sensors', 'sustainable', 'precision-ag'],
      features: ['NFC tracking', 'Soil matching AI', 'Mobile app integration'],
      carbonScore: 85,
      waterEfficiency: '30% less water',
      aiFeatures: ['Predicts optimal application', 'Adapts to soil conditions']
    },
    { 
      id: 'iot_seeds', 
      name: 'IoT-Embedded Seeds', 
      category: 'inputs',
      supplier: 'SeedTech AI',
      price: 42.50,
      unit: 'smart-pack',
      location: 'Kampala, Uganda',
      rating: 4.9,
      reviews: 189,
      delivery: 'Same day',
      stock: 85,
      image: '🌱',
      description: 'Micro-chip embedded seeds that transmit growth data to your phone',
      tags: ['iot', 'trackable', 'drought-resistant', 'smart-farming'],
      features: ['Growth monitoring', 'Disease prediction', 'Yield optimization'],
      carbonScore: 92,
      waterEfficiency: '40% less water',
      aiFeatures: ['Predicts harvest time', 'Disease early warning']
    },
    
    // Smart Produce
    { 
      id: 'blockchain_tomatoes', 
      name: 'Blockchain-Traced Tomatoes', 
      category: 'produce',
      supplier: 'Transparent Farms Co-op',
      price: 1.80,
      unit: 'kg',
      location: 'Naivasha, Kenya',
      rating: 4.7,
      reviews: 345,
      delivery: 'Same day',
      stock: 800,
      image: '🍅',
      description: 'QR-code traced from seed to shelf with full blockchain transparency',
      tags: ['blockchain', 'organic', 'fair-trade', 'carbon-neutral'],
      features: ['Supply chain transparency', 'Carbon footprint tracking', 'Quality guarantee'],
      carbonScore: 78,
      waterEfficiency: 'Rain-fed only',
      aiFeatures: ['Quality grading AI', 'Price prediction']
    },
    
    // Edge Equipment
    { 
      id: 'solar_irrigation', 
      name: 'Solar AI Irrigation System', 
      category: 'equipment',
      supplier: 'SunFlow Technologies',
      price: 890.00,
      unit: 'system',
      location: 'Arusha, Tanzania',
      rating: 4.9,
      reviews: 156,
      delivery: '3-5 days',
      stock: 25,
      image: '☀️',
      description: 'Solar-powered drip irrigation with AI weather prediction and soil monitoring',
      tags: ['solar', 'off-grid', 'water-saving', 'ai-powered'],
      features: ['90% water savings', 'Works offline', 'Mobile control', 'Weather AI'],
      carbonScore: 95,
      waterEfficiency: '90% less water',
      aiFeatures: ['Predicts water needs', 'Weather adaptation', 'Energy optimization']
    },
    
    // AI Services
    { 
      id: 'drone_scanning', 
      name: 'Drone Field Analysis', 
      category: 'services',
      supplier: 'SkyEye Analytics',
      price: 150.00,
      unit: 'per-acre',
      location: 'Digital',
      rating: 4.8,
      reviews: 278,
      delivery: '24h report',
      stock: null,
      image: '🚁',
      description: 'AI-powered drone scanning for crop health, pest detection, and yield prediction',
      tags: ['drone', 'ai-analysis', 'precision', 'ndvi'],
      features: ['Multispectral imaging', 'Disease detection', 'Yield prediction', '3D mapping'],
      carbonScore: 88,
      waterEfficiency: 'Optimizes irrigation',
      aiFeatures: ['NDVI analysis', 'Pest detection', 'Growth modeling']
    },
    
    // Smart Finance
    { 
      id: 'crop_insurance_ai', 
      name: 'AI-Powered Crop Insurance', 
      category: 'finance',
      supplier: 'SianFinTech AI',
      price: null,
      unit: 'policy',
      location: 'Digital',
      rating: 4.9,
      reviews: 512,
      delivery: 'Instant',
      stock: null,
      image: '📈',
      description: 'Smart insurance using satellite and IoT data for automated claims',
      tags: ['ai-insurance', 'automated', 'weather-proof', 'blockchain'],
      features: ['Automatic payouts', 'Weather data integration', 'No paperwork'],
      interestRate: '6.5%',
      term: 'Seasonal',
      aiFeatures: ['Risk assessment AI', 'Automated claims', 'Yield prediction']
    },
    
    // Carbon Credits
    { 
      id: 'carbon_credits', 
      name: 'Farm Carbon Credits', 
      category: 'carbon',
      supplier: 'CarbonFarm Africa',
      price: 25.00,
      unit: 'credit',
      location: 'Pan-Africa',
      rating: 4.7,
      reviews: 189,
      delivery: 'Digital',
      stock: 5000,
      image: '🌍',
      description: 'Trade carbon offsets generated from sustainable farming practices',
      tags: ['carbon-neutral', 'sustainability', 'climate-smart', 'certified'],
      features: ['Blockchain verified', 'Real-time tracking', 'International market'],
      carbonScore: 100,
      waterEfficiency: 'Water positive',
      aiFeatures: ['Carbon calculation AI', 'Market prediction']
    }
  ];

  // Featured AI Suppliers
  const suppliers = [
    {
      id: 'agroai',
      name: 'AgroAI Solutions',
      rating: 4.9,
      products: 38,
      joined: '2023',
      verified: true,
      location: 'Nairobi Tech Hub',
      specialties: ['AI Fertilizers', 'IoT Sensors', 'Precision Agriculture'],
      aiCapability: 'Advanced',
      carbonNeutral: true,
      edgeDevices: 1500
    },
    {
      id: 'skyeye',
      name: 'SkyEye Analytics',
      rating: 4.8,
      products: 12,
      joined: '2022',
      verified: true,
      location: 'Drone Network',
      specialties: ['Drone Imaging', 'Satellite Analysis', 'AI Crop Monitoring'],
      aiCapability: 'Advanced',
      carbonNeutral: true,
      edgeDevices: 45
    },
    {
      id: 'sunflow',
      name: 'SunFlow Technologies',
      rating: 4.9,
      products: 18,
      joined: '2021',
      verified: true,
      location: 'Arusha Solar Park',
      specialties: ['Solar Irrigation', 'Water Optimization', 'Off-grid AI'],
      aiCapability: 'Intermediate',
      carbonNeutral: true,
      edgeDevices: 2800
    },
    {
      id: 'carbonfarm',
      name: 'CarbonFarm Africa',
      rating: 4.7,
      products: 8,
      joined: '2023',
      verified: true,
      location: 'Blockchain Network',
      specialties: ['Carbon Credits', 'Sustainability', 'Climate Tech'],
      aiCapability: 'Advanced',
      carbonNeutral: true,
      edgeDevices: null
    }
  ];

  // Initial state
  const [marketplaceState, setMarketplaceState] = useState({
    selectedCategory: 'all',
    searchQuery: '',
    locationFilter: '',
    priceRange: [0, 1500],
    sortBy: 'ai_score',
    cart: [],
    favorites: [],
    view: 'grid',
    aiFilter: 'all',
    sustainabilityFilter: false,
    offlineCompatible: false
  });

  const [filteredProducts, setFilteredProducts] = useState(products);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [orderSummary, setOrderSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [userBalance, setUserBalance] = useState(2450.75);
  const [userCarbonCredits, setUserCarbonCredits] = useState(125);
  const [aiRecommendations, setAiRecommendations] = useState([]);
  const [marketInsights, setMarketInsights] = useState({
    trending: [],
    priceAlerts: [],
    carbonPrices: []
  });

  // AI Recommendations based on user behavior
  useEffect(() => {
    // Simulate AI recommendations
    const recommendations = [
      {
        id: 'ai_rec_1',
        productId: 'solar_irrigation',
        reason: 'Matches your farm size and water usage patterns',
        confidence: 92,
        estimatedROI: '6 months',
        carbonImpact: '-2.5 tons CO2/year'
      },
      {
        id: 'ai_rec_2',
        productId: 'carbon_credits',
        reason: 'Your sustainable practices could generate extra income',
        confidence: 85,
        estimatedROI: 'Immediate',
        carbonImpact: '+5 credits/month'
      }
    ];
    setAiRecommendations(recommendations);
  }, []);

  // Apply AI-powered filters
  useEffect(() => {
    let result = [...products];
    
    // AI Category filter
    if (marketplaceState.selectedCategory !== 'all') {
      result = result.filter(product => product.category === marketplaceState.selectedCategory);
    }
    
    // AI Search filter
    if (marketplaceState.searchQuery) {
      const query = marketplaceState.searchQuery.toLowerCase();
      result = result.filter(product => 
        product.name.toLowerCase().includes(query) ||
        product.description.toLowerCase().includes(query) ||
        product.tags.some(tag => tag.toLowerCase().includes(query)) ||
        product.aiFeatures?.some(feature => feature.toLowerCase().includes(query))
      );
    }
    
    // AI-powered filters
    if (marketplaceState.aiFilter === 'high_ai') {
      result = result.filter(product => 
        product.aiFeatures && product.aiFeatures.length >= 2
      );
    }
    
    if (marketplaceState.sustainabilityFilter) {
      result = result.filter(product => 
        product.carbonScore >= 70 && product.waterEfficiency
      );
    }
    
    if (marketplaceState.offlineCompatible) {
      result = result.filter(product => 
        product.tags.includes('off-grid') || 
        product.features?.includes('Works offline')
      );
    }
    
    // AI-powered sorting
    result.sort((a, b) => {
      switch(marketplaceState.sortBy) {
        case 'ai_score':
          const aiScoreA = (a.aiFeatures?.length || 0) + (a.carbonScore || 0) / 100;
          const aiScoreB = (b.aiFeatures?.length || 0) + (b.carbonScore || 0) / 100;
          return aiScoreB - aiScoreA;
        case 'carbon_score':
          return (b.carbonScore || 0) - (a.carbonScore || 0);
        case 'water_efficiency':
          return b.waterEfficiency?.match(/\d+/)?.[0] - a.waterEfficiency?.match(/\d+/)?.[0];
        case 'price_low':
          return (a.price || 0) - (b.price || 0);
        case 'price_high':
          return (b.price || 0) - (a.price || 0);
        default:
          return b.rating - a.rating;
      }
    });
    
    setFilteredProducts(result);
  }, [marketplaceState]);

  // AI-Powered Recommendations
  const getAiRecommendationForProduct = (productId) => {
    return aiRecommendations.find(rec => rec.productId === productId);
  };

  // Smart Cart with AI Suggestions
  const addToCart = (product, quantity = 1) => {
    setMarketplaceState(prev => {
      const existingItem = prev.cart.find(item => item.id === product.id);
      let newCart;
      
      if (existingItem) {
        newCart = prev.cart.map(item => 
          item.id === product.id 
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      } else {
        newCart = [...prev.cart, { ...product, quantity }];
      }
      
      // AI: Check for complementary products
      if (product.category === 'equipment' && product.tags.includes('solar')) {
        showNotification(`🤖 AI Suggestion: Add IoT sensors to maximize your ${product.name}'s potential!`);
      }
      
      showNotification(`✅ Added ${quantity} ${product.unit} of ${product.name} to smart cart`);
      
      return { ...prev, cart: newCart };
    });
  };

  // Calculate Carbon Impact of Cart
  const calculateCartCarbonImpact = () => {
    return marketplaceState.cart.reduce((total, item) => {
      const carbonValue = item.carbonScore || 50;
      return total + (carbonValue * item.quantity);
    }, 0);
  };

  // Smart Checkout with AI Verification
  const placeOrder = () => {
    setLoading(true);
    
    // AI: Verify farm compatibility
    const compatibilityScore = calculateCompatibilityScore();
    
    setTimeout(() => {
      const total = calculateCartTotal();
      const carbonImpact = calculateCartCarbonImpact();
      const orderId = 'SAI-' + Date.now().toString().slice(-8);
      
      // Generate carbon credits if sustainable purchase
      const carbonCreditsEarned = marketplaceState.cart.some(item => item.carbonScore > 80) ? 5 : 0;
      
      setOrderSummary({
        orderId,
        items: [...marketplaceState.cart],
        total,
        carbonImpact,
        carbonCreditsEarned,
        estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'ai_verifying',
        paymentMethod: 'SianAI Wallet',
        aiCompatibilityScore: compatibilityScore
      });
      
      // Clear cart and update balances
      setMarketplaceState(prev => ({ ...prev, cart: [] }));
      setUserBalance(prev => prev - total);
      setUserCarbonCredits(prev => prev + carbonCreditsEarned);
      
      setLoading(false);
      showNotification(`🎉 AI-Verified Order ${orderId} placed! +${carbonCreditsEarned} carbon credits earned`);
    }, 2000);
  };

  const calculateCompatibilityScore = () => {
    // AI logic for compatibility scoring
    return Math.floor(Math.random() * 30) + 70; // 70-100%
  };

  const showNotification = (message) => {
    // Using browser notification API
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("SianAI Marketplace", { body: message });
    } else {
      alert(message);
    }
  };

  const formatPrice = (price) => {
    if (price === null) return 'AI Quote';
    return `$${price.toFixed(2)}`;
  };

  const getSustainabilityBadge = (score) => {
    if (score >= 90) return { text: '🌿 Carbon Negative', color: '#2E7D32' };
    if (score >= 80) return { text: '✅ Carbon Smart', color: '#4CAF50' };
    if (score >= 70) return { text: '🟡 Sustainable', color: '#FF9800' };
    return { text: '🔄 Improving', color: '#F44336' };
  };

  const getAIIcon = (aiFeaturesCount) => {
    if (aiFeaturesCount >= 3) return '🤖🤖🤖';
    if (aiFeaturesCount >= 2) return '🤖🤖';
    return '🤖';
  };

  return (
    <div className="marketplace">
      <div className="marketplace-header">
        <h1>🧠 SianAI Smart Marketplace</h1>
        <p className="subtitle">AI-Powered Trading • Carbon Credits • Edge Commerce • Farmer-First Design</p>
        
        <div className="user-wallet">
          <div className="wallet-card primary">
            <span className="wallet-label">AI Wallet Balance</span>
            <span className="wallet-amount">${userBalance.toFixed(2)}</span>
            <span className="wallet-source">SianAI Secure</span>
          </div>
          <div className="wallet-card carbon">
            <span className="wallet-label">Carbon Credits</span>
            <span className="wallet-amount">{userCarbonCredits} Credits</span>
            <span className="wallet-source">Worth ${(userCarbonCredits * 25).toFixed(2)}</span>
          </div>
          <div className="wallet-card edge">
            <span className="wallet-label">Edge Devices</span>
            <span className="wallet-amount">3 Connected</span>
            <span className="wallet-source">🟢 All Online</span>
          </div>
        </div>
      </div>

      <div className="marketplace-container">
        {/* AI Sidebar */}
        <div className="sidebar-filters">
          <div className="filter-card ai-enhanced">
            <div className="ai-header">
              <span className="ai-icon">🧠</span>
              <h3>AI Shopping Assistant</h3>
            </div>
            
            <div className="filter-section">
              <h4>🤖 AI Categories</h4>
              <div className="category-list">
                <button 
                  className={`category-btn ai ${marketplaceState.selectedCategory === 'all' ? 'active' : ''}`}
                  onClick={() => handleCategorySelect('all')}
                >
                  🧠 All AI Products
                </button>
                {categories.map(category => (
                  <button
                    key={category.id}
                    className={`category-btn ai ${marketplaceState.selectedCategory === category.id ? 'active' : ''}`}
                    onClick={() => handleCategorySelect(category.id)}
                    style={{ borderLeftColor: category.color }}
                    title={category.description}
                  >
                    {category.icon} {category.name}
                    <span className="category-desc">{category.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-section">
              <h4>⚡ Smart Filters</h4>
              <div className="ai-filters">
                <label className="ai-filter-checkbox">
                  <input
                    type="checkbox"
                    checked={marketplaceState.sustainabilityFilter}
                    onChange={(e) => setMarketplaceState(prev => ({ 
                      ...prev, 
                      sustainabilityFilter: e.target.checked 
                    }))}
                  />
                  <span className="checkmark"></span>
                  🌿 Sustainable Only (70+ carbon score)
                </label>
                
                <label className="ai-filter-checkbox">
                  <input
                    type="checkbox"
                    checked={marketplaceState.offlineCompatible}
                    onChange={(e) => setMarketplaceState(prev => ({ 
                      ...prev, 
                      offlineCompatible: e.target.checked 
                    }))}
                  />
                  <span className="checkmark"></span>
                  📡 Offline-Compatible
                </label>
                
                <div className="ai-intensity">
                  <span>AI Intensity:</span>
                  <select 
                    value={marketplaceState.aiFilter}
                    onChange={(e) => setMarketplaceState(prev => ({ ...prev, aiFilter: e.target.value }))}
                    className="ai-select"
                  >
                    <option value="all">All AI Products</option>
                    <option value="high_ai">🤖 High AI Integration</option>
                    <option value="edge_ai">⚡ Edge AI Capable</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="filter-section">
              <h4>📊 Sort by AI Metrics</h4>
              <div className="sort-options ai">
                <button
                  className={`sort-btn ${marketplaceState.sortBy === 'ai_score' ? 'active' : ''}`}
                  onClick={() => setMarketplaceState(prev => ({ ...prev, sortBy: 'ai_score' }))}
                >
                  🤖 AI Score
                </button>
                <button
                  className={`sort-btn ${marketplaceState.sortBy === 'carbon_score' ? 'active' : ''}`}
                  onClick={() => setMarketplaceState(prev => ({ ...prev, sortBy: 'carbon_score' }))}
                >
                  🌿 Carbon Impact
                </button>
                <button
                  className={`sort-btn ${marketplaceState.sortBy === 'water_efficiency' ? 'active' : ''}`}
                  onClick={() => setMarketplaceState(prev => ({ ...prev, sortBy: 'water_efficiency' }))}
                >
                  💧 Water Savings
                </button>
              </div>
            </div>

            <div className="filter-section">
              <h4>🎯 AI Recommendations</h4>
              <div className="ai-recommendations">
                {aiRecommendations.map(rec => {
                  const product = products.find(p => p.id === rec.productId);
                  return product ? (
                    <div key={rec.id} className="ai-rec-card">
                      <div className="ai-rec-header">
                        <span className="ai-rec-product">{product.name}</span>
                        <span className="ai-rec-confidence">{rec.confidence}% match</span>
                      </div>
                      <p className="ai-rec-reason">{rec.reason}</p>
                      <div className="ai-rec-stats">
                        <span>ROI: {rec.estimatedROI}</span>
                        <span>Carbon: {rec.carbonImpact}</span>
                      </div>
                      <button 
                        className="ai-rec-action"
                        onClick={() => addToCart(product)}
                      >
                        🤖 Add Smart
                      </button>
                    </div>
                  ) : null;
                })}
              </div>
            </div>
          </div>

          {/* AI Suppliers */}
          <div className="suppliers-card ai-enhanced">
            <div className="ai-header">
              <span className="ai-icon">🏆</span>
              <h3>Verified AI Suppliers</h3>
            </div>
            <div className="suppliers-list ai">
              {suppliers.map(supplier => (
                <div key={supplier.id} className="supplier-item ai">
                  <div className="supplier-header ai">
                    <span className="supplier-name">{supplier.name}</span>
                    <div className="ai-badges">
                      <span className="ai-badge">{supplier.aiCapability} AI</span>
                      {supplier.carbonNeutral && <span className="carbon-badge">🌿 Carbon Neutral</span>}
                      {supplier.edgeDevices && <span className="edge-badge">⚡ {supplier.edgeDevices} devices</span>}
                    </div>
                  </div>
                  <div className="supplier-details ai">
                    <span className="supplier-rating">⭐ {supplier.rating} AI-verified</span>
                    <span className="supplier-location">📡 {supplier.location}</span>
                  </div>
                  <div className="supplier-ai-specialties">
                    {supplier.specialties.map((specialty, index) => (
                      <span key={index} className="ai-specialty">{specialty}</span>
                    ))}
                  </div>
                  <button className="ai-supplier-btn">
                    🤖 View AI Products
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="main-content">
          {/* AI Search Bar */}
          <div className="search-bar-container ai">
            <div className="search-bar ai">
              <span className="search-icon ai">🤖</span>
              <input
                type="text"
                placeholder="Ask AI: Find smart products, carbon credits, or ask for recommendations..."
                value={marketplaceState.searchQuery}
                onChange={(e) => setMarketplaceState(prev => ({ ...prev, searchQuery: e.target.value }))}
                className="search-input ai"
              />
              <button className="ai-voice-search" title="Voice search">
                🎤
              </button>
              <div className="view-toggle ai">
                <button 
                  className={`view-btn ${marketplaceState.view === 'grid' ? 'active' : ''}`}
                  onClick={() => setMarketplaceState(prev => ({ ...prev, view: 'grid' }))}
                >
                  ▦ Smart Grid
                </button>
                <button 
                  className={`view-btn ${marketplaceState.view === 'list' ? 'active' : ''}`}
                  onClick={() => setMarketplaceState(prev => ({ ...prev, view: 'list' }))}
                >
                  📋 AI List
                </button>
              </div>
            </div>
            
            <div className="ai-search-suggestions">
              <span className="ai-suggestion">💡 Try: "solar irrigation for 2 acres"</span>
              <span className="ai-suggestion">💡 Try: "carbon credit sellers"</span>
              <span className="ai-suggestion">💡 Try: "off-grid AI tools"</span>
            </div>
          </div>

          {/* Products Grid/List */}
          {loading ? (
            <div className="loading-products ai">
              <div className="ai-loader">
                <div className="ai-spinner">🤖</div>
                <p>AI is analyzing products...</p>
              </div>
            </div>
          ) : (
            <>
              <div className="results-header ai">
                <h3>
                  {marketplaceState.selectedCategory === 'all' 
                    ? '🤖 AI-Enhanced Products' 
                    : categories.find(c => c.id === marketplaceState.selectedCategory)?.name}
                  <span className="results-count ai"> ({filteredProducts.length} smart products)</span>
                </h3>
                <div className="results-summary ai">
                  <span>🌿 Avg Carbon Score: {Math.round(filteredProducts.reduce((a, b) => a + (b.carbonScore || 0), 0) / filteredProducts.length) || 0}</span>
                  <span>🤖 AI Features: {filteredProducts.reduce((a, b) => a + (b.aiFeatures?.length || 0), 0)} total</span>
                </div>
              </div>

              <div className={`products-container ${marketplaceState.view} ai`}>
                {filteredProducts.slice(0, 12).map(product => {
                  const aiRec = getAiRecommendationForProduct(product.id);
                  const sustainabilityBadge = getSustainabilityBadge(product.carbonScore);
                  
                  return (
                    <div 
                      key={product.id} 
                      className="product-card ai"
                      onClick={() => setSelectedProduct(product)}
                    >
                      <div className="product-header ai">
                        <div 
                          className="product-category ai"
                          style={{ backgroundColor: categories.find(c => c.id === product.category)?.color }}
                        >
                          {categories.find(c => c.id === product.category)?.icon} 
                          <span>{categories.find(c => c.id === product.category)?.name}</span>
                        </div>
                        
                        {aiRec && (
                          <div className="ai-recommendation-badge">
                            🎯 AI Recommended ({aiRec.confidence}%)
                          </div>
                        )}
                      </div>
                      
                      <div className="product-image ai">
                        <span className="product-emoji">{product.image}</span>
                        <div className="product-ai-badges">
                          <span className="ai-feature-badge">
                            {getAIIcon(product.aiFeatures?.length || 0)}
                          </span>
                          <span 
                            className="carbon-badge"
                            style={{ backgroundColor: sustainabilityBadge.color }}
                          >
                            {sustainabilityBadge.text}
                          </span>
                        </div>
                      </div>
                      
                      <div className="product-info ai">
                        <h4 className="product-name">{product.name}</h4>
                        <p className="product-description">{product.description}</p>
                        
                        <div className="product-supplier ai">
                          <span className="supplier-name">🏢 {product.supplier}</span>
                          <span className="supplier-location">📡 {product.location}</span>
                          <span className="supplier-rating">⭐ {product.rating} AI-verified</span>
                        </div>
                        
                        <div className="product-ai-features">
                          <h5>🤖 AI Features:</h5>
                          <div className="ai-features-list">
                            {product.aiFeatures?.map((feature, index) => (
                              <span key={index} className="ai-feature">{feature}</span>
                            ))}
                          </div>
                        </div>
                        
                        <div className="product-sustainability">
                          <div className="sustainability-metric">
                            <span className="metric-label">Carbon Score:</span>
                            <span className="metric-value">{product.carbonScore || 'N/A'}</span>
                          </div>
                          <div className="sustainability-metric">
                            <span className="metric-label">Water Efficiency:</span>
                            <span className="metric-value">{product.waterEfficiency || 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="product-footer ai">
                        <div className="product-price ai">
                          <span className="price-amount">{formatPrice(product.price)}</span>
                          <span className="price-unit">per {product.unit}</span>
                          {product.carbonScore >= 80 && (
                            <span className="carbon-credit-bonus">+2 carbon credits</span>
                          )}
                        </div>
                        
                        <div className="product-actions ai">
                          <button 
                            className="add-to-cart-btn ai"
                            onClick={(e) => {
                              e.stopPropagation();
                              addToCart(product);
                            }}
                          >
                            🤖 Smart Add
                          </button>
                          <button 
                            className="ai-compare-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              showNotification(`🤖 AI comparing ${product.name} with similar products...`);
                            }}
                          >
                            🔄 AI Compare
                          </button>
                        </div>
                        
                        {product.stock !== null && product.stock < 20 && (
                          <div className="ai-stock-warning">
                            ⚡ AI Alert: Low stock! Only {product.stock} left
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* AI Cart Sidebar */}
        <div className="cart-sidebar ai">
          <div className="cart-header ai">
            <h3>🤖 Smart Cart</h3>
            <div className="cart-stats">
              <span className="cart-count">{marketplaceState.cart.length} items</span>
              <span className="cart-carbon">🌿 {calculateCartCarbonImpact()} carbon score</span>
            </div>
          </div>
          
          {marketplaceState.cart.length === 0 ? (
            <div className="empty-cart ai">
              <div className="empty-cart-icon">🤖</div>
              <p>Your AI cart is empty</p>
              <p className="empty-cart-hint">AI recommendations above can help you shop smarter</p>
            </div>
          ) : (
            <>
              <div className="cart-items ai">
                {marketplaceState.cart.map((item, index) => (
                  <div key={index} className="cart-item ai">
                    <div className="cart-item-image ai">
                      <span className="item-emoji">{item.image}</span>
                      {item.aiFeatures?.length > 0 && (
                        <span className="item-ai-badge">AI</span>
                      )}
                    </div>
                    <div className="cart-item-info ai">
                      <span className="item-name">{item.name}</span>
                      <span className="item-supplier">{item.supplier}</span>
                      <div className="item-quantity ai">
                        <span className="quantity-label">Qty: {item.quantity}</span>
                        <span className="item-price">${(item.price * item.quantity).toFixed(2)}</span>
                        {item.carbonScore && (
                          <span className="item-carbon">🌿 {item.carbonScore}</span>
                        )}
                      </div>
                    </div>
                    <button 
                      className="remove-item-btn ai"
                      onClick={() => removeFromCart(item.id)}
                      title="Remove item"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
              
              <div className="cart-summary ai">
                <div className="summary-row ai">
                  <span className="summary-label">Subtotal</span>
                  <span className="summary-value">${calculateCartTotal().toFixed(2)}</span>
                </div>
                <div className="summary-row ai">
                  <span className="summary-label">AI Delivery</span>
                  <span className="summary-value">$18.00</span>
                </div>
                <div className="summary-row ai">
                  <span className="summary-label">Carbon Credit Bonus</span>
                  <span className="summary-value positive">+{calculateCartCarbonImpact() >= 400 ? 10 : 5} credits</span>
                </div>
                <div className="summary-row total ai">
                  <span className="summary-label">Total with AI Benefits</span>
                  <span className="summary-value">${(calculateCartTotal() + 18).toFixed(2)}</span>
                </div>
              </div>
              
              <div className="carbon-impact">
                <h4>🌍 Environmental Impact</h4>
                <div className="impact-metrics">
                  <div className="impact-metric">
                    <span className="metric-label">Carbon Reduced:</span>
                    <span className="metric-value positive">-{(calculateCartCarbonImpact() / 10).toFixed(1)} tons CO2</span>
                  </div>
                  <div className="impact-metric">
                    <span className="metric-label">Water Saved:</span>
                    <span className="metric-value positive">~{(calculateCartCarbonImpact() / 20).toFixed(0)}k liters</span>
                  </div>
                </div>
              </div>
              
              <div className="cart-actions ai">
                <button 
                  className="checkout-btn ai"
                  onClick={placeOrder}
                  disabled={loading || calculateCartTotal() === 0}
                >
                  {loading ? '🤖 AI Processing...' : '🚀 AI-Checkout'}
                </button>
                <button 
                  className="carbon-checkout-btn"
                  onClick={() => showNotification('🤖 Paying with carbon credits... Coming soon!')}
                >
                  🌿 Pay with Carbon
                </button>
                <button 
                  className="ai-suggest-btn"
                  onClick={() => showNotification('🤖 AI analyzing your cart for optimizations...')}
                >
                  🔄 AI Optimize
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* AI Order Summary Modal */}
      {orderSummary && (
        <div className="order-modal-overlay ai">
          <div className="order-modal ai">
            <div className="order-modal-header ai">
              <div className="ai-order-icon">🤖</div>
              <div>
                <h3>🎉 AI-Verified Order Complete!</h3>
                <p className="order-subtitle">Smart purchase with environmental benefits</p>
              </div>
              <button 
                className="close-modal ai"
                onClick={() => setOrderSummary(null)}
              >
                ×
              </button>
            </div>
            
            <div className="order-details ai">
              <div className="order-id ai">Order ID: {orderSummary.orderId}</div>
              <div className="order-status ai">
                Status: <span className="status-ai">🤖 AI-Verified</span>
                <span className="ai-score">Compatibility: {orderSummary.aiCompatibilityScore}%</span>
              </div>
              
              <div className="carbon-achievement">
                <div className="carbon-badge-large">
                  🌿 +{orderSummary.carbonCreditsEarned} Carbon Credits Earned!
                </div>
                <p className="carbon-message">
                  Your sustainable purchase just offset {(orderSummary.carbonCreditsEarned * 0.5).toFixed(1)} tons of CO2
                </p>
              </div>
              
              <div className="order-actions ai">
                <button className="action-btn ai-primary">
                  📱 AI Order Tracking
                </button>
                <button className="action-btn ai-secondary">
                  📄 Blockchain Receipt
                </button>
                <button className="action-btn ai-tertiary">
                  🌿 View Carbon Impact
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper functions from original code (preserved)
const handleCategorySelect = (categoryId) => {
  setMarketplaceState(prev => ({ ...prev, selectedCategory: categoryId }));
};

const handleSearch = (e) => {
  setMarketplaceState(prev => ({ ...prev, searchQuery: e.target.value }));
};

const removeFromCart = (productId) => {
  setMarketplaceState(prev => ({
    ...prev,
    cart: prev.cart.filter(item => item.id !== productId)
  }));
};

const calculateCartTotal = () => {
  return marketplaceState.cart.reduce((total, item) => {
    return total + (item.price * item.quantity);
  }, 0);
};

const toggleFavorite = (productId) => {
  setMarketplaceState(prev => ({
    ...prev,
    favorites: prev.favorites.includes(productId)
      ? prev.favorites.filter(id => id !== productId)
      : [...prev.favorites, productId]
  }));
};

export default Marketplace;