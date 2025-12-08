import React, { useState, useEffect } from 'react';
import './Marketplace.css';

const Marketplace = () => {
  // Marketplace categories
  const categories = [
    { id: 'inputs', name: 'Farm Inputs', icon: '🌱', color: '#4CAF50' },
    { id: 'produce', name: 'Fresh Produce', icon: '🍅', color: '#FF5722' },
    { id: 'equipment', name: 'Equipment', icon: '🚜', color: '#2196F3' },
    { id: 'services', name: 'Services', icon: '🔧', color: '#9C27B0' },
    { id: 'finance', name: 'Finance', icon: '💰', color: '#FFC107' },
    { id: 'transport', name: 'Transport', icon: '🚚', color: '#795548' }
  ];

  // Products database
  const products = [
    // Farm Inputs
    { 
      id: 'urea_50kg', 
      name: 'Urea Fertilizer (50kg)', 
      category: 'inputs',
      supplier: 'AgroSuppliers Ltd',
      price: 45.00,
      unit: 'bag',
      location: 'Nairobi, Kenya',
      rating: 4.5,
      reviews: 128,
      delivery: '2-3 days',
      stock: 150,
      image: '🌾',
      description: 'High-quality urea fertilizer for improved crop yield',
      tags: ['fertilizer', 'nitrogen', 'crops']
    },
    { 
      id: 'maize_seeds', 
      name: 'Hybrid Maize Seeds (5kg)', 
      category: 'inputs',
      supplier: 'SeedCo Africa',
      price: 25.50,
      unit: 'pack',
      location: 'Kampala, Uganda',
      rating: 4.7,
      reviews: 89,
      delivery: '1-2 days',
      stock: 75,
      image: '🌽',
      description: 'Drought-resistant hybrid maize seeds',
      tags: ['seeds', 'maize', 'drought-resistant']
    },
    { 
      id: 'drip_kit', 
      name: 'Drip Irrigation Kit', 
      category: 'inputs',
      supplier: 'IrriTech Solutions',
      price: 350.00,
      unit: 'kit',
      location: 'Arusha, Tanzania',
      rating: 4.8,
      reviews: 56,
      delivery: '3-5 days',
      stock: 30,
      image: '💧',
      description: 'Complete drip irrigation system for 1 acre',
      tags: ['irrigation', 'water-saving', 'kit']
    },
    
    // Fresh Produce
    { 
      id: 'tomatoes_gradeA', 
      name: 'Tomatoes Grade A', 
      category: 'produce',
      supplier: 'GreenValley Farms',
      price: 1.20,
      unit: 'kg',
      location: 'Naivasha, Kenya',
      rating: 4.6,
      reviews: 234,
      delivery: 'Same day',
      stock: 500,
      image: '🍅',
      description: 'Fresh organic tomatoes from greenhouse',
      tags: ['organic', 'fresh', 'vegetables']
    },
    { 
      id: 'avocado_export', 
      name: 'Hass Avocados (Export)', 
      category: 'produce',
      supplier: 'Avocado Co-op',
      price: 2.50,
      unit: 'piece',
      location: 'Murang\'a, Kenya',
      rating: 4.9,
      reviews: 167,
      delivery: '1-2 days',
      stock: 1000,
      image: '🥑',
      description: 'Export quality Hass avocados',
      tags: ['export', 'fruit', 'organic']
    },
    
    // Equipment
    { 
      id: 'tractor_rental', 
      name: 'Tractor Rental (Day)', 
      category: 'equipment',
      supplier: 'FarmMachinery Ltd',
      price: 120.00,
      unit: 'day',
      location: 'Multiple locations',
      rating: 4.4,
      reviews: 189,
      delivery: 'On-site',
      stock: 15,
      image: '🚜',
      description: 'Modern tractor with operator',
      tags: ['rental', 'machinery', 'plowing']
    },
    
    // Services
    { 
      id: 'soil_testing', 
      name: 'Soil Testing Service', 
      category: 'services',
      supplier: 'AgriLab Kenya',
      price: 75.00,
      unit: 'test',
      location: 'Nairobi Lab',
      rating: 4.8,
      reviews: 94,
      delivery: 'Lab service',
      stock: null,
      image: '🧪',
      description: 'Complete soil nutrient analysis',
      tags: ['testing', 'lab', 'analysis']
    },
    
    // Finance
    { 
      id: 'crop_loan', 
      name: 'Seasonal Crop Loan', 
      category: 'finance',
      supplier: 'SianFinTech',
      price: null,
      unit: 'loan',
      location: 'Digital',
      rating: 4.7,
      reviews: 312,
      delivery: 'Instant',
      stock: null,
      image: '📈',
      description: 'Low-interest loans for smallholder farmers',
      tags: ['loan', 'credit', 'financing'],
      interestRate: '8%',
      term: '6 months'
    },
    
    // Transport
    { 
      id: 'refrigerated_truck', 
      name: 'Refrigerated Truck', 
      category: 'transport',
      supplier: 'CoolTrans Ltd',
      price: 450.00,
      unit: 'trip',
      location: 'Nairobi to Mombasa',
      rating: 4.5,
      reviews: 67,
      delivery: 'Scheduled',
      stock: 8,
      image: '🚛',
      description: 'Temperature-controlled transport for perishables',
      tags: ['logistics', 'cold-chain', 'transport']
    }
  ];

  // Featured suppliers
  const suppliers = [
    {
      id: 'agrosuppliers',
      name: 'AgroSuppliers Ltd',
      rating: 4.7,
      products: 45,
      joined: '2022',
      verified: true,
      location: 'Nairobi, Kenya',
      specialties: ['Fertilizers', 'Pesticides', 'Seeds']
    },
    {
      id: 'greenvalley',
      name: 'GreenValley Farms',
      rating: 4.9,
      products: 28,
      joined: '2021',
      verified: true,
      location: 'Naivasha, Kenya',
      specialties: ['Organic Produce', 'Vegetables', 'Herbs']
    },
    {
      id: 'farmmachinery',
      name: 'FarmMachinery Ltd',
      rating: 4.5,
      products: 32,
      joined: '2020',
      verified: true,
      location: 'Kampala, Uganda',
      specialties: ['Equipment Rental', 'Repairs', 'Parts']
    },
    {
      id: 'sianfintech',
      name: 'SianFinTech',
      rating: 4.8,
      products: 12,
      joined: '2023',
      verified: true,
      location: 'Digital',
      specialties: ['Farm Loans', 'Insurance', 'Payments']
    }
  ];

  // Initial state
  const [marketplaceState, setMarketplaceState] = useState({
    selectedCategory: 'all',
    searchQuery: '',
    locationFilter: '',
    priceRange: [0, 1000],
    sortBy: 'rating',
    cart: [],
    favorites: [],
    view: 'grid' // 'grid' or 'list'
  });

  const [filteredProducts, setFilteredProducts] = useState(products);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [orderSummary, setOrderSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [userBalance, setUserBalance] = useState(1250.75);

  // Apply filters
  useEffect(() => {
    let result = [...products];
    
    // Category filter
    if (marketplaceState.selectedCategory !== 'all') {
      result = result.filter(product => product.category === marketplaceState.selectedCategory);
    }
    
    // Search filter
    if (marketplaceState.searchQuery) {
      const query = marketplaceState.searchQuery.toLowerCase();
      result = result.filter(product => 
        product.name.toLowerCase().includes(query) ||
        product.supplier.toLowerCase().includes(query) ||
        product.description.toLowerCase().includes(query) ||
        product.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }
    
    // Location filter
    if (marketplaceState.locationFilter) {
      result = result.filter(product => 
        product.location.toLowerCase().includes(marketplaceState.locationFilter.toLowerCase())
      );
    }
    
    // Price range filter
    result = result.filter(product => 
      product.price === null || 
      (product.price >= marketplaceState.priceRange[0] && 
       product.price <= marketplaceState.priceRange[1])
    );
    
    // Sort
    result.sort((a, b) => {
      switch(marketplaceState.sortBy) {
        case 'price_low':
          return (a.price || 0) - (b.price || 0);
        case 'price_high':
          return (b.price || 0) - (a.price || 0);
        case 'rating':
          return b.rating - a.rating;
        case 'newest':
          return b.reviews - a.reviews;
        default:
          return b.rating - a.rating;
      }
    });
    
    setFilteredProducts(result);
  }, [marketplaceState]);

  const handleCategorySelect = (categoryId) => {
    setMarketplaceState(prev => ({ ...prev, selectedCategory: categoryId }));
  };

  const handleSearch = (e) => {
    setMarketplaceState(prev => ({ ...prev, searchQuery: e.target.value }));
  };

  const handleLocationChange = (e) => {
    setMarketplaceState(prev => ({ ...prev, locationFilter: e.target.value }));
  };

  const handlePriceRangeChange = (min, max) => {
    setMarketplaceState(prev => ({ ...prev, priceRange: [min, max] }));
  };

  const handleSortChange = (sortBy) => {
    setMarketplaceState(prev => ({ ...prev, sortBy }));
  };

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
      
      // Show notification
      showNotification(`Added ${quantity} ${product.unit} of ${product.name} to cart`);
      
      return { ...prev, cart: newCart };
    });
  };

  const removeFromCart = (productId) => {
    setMarketplaceState(prev => ({
      ...prev,
      cart: prev.cart.filter(item => item.id !== productId)
    }));
  };

  const toggleFavorite = (productId) => {
    setMarketplaceState(prev => ({
      ...prev,
      favorites: prev.favorites.includes(productId)
        ? prev.favorites.filter(id => id !== productId)
        : [...prev.favorites, productId]
    }));
  };

  const calculateCartTotal = () => {
    return marketplaceState.cart.reduce((total, item) => {
      return total + (item.price * item.quantity);
    }, 0);
  };

  const placeOrder = () => {
    setLoading(true);
    
    setTimeout(() => {
      const total = calculateCartTotal();
      const orderId = 'ORD' + Date.now().toString().slice(-8);
      const estimatedDelivery = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days from now
      
      setOrderSummary({
        orderId,
        items: [...marketplaceState.cart],
        total,
        estimatedDelivery: estimatedDelivery.toISOString(),
        status: 'processing',
        paymentMethod: 'SianFinTech Wallet'
      });
      
      // Clear cart
      setMarketplaceState(prev => ({ ...prev, cart: [] }));
      
      // Update balance
      setUserBalance(prev => prev - total);
      
      setLoading(false);
      showNotification(`Order ${orderId} placed successfully!`);
    }, 1500);
  };

  const showNotification = (message) => {
    // In a real app, you'd use a toast notification library
    alert(message);
  };

  const formatPrice = (price) => {
    if (price === null) return 'Contact for price';
    return `$${price.toFixed(2)}`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const getCategoryColor = (categoryId) => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.color : '#666';
  };

  return (
    <div className="marketplace">
      <div className="marketplace-header">
        <h1>🛒 Sian Marketplace</h1>
        <p className="subtitle">Connect with suppliers, buy inputs, sell produce, access finance</p>
        
        <div className="user-balance">
          <div className="balance-card">
            <span className="balance-label">Your Balance</span>
            <span className="balance-amount">${userBalance.toFixed(2)}</span>
            <span className="balance-source">SianFinTech Wallet</span>
          </div>
        </div>
      </div>

      <div className="marketplace-container">
        {/* Sidebar Filters */}
        <div className="sidebar-filters">
          <div className="filter-card">
            <h3>🔍 Filters</h3>
            
            <div className="filter-section">
              <h4>Categories</h4>
              <div className="category-list">
                <button 
                  className={`category-btn ${marketplaceState.selectedCategory === 'all' ? 'active' : ''}`}
                  onClick={() => handleCategorySelect('all')}
                >
                  🌟 All Products
                </button>
                {categories.map(category => (
                  <button
                    key={category.id}
                    className={`category-btn ${marketplaceState.selectedCategory === category.id ? 'active' : ''}`}
                    onClick={() => handleCategorySelect(category.id)}
                    style={{ borderLeftColor: category.color }}
                  >
                    {category.icon} {category.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-section">
              <h4>Price Range</h4>
              <div className="price-slider">
                <input
                  type="range"
                  min="0"
                  max="1000"
                  value={marketplaceState.priceRange[1]}
                  onChange={(e) => handlePriceRangeChange(marketplaceState.priceRange[0], parseInt(e.target.value))}
                  className="range-slider"
                />
                <div className="price-labels">
                  <span>$0</span>
                  <span>${marketplaceState.priceRange[1]}</span>
                </div>
              </div>
            </div>

            <div className="filter-section">
              <h4>Location</h4>
              <input
                type="text"
                placeholder="e.g., Nairobi, Kenya"
                value={marketplaceState.locationFilter}
                onChange={handleLocationChange}
                className="location-input"
              />
            </div>

            <div className="filter-section">
              <h4>Sort By</h4>
              <div className="sort-options">
                <button
                  className={`sort-btn ${marketplaceState.sortBy === 'rating' ? 'active' : ''}`}
                  onClick={() => handleSortChange('rating')}
                >
                  ⭐ Highest Rated
                </button>
                <button
                  className={`sort-btn ${marketplaceState.sortBy === 'price_low' ? 'active' : ''}`}
                  onClick={() => handleSortChange('price_low')}
                >
                  💰 Price: Low to High
                </button>
                <button
                  className={`sort-btn ${marketplaceState.sortBy === 'price_high' ? 'active' : ''}`}
                  onClick={() => handleSortChange('price_high')}
                >
                  💵 Price: High to Low
                </button>
                <button
                  className={`sort-btn ${marketplaceState.sortBy === 'newest' ? 'active' : ''}`}
                  onClick={() => handleSortChange('newest')}
                >
                  🆕 Newest
                </button>
              </div>
            </div>

            <div className="filter-section">
              <h4>Quick Stats</h4>
              <div className="quick-stats">
                <div className="stat-item">
                  <span className="stat-label">Products</span>
                  <span className="stat-value">{products.length}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Suppliers</span>
                  <span className="stat-value">{suppliers.length}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Your Cart</span>
                  <span className="stat-value">{marketplaceState.cart.length} items</span>
                </div>
              </div>
            </div>
          </div>

          {/* Featured Suppliers */}
          <div className="suppliers-card">
            <h3>🏆 Featured Suppliers</h3>
            <div className="suppliers-list">
              {suppliers.map(supplier => (
                <div key={supplier.id} className="supplier-item">
                  <div className="supplier-header">
                    <span className="supplier-name">{supplier.name}</span>
                    {supplier.verified && <span className="verified-badge">✓ Verified</span>}
                  </div>
                  <div className="supplier-details">
                    <span className="supplier-rating">⭐ {supplier.rating}</span>
                    <span className="supplier-location">📍 {supplier.location}</span>
                  </div>
                  <div className="supplier-specialties">
                    {supplier.specialties.map((specialty, index) => (
                      <span key={index} className="specialty-tag">{specialty}</span>
                    ))}
                  </div>
                  <button className="view-supplier-btn">
                    View Products
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="main-content">
          {/* Search Bar */}
          <div className="search-bar-container">
            <div className="search-bar">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search for products, suppliers, or services..."
                value={marketplaceState.searchQuery}
                onChange={handleSearch}
                className="search-input"
              />
              <div className="view-toggle">
                <button 
                  className={`view-btn ${marketplaceState.view === 'grid' ? 'active' : ''}`}
                  onClick={() => setMarketplaceState(prev => ({ ...prev, view: 'grid' }))}
                >
                  ▦ Grid
                </button>
                <button 
                  className={`view-btn ${marketplaceState.view === 'list' ? 'active' : ''}`}
                  onClick={() => setMarketplaceState(prev => ({ ...prev, view: 'list' }))}
                >
                  ☰ List
                </button>
              </div>
            </div>
            <div className="active-filters">
              {marketplaceState.selectedCategory !== 'all' && (
                <span className="active-filter">
                  {categories.find(c => c.id === marketplaceState.selectedCategory)?.name}
                  <button onClick={() => handleCategorySelect('all')}>×</button>
                </span>
              )}
              {marketplaceState.searchQuery && (
                <span className="active-filter">
                  Search: "{marketplaceState.searchQuery}"
                  <button onClick={() => setMarketplaceState(prev => ({ ...prev, searchQuery: '' }))}>×</button>
                </span>
              )}
              {marketplaceState.locationFilter && (
                <span className="active-filter">
                  Location: {marketplaceState.locationFilter}
                  <button onClick={() => setMarketplaceState(prev => ({ ...prev, locationFilter: '' }))}>×</button>
                </span>
              )}
            </div>
          </div>

          {/* Products Grid/List */}
          {loading ? (
            <div className="loading-products">
              <div className="loader"></div>
              <p>Loading products...</p>
            </div>
          ) : (
            <>
              <div className="results-header">
                <h3>
                  {marketplaceState.selectedCategory === 'all' 
                    ? 'All Products' 
                    : categories.find(c => c.id === marketplaceState.selectedCategory)?.name}
                  <span className="results-count"> ({filteredProducts.length} products)</span>
                </h3>
                <div className="results-summary">
                  Showing {Math.min(filteredProducts.length, 12)} of {filteredProducts.length} products
                </div>
              </div>

              <div className={`products-container ${marketplaceState.view}`}>
                {filteredProducts.slice(0, 12).map(product => (
                  <div 
                    key={product.id} 
                    className="product-card"
                    onClick={() => setSelectedProduct(product)}
                  >
                    <div 
                      className="product-category"
                      style={{ backgroundColor: getCategoryColor(product.category) }}
                    >
                      {categories.find(c => c.id === product.category)?.icon} 
                      {categories.find(c => c.id === product.category)?.name}
                    </div>
                    
                    <div className="product-image">
                      <span className="product-emoji">{product.image}</span>
                      {marketplaceState.favorites.includes(product.id) && (
                        <span className="favorite-badge">❤️</span>
                      )}
                    </div>
                    
                    <div className="product-info">
                      <h4 className="product-name">{product.name}</h4>
                      <p className="product-description">{product.description}</p>
                      
                      <div className="product-supplier">
                        <span className="supplier-name">by {product.supplier}</span>
                        <span className="supplier-location">📍 {product.location}</span>
                      </div>
                      
                      <div className="product-rating">
                        <span className="rating-stars">⭐ {product.rating}</span>
                        <span className="rating-count">({product.reviews} reviews)</span>
                      </div>
                      
                      <div className="product-tags">
                        {product.tags.map((tag, index) => (
                          <span key={index} className="product-tag">{tag}</span>
                        ))}
                      </div>
                    </div>
                    
                    <div className="product-footer">
                      <div className="product-price">
                        <span className="price-amount">{formatPrice(product.price)}</span>
                        <span className="price-unit">per {product.unit}</span>
                      </div>
                      
                      <div className="product-actions">
                        <button 
                          className="add-to-cart-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart(product);
                          }}
                        >
                          🛒 Add to Cart
                        </button>
                        <button 
                          className="favorite-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(product.id);
                          }}
                        >
                          {marketplaceState.favorites.includes(product.id) ? '❤️' : '🤍'}
                        </button>
                      </div>
                      
                      {product.stock !== null && product.stock < 20 && (
                        <div className="low-stock-warning">
                          ⚠️ Only {product.stock} left in stock!
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {filteredProducts.length === 0 && (
                <div className="no-results">
                  <div className="no-results-icon">🔍</div>
                  <h4>No products found</h4>
                  <p>Try adjusting your filters or search terms</p>
                  <button 
                    className="clear-filters-btn"
                    onClick={() => setMarketplaceState({
                      ...marketplaceState,
                      selectedCategory: 'all',
                      searchQuery: '',
                      locationFilter: '',
                      priceRange: [0, 1000]
                    })}
                  >
                    Clear All Filters
                  </button>
                </div>
              )}

              {filteredProducts.length > 12 && (
                <div className="load-more">
                  <button className="load-more-btn">
                    Load More Products ({filteredProducts.length - 12} more)
                  </button>
                </div>
              )}
            </>
          )}

          {/* Cart Sidebar */}
          <div className="cart-sidebar">
            <div className="cart-header">
              <h3>🛒 Your Cart</h3>
              <span className="cart-count">{marketplaceState.cart.length} items</span>
            </div>
            
            {marketplaceState.cart.length === 0 ? (
              <div className="empty-cart">
                <div className="empty-cart-icon">🛒</div>
                <p>Your cart is empty</p>
                <p className="empty-cart-hint">Add products from the marketplace</p>
              </div>
            ) : (
              <>
                <div className="cart-items">
                  {marketplaceState.cart.map((item, index) => (
                    <div key={index} className="cart-item">
                      <div className="cart-item-image">
                        <span className="item-emoji">{item.image}</span>
                      </div>
                      <div className="cart-item-info">
                        <span className="item-name">{item.name}</span>
                        <span className="item-supplier">{item.supplier}</span>
                        <div className="item-quantity">
                          <span className="quantity-label">Qty: {item.quantity}</span>
                          <span className="item-price">${(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                      </div>
                      <button 
                        className="remove-item-btn"
                        onClick={() => removeFromCart(item.id)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                
                <div className="cart-summary">
                  <div className="summary-row">
                    <span className="summary-label">Subtotal</span>
                    <span className="summary-value">${calculateCartTotal().toFixed(2)}</span>
                  </div>
                  <div className="summary-row">
                    <span className="summary-label">Delivery</span>
                    <span className="summary-value">$15.00</span>
                  </div>
                  <div className="summary-row">
                    <span className="summary-label">Platform Fee</span>
                    <span className="summary-value">$5.00</span>
                  </div>
                  <div className="summary-row total">
                    <span className="summary-label">Total</span>
                    <span className="summary-value">${(calculateCartTotal() + 20).toFixed(2)}</span>
                  </div>
                </div>
                
                <div className="cart-actions">
                  <button 
                    className="checkout-btn"
                    onClick={placeOrder}
                    disabled={loading || calculateCartTotal() === 0}
                  >
                    {loading ? 'Processing...' : '🚀 Checkout with SianFinTech'}
                  </button>
                  <button 
                    className="save-cart-btn"
                    onClick={() => showNotification('Cart saved for later!')}
                  >
                    💾 Save for Later
                  </button>
                  <button 
                    className="clear-cart-btn"
                    onClick={() => setMarketplaceState(prev => ({ ...prev, cart: [] }))}
                  >
                    🗑️ Clear Cart
                  </button>
                </div>
                
                <div className="wallet-balance">
                  <span className="balance-label">Available Balance:</span>
                  <span className="balance-amount">${userBalance.toFixed(2)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Order Summary Modal */}
      {orderSummary && (
        <div className="order-modal-overlay">
          <div className="order-modal">
            <div className="order-modal-header">
              <h3>🎉 Order Confirmed!</h3>
              <button 
                className="close-modal"
                onClick={() => setOrderSummary(null)}
              >
                ×
              </button>
            </div>
            
            <div className="order-details">
              <div className="order-id">Order ID: {orderSummary.orderId}</div>
              <div className="order-status">Status: <span className="status-processing">Processing</span></div>
              
              <div className="order-items">
                <h4>Order Items:</h4>
                {orderSummary.items.map((item, index) => (
                  <div key={index} className="order-item">
                    <span className="order-item-name">{item.name}</span>
                    <span className="order-item-qty">{item.quantity} × ${item.price.toFixed(2)}</span>
                    <span className="order-item-total">${(item.quantity * item.price).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              
              <div className="order-total">
                <span>Total Amount:</span>
                <span className="total-amount">${orderSummary.total.toFixed(2)}</span>
              </div>
              
              <div className="order-info">
                <div className="info-row">
                  <span className="info-label">Payment Method:</span>
                  <span className="info-value">{orderSummary.paymentMethod}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Estimated Delivery:</span>
                  <span className="info-value">{formatDate(orderSummary.estimatedDelivery)}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Delivery Address:</span>
                  <span className="info-value">Your Farm Location (GPS tracked)</span>
                </div>
              </div>
              
              <div className="order-actions">
                <button className="action-btn primary">
                  📱 Track Order
                </button>
                <button className="action-btn secondary">
                  📄 Download Invoice
                </button>
                <button className="action-btn">
                  🛒 Continue Shopping
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div className="product-modal-overlay">
          <div className="product-modal">
            <div className="product-modal-header">
              <h3>{selectedProduct.name}</h3>
              <button 
                className="close-modal"
                onClick={() => setSelectedProduct(null)}
              >
                ×
              </button>
            </div>
            
            <div className="product-modal-content">
              <div className="product-modal-image">
                <span className="product-large-emoji">{selectedProduct.image}</span>
              </div>
              
              <div className="product-modal-details">
                <div className="detail-section">
                  <h4>Description</h4>
                  <p>{selectedProduct.description}</p>
                </div>
                
                <div className="detail-section">
                  <h4>Supplier Information</h4>
                  <div className="supplier-detail">
                    <span className="supplier-name">🏢 {selectedProduct.supplier}</span>
                    <span className="supplier-location">📍 {selectedProduct.location}</span>
                    <span className="supplier-rating">⭐ {selectedProduct.rating} ({selectedProduct.reviews} reviews)</span>
                  </div>
                </div>
                
                <div className="detail-section">
                  <h4>Pricing</h4>
                  <div className="pricing-detail">
                    <div className="price-display">
                      <span className="price-amount">{formatPrice(selectedProduct.price)}</span>
                      <span className="price-unit">per {selectedProduct.unit}</span>
                    </div>
                    {selectedProduct.delivery && (
                      <div className="delivery-info">
                        <span className="delivery-label">Delivery:</span>
                        <span className="delivery-value">{selectedProduct.delivery}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="detail-section">
                  <h4>Tags & Categories</h4>
                  <div className="tags-container">
                    {selectedProduct.tags.map((tag, index) => (
                      <span key={index} className="detail-tag">{tag}</span>
                    ))}
                  </div>
                </div>
                
                <div className="product-modal-actions">
                  <div className="quantity-selector">
                    <button className="qty-btn">−</button>
                    <span className="qty-value">1</span>
                    <button className="qty-btn">+</button>
                  </div>
                  
                  <button 
                    className="add-to-cart-large"
                    onClick={() => {
                      addToCart(selectedProduct);
                      setSelectedProduct(null);
                    }}
                  >
                    🛒 Add to Cart
                  </button>
                  
                  <button 
                    className="buy-now-btn"
                    onClick={() => {
                      addToCart(selectedProduct);
                      setSelectedProduct(null);
                      setTimeout(() => placeOrder(), 500);
                    }}
                  >
                    🚀 Buy Now
                  </button>
                  
                  <button 
                    className="favorite-large"
                    onClick={() => toggleFavorite(selectedProduct.id)}
                  >
                    {marketplaceState.favorites.includes(selectedProduct.id) ? '❤️ Remove Favorite' : '🤍 Add to Favorites'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Marketplace;