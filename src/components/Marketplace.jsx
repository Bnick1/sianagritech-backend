import React, { useState, useEffect } from 'react';
import './Marketplace.css';

// Import API service
import marketplaceAPI from '../services/marketplaceAPI';

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

  // Products database (keeping your existing products array)
  const products = [
    // ... (keep your existing products array exactly as is)
  ];

  // Featured suppliers (keeping your existing suppliers array)
  const suppliers = [
    // ... (keep your existing suppliers array exactly as is)
  ];

  // New state for FinTech integration
  const [financing, setFinancing] = useState({
    available: false,
    balance: 0,
    creditLimit: 0,
    interestRate: 0,
    activeLoans: []
  });
  const [showFinancingModal, setShowFinancingModal] = useState(false);
  const [loanApplication, setLoanApplication] = useState({
    amount: 0,
    purpose: '',
    term: 6
  });
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('wallet');

  // Initial state
  const [marketplaceState, setMarketplaceState] = useState({
    selectedCategory: 'all',
    searchQuery: '',
    locationFilter: '',
    priceRange: [0, 1000],
    sortBy: 'rating',
    cart: [],
    favorites: [],
    view: 'grid'
  });

  const [filteredProducts, setFilteredProducts] = useState(products);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [orderSummary, setOrderSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [financingLoading, setFinancingLoading] = useState(true);
  const [user, setUser] = useState(null);

  // Load user and financing data on mount
  useEffect(() => {
    loadUserData();
    loadFinancingData();
  }, []);

  const loadUserData = async () => {
    try {
      const userData = await marketplaceAPI.getCurrentUser();
      setUser(userData);
    } catch (error) {
      console.error('Failed to load user:', error);
    }
  };

  const loadFinancingData = async () => {
    try {
      setFinancingLoading(true);
      const financingData = await marketplaceAPI.getFinancingStatus();
      setFinancing({
        available: financingData.active,
        balance: financingData.available || 0,
        creditLimit: financingData.limit || 0,
        interestRate: financingData.interestRate || 8,
        activeLoans: financingData.activeLoans || []
      });
    } catch (error) {
      console.error('Failed to load financing:', error);
    } finally {
      setFinancingLoading(false);
    }
  };

  // Apply filters (keeping your existing useEffect)
  useEffect(() => {
    let result = [...products];
    
    if (marketplaceState.selectedCategory !== 'all') {
      result = result.filter(product => product.category === marketplaceState.selectedCategory);
    }
    
    if (marketplaceState.searchQuery) {
      const query = marketplaceState.searchQuery.toLowerCase();
      result = result.filter(product => 
        product.name.toLowerCase().includes(query) ||
        product.supplier.toLowerCase().includes(query) ||
        product.description.toLowerCase().includes(query) ||
        product.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }
    
    if (marketplaceState.locationFilter) {
      result = result.filter(product => 
        product.location.toLowerCase().includes(marketplaceState.locationFilter.toLowerCase())
      );
    }
    
    result = result.filter(product => 
      product.price === null || 
      (product.price >= marketplaceState.priceRange[0] && 
       product.price <= marketplaceState.priceRange[1])
    );
    
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

  const calculateDeliveryFee = () => {
    const subtotal = calculateCartTotal();
    if (subtotal > 200) return 0;
    if (subtotal > 100) return 10;
    return 15;
  };

  const calculatePlatformFee = () => {
    const subtotal = calculateCartTotal();
    return Math.max(5, subtotal * 0.02); // 2% or $5 minimum
  };

  const calculateTotal = () => {
    return calculateCartTotal() + calculateDeliveryFee() + calculatePlatformFee();
  };

  const placeOrder = async () => {
    if (!user) {
      showNotification('Please log in to continue');
      return;
    }

    setProcessingPayment(true);
    
    try {
      const total = calculateTotal();
      
      // Check if using financing
      if (paymentMethod === 'financing') {
        if (total > financing.balance) {
          showNotification('Insufficient financing balance');
          setProcessingPayment(false);
          return;
        }
      }

      // Create order in backend
      const order = await marketplaceAPI.createOrder({
        items: marketplaceState.cart,
        total,
        paymentMethod,
        deliveryAddress: user.farmAddress
      });

      // Process payment via SianFinTech
      if (paymentMethod === 'financing') {
        await marketplaceAPI.processFinancingPayment({
          orderId: order.id,
          amount: total
        });
        
        // Update financing balance
        setFinancing(prev => ({
          ...prev,
          balance: prev.balance - total
        }));
      } else if (paymentMethod === 'wallet') {
        await marketplaceAPI.processWalletPayment({
          orderId: order.id,
          amount: total
        });
        
        // Update wallet balance
        setUser(prev => ({
          ...prev,
          walletBalance: prev.walletBalance - total
        }));
      }

      const estimatedDelivery = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      
      setOrderSummary({
        orderId: order.id,
        items: [...marketplaceState.cart],
        total,
        estimatedDelivery: estimatedDelivery.toISOString(),
        status: 'processing',
        paymentMethod: paymentMethod === 'financing' ? 'SianFinTech Financing' : 'SianFinTech Wallet'
      });
      
      // Clear cart
      setMarketplaceState(prev => ({ ...prev, cart: [] }));
      
      showNotification(`Order ${order.id} placed successfully!`);
    } catch (error) {
      console.error('Order failed:', error);
      showNotification('Order failed: ' + error.message);
    } finally {
      setProcessingPayment(false);
    }
  };

  const applyForLoan = async () => {
    try {
      setFinancingLoading(true);
      const result = await marketplaceAPI.applyForLoan(loanApplication);
      
      if (result.approved) {
        setFinancing(prev => ({
          ...prev,
          available: true,
          balance: result.amount,
          creditLimit: result.creditLimit,
          interestRate: result.interestRate
        }));
        showNotification('Loan approved! Funds added to your financing balance');
        setShowFinancingModal(false);
      } else {
        showNotification('Loan application declined');
      }
    } catch (error) {
      console.error('Loan application failed:', error);
      showNotification('Loan application failed: ' + error.message);
    } finally {
      setFinancingLoading(false);
    }
  };

  const showNotification = (message) => {
    alert(message); // Replace with toast library in production
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
        
        {/* Financing Status Card - Enhanced with FinTech */}
        <div className="financing-status">
          {financingLoading ? (
            <div className="loading-financing">
              <div className="loader-small"></div>
              <span>Checking financing...</span>
            </div>
          ) : financing.available ? (
            <div className="financing-card active">
              <div className="financing-header">
                <span className="financing-icon">💰</span>
                <span className="financing-title">SianFinTech Financing Active</span>
              </div>
              <div className="financing-balance">
                <span className="balance-label">Available Balance:</span>
                <span className="balance-amount">${financing.balance.toFixed(2)}</span>
              </div>
              <div className="financing-details">
                <div className="detail-item">
                  <span className="detail-label">Credit Limit:</span>
                  <span className="detail-value">${financing.creditLimit.toFixed(2)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Interest Rate:</span>
                  <span className="detail-value">{financing.interestRate}% p.a.</span>
                </div>
              </div>
              <div className="financing-actions">
                <button className="financing-btn" onClick={() => setShowFinancingModal(true)}>
                  📈 Apply for More
                </button>
                <button className="financing-btn secondary">
                  📊 View Loans
                </button>
              </div>
            </div>
          ) : (
            <div className="financing-card inactive">
              <div className="financing-header">
                <span className="financing-icon">💳</span>
                <span className="financing-title">Get Financing from SianFinTech</span>
              </div>
              <p className="financing-description">
                Access low-interest loans for farm inputs, equipment, and expansion
              </p>
              <div className="financing-benefits">
                <div className="benefit">✓ 8% interest rate</div>
                <div className="benefit">✓ 6-12 month terms</div>
                <div className="benefit">✓ Instant approval</div>
              </div>
              <button 
                className="apply-financing-btn"
                onClick={() => setShowFinancingModal(true)}
              >
                🚀 Apply Now
              </button>
            </div>
          )}
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

            {/* ... (keep your existing filter sections - price range, location, sort, quick stats) */}
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

        {/* Main Content - Products Grid */}
        <div className="main-content">
          {/* ... (keep your existing search bar, products grid, etc.) */}
        </div>

        {/* Cart Sidebar - Enhanced with Payment Method Selection */}
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
                  <span className="summary-value">${calculateDeliveryFee().toFixed(2)}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Platform Fee</span>
                  <span className="summary-value">${calculatePlatformFee().toFixed(2)}</span>
                </div>
                <div className="summary-row total">
                  <span className="summary-label">Total</span>
                  <span className="summary-value">${calculateTotal().toFixed(2)}</span>
                </div>
              </div>

              {/* Payment Method Selection */}
              <div className="payment-methods">
                <h4>Payment Method</h4>
                <div className="payment-options">
                  <label className={`payment-option ${paymentMethod === 'wallet' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="payment"
                      value="wallet"
                      checked={paymentMethod === 'wallet'}
                      onChange={() => setPaymentMethod('wallet')}
                    />
                    <div className="payment-option-content">
                      <span className="payment-icon">💳</span>
                      <div className="payment-info">
                        <span className="payment-name">SianFinTech Wallet</span>
                        <span className="payment-balance">Balance: ${user?.walletBalance?.toFixed(2) || '0.00'}</span>
                      </div>
                    </div>
                  </label>

                  <label className={`payment-option ${paymentMethod === 'financing' ? 'selected' : ''} ${!financing.available ? 'disabled' : ''}`}>
                    <input
                      type="radio"
                      name="payment"
                      value="financing"
                      checked={paymentMethod === 'financing'}
                      onChange={() => setPaymentMethod('financing')}
                      disabled={!financing.available}
                    />
                    <div className="payment-option-content">
                      <span className="payment-icon">💰</span>
                      <div className="payment-info">
                        <span className="payment-name">Financing</span>
                        {financing.available ? (
                          <span className="payment-balance">Available: ${financing.balance.toFixed(2)}</span>
                        ) : (
                          <span className="payment-unavailable">Not available - Apply now</span>
                        )}
                      </div>
                    </div>
                  </label>
                </div>
              </div>
              
              <div className="cart-actions">
                <button 
                  className="checkout-btn"
                  onClick={placeOrder}
                  disabled={processingPayment || calculateCartTotal() === 0}
                >
                  {processingPayment ? 'Processing...' : `🚀 Pay $${calculateTotal().toFixed(2)}`}
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
            </>
          )}
        </div>
      </div>

      {/* Financing Application Modal */}
      {showFinancingModal && (
        <div className="modal-overlay">
          <div className="modal financing-modal">
            <div className="modal-header">
              <h3>💰 Apply for SianFinTech Financing</h3>
              <button className="close-modal" onClick={() => setShowFinancingModal(false)}>×</button>
            </div>
            
            <div className="modal-content">
              <div className="loan-products">
                <div className="loan-product">
                  <h4>🌱 Input Loan</h4>
                  <p>For seeds, fertilizer, and farm inputs</p>
                  <ul>
                    <li>Amount: Up to $500</li>
                    <li>Term: 6 months</li>
                    <li>Interest: 8% p.a.</li>
                  </ul>
                </div>
                <div className="loan-product">
                  <h4>🚜 Equipment Loan</h4>
                  <p>For tractors, irrigation, and machinery</p>
                  <ul>
                    <li>Amount: Up to $5,000</li>
                    <li>Term: 12 months</li>
                    <li>Interest: 6% p.a.</li>
                  </ul>
                </div>
                <div className="loan-product">
                  <h4>🌾 Expansion Loan</h4>
                  <p>For land acquisition and farm expansion</p>
                  <ul>
                    <li>Amount: Up to $10,000</li>
                    <li>Term: 24 months</li>
                    <li>Interest: 5% p.a.</li>
                  </ul>
                </div>
              </div>

              <div className="loan-application-form">
                <h4>Loan Application</h4>
                <div className="form-group">
                  <label>Loan Amount ($)</label>
                  <input
                    type="number"
                    value={loanApplication.amount}
                    onChange={(e) => setLoanApplication({ ...loanApplication, amount: parseInt(e.target.value) })}
                    min="100"
                    max="10000"
                  />
                </div>
                <div className="form-group">
                  <label>Purpose</label>
                  <select
                    value={loanApplication.purpose}
                    onChange={(e) => setLoanApplication({ ...loanApplication, purpose: e.target.value })}
                  >
                    <option value="">Select purpose</option>
                    <option value="inputs">Farm Inputs</option>
                    <option value="equipment">Equipment</option>
                    <option value="expansion">Farm Expansion</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Loan Term (months)</label>
                  <select
                    value={loanApplication.term}
                    onChange={(e) => setLoanApplication({ ...loanApplication, term: parseInt(e.target.value) })}
                  >
                    <option value="6">6 months</option>
                    <option value="12">12 months</option>
                    <option value="24">24 months</option>
                  </select>
                </div>
              </div>

              <div className="loan-summary">
                <h4>Loan Summary</h4>
                <div className="summary-row">
                  <span>Principal:</span>
                  <span>${loanApplication.amount || 0}</span>
                </div>
                <div className="summary-row">
                  <span>Interest ({loanApplication.term} months):</span>
                  <span>${((loanApplication.amount || 0) * 0.08 * loanApplication.term / 12).toFixed(2)}</span>
                </div>
                <div className="summary-row total">
                  <span>Total Repayment:</span>
                  <span>${((loanApplication.amount || 0) * (1 + 0.08 * loanApplication.term / 12)).toFixed(2)}</span>
                </div>
                <div className="summary-row">
                  <span>Monthly Payment:</span>
                  <span>${((loanApplication.amount || 0) * (1 + 0.08 * loanApplication.term / 12) / loanApplication.term).toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowFinancingModal(false)}>
                Cancel
              </button>
              <button 
                className="btn-primary"
                onClick={applyForLoan}
                disabled={!loanApplication.amount || !loanApplication.purpose || financingLoading}
              >
                {financingLoading ? 'Processing...' : 'Apply for Loan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Summary Modal (keep your existing order modal) */}
      {orderSummary && (
        <div className="order-modal-overlay">
          {/* ... your existing order modal */}
        </div>
      )}

      {/* Product Detail Modal (keep your existing product modal) */}
      {selectedProduct && (
        <div className="product-modal-overlay">
          {/* ... your existing product modal */}
        </div>
      )}
    </div>
  );
};

export default Marketplace;