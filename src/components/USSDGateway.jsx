import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './USSDGateway.css';

const USSDGateway = () => {
  // API Configuration
  const API_CONFIG = {
    baseUrl: '/api/gateway'
  };

  // USSD Services
  const ussdServices = [
    {
      id: 'insurance',
      code: '*384*1#',
      name: 'Insurance Services',
      icon: '🛡️',
      description: 'Buy insurance, submit claims, check policy',
      color: '#4caf50',
      provider: 'Africa\'s Talking',
      submenus: [
        { id: 'buy_insurance', text: 'Buy Insurance', code: '1', premium: 'KES 1,200/acre' },
        { id: 'submit_claim', text: 'Submit Claim', code: '2', process: 'SMS photos to 384' },
        { id: 'check_policy', text: 'Check Policy Status', code: '3', response: 'SMS: POLICY STATUS' },
        { id: 'premium_payment', text: 'Pay Premium', code: '4', payment: 'Via M-Pesa/T-Kash' },
        { id: 'claim_status', text: 'Check Claim Status', code: '5', status: 'SMS: CLAIM STATUS' }
      ]
    },
    {
      id: 'marketplace',
      code: '*384*2#',
      name: 'Marketplace',
      icon: '🛒',
      description: 'Check prices, buy inputs, sell produce',
      color: '#2196f3',
      provider: 'Both',
      submenus: [
        { id: 'check_prices', text: 'Check Market Prices', code: '1', keyword: 'PRICE MAIZE' },
        { id: 'buy_inputs', text: 'Buy Farm Inputs', code: '2', process: 'Order via USSD' },
        { id: 'sell_produce', text: 'Sell Your Produce', code: '3', process: 'List via SMS' },
        { id: 'find_buyers', text: 'Find Buyers', code: '4', keyword: 'BUYERS MAIZE' },
        { id: 'order_status', text: 'Check Order Status', code: '5', keyword: 'ORDER STATUS' }
      ]
    },
    {
      id: 'weather',
      code: '*384*3#',
      name: 'Weather Info',
      icon: '🌤️',
      description: 'Forecasts, alerts, farming advice',
      color: '#03a9f4',
      provider: 'Africa\'s Talking',
      submenus: [
        { id: 'daily_forecast', text: 'Daily Forecast', code: '1', keyword: 'WEATHER NAKURU' },
        { id: 'weekly_outlook', text: '7-Day Outlook', code: '2', keyword: 'FORECAST 7' },
        { id: 'weather_alerts', text: 'Weather Alerts', code: '3', keyword: 'ALERTS SUBSCRIBE' },
        { id: 'farming_advice', text: 'Farming Advice', code: '4', keyword: 'ADVICE MAIZE' },
        { id: 'subscribe_alerts', text: 'Subscribe Alerts', code: '5', keyword: 'SUBSCRIBE WEATHER' }
      ]
    },
    {
      id: 'finance',
      code: '*384*4#',
      name: 'Financial Services',
      icon: '💰',
      description: 'Loans, savings, insurance-linked credit',
      color: '#ff9800',
      provider: 'Both',
      submenus: [
        { id: 'apply_loan', text: 'Apply for Loan', code: '1', process: 'SMS: LOAN APPLY' },
        { id: 'check_balance', text: 'Check Loan Status', code: '2', keyword: 'LOAN STATUS' },
        { id: 'repay_loan', text: 'Make Repayment', code: '3', payment: 'Via Mobile Money' },
        { id: 'savings', text: 'Savings Account', code: '4', keyword: 'SAVINGS BALANCE' },
        { id: 'insurance_loan', text: 'Insurance-Linked Loan', code: '5', premium: '+5% with insurance' }
      ]
    },
    {
      id: 'expert',
      code: '*384*5#',
      name: 'Expert Advice',
      icon: '👨‍🌾',
      description: 'AI advice, extension services, community',
      color: '#9c27b0',
      provider: 'Africa\'s Talking',
      submenus: [
        { id: 'ai_advice', text: 'Get AI Advice', code: '1', keyword: 'ADVICE MAIZE WILT' },
        { id: 'ask_expert', text: 'Ask an Expert', code: '2', keyword: 'EXPERT HELP' },
        { id: 'disease_help', text: 'Disease Diagnosis', code: '3', process: 'Send photo to 384' },
        { id: 'fertilizer_calc', text: 'Fertilizer Calculator', code: '4', keyword: 'FERTILIZER 1ACRE MAIZE' },
        { id: 'irrigation_tips', text: 'Irrigation Tips', code: '5', keyword: 'IRRIGATION TIPS' }
      ]
    },
    {
      id: 'subsidy',
      code: '*384*6#',
      name: 'Govt Subsidies',
      icon: '🏛️',
      description: 'Subsidy applications, status, disbursement',
      color: '#795548',
      provider: 'MTN Uganda',
      submenus: [
        { id: 'check_eligibility', text: 'Check Eligibility', code: '1', keyword: 'SUBSIDY CHECK' },
        { id: 'apply_subsidy', text: 'Apply for Subsidy', code: '2', process: 'USSD application' },
        { id: 'check_status', text: 'Check Status', code: '3', keyword: 'SUBSIDY STATUS' },
        { id: 'subsidy_payment', text: 'Receive Payment', code: '4', payment: 'Via MTN Mobile Money' },
        { id: 'training', text: 'Training Programs', code: '5', keyword: 'TRAINING LIST' }
      ]
    }
  ];

  // SMS Services
  const smsServices = [
    {
      id: 'weather_alerts',
      keyword: 'WEATHER',
      description: 'Get daily weather forecast',
      example: 'Send WEATHER NAKURU to 384',
      cost: 'Free',
      usage: '15,000/month',
      provider: 'Africa\'s Talking'
    },
    {
      id: 'price_alerts',
      keyword: 'PRICE',
      description: 'Commodity price alerts',
      example: 'Send PRICE MAIZE to 384',
      cost: '1 KES',
      usage: '8,000/month',
      provider: 'Both'
    },
    {
      id: 'insurance_alerts',
      keyword: 'INSURANCE',
      description: 'Insurance policy alerts',
      example: 'Send INSURANCE STATUS to 384',
      cost: 'Free',
      usage: '5,000/month',
      provider: 'Both'
    },
    {
      id: 'loan_alerts',
      keyword: 'LOAN',
      description: 'Loan application updates',
      example: 'Send LOAN BALANCE to 384',
      cost: 'Free',
      usage: '3,000/month',
      provider: 'MTN Uganda'
    },
    {
      id: 'expert_advice',
      keyword: 'EXPERT',
      description: 'Get farming advice',
      example: 'Send EXPERT MAIZE WILT to 384',
      cost: '5 KES',
      usage: '2,000/month',
      provider: 'Africa\'s Talking'
    },
    {
      id: 'subsidy_alerts',
      keyword: 'SUBSIDY',
      description: 'Government subsidy updates',
      example: 'Send SUBSIDY STATUS to 384',
      cost: 'Free',
      usage: '10,000/month',
      provider: 'MTN Uganda'
    }
  ];

  // State management
  const [ussdState, setUssdState] = useState({
    phoneNumber: '+256712345678',
    sessionActive: false,
    currentMenu: 'main',
    selectedService: null,
    sessionHistory: [],
    balance: 'UGX 50,250',
    network: 'MTN Uganda',
    location: 'Kampala, Uganda',
    provider: 'MTN Uganda'
  });

  const [apiState, setApiState] = useState({
    connected: false,
    loading: false,
    status: {}
  });

  const [simulationState, setSimulationState] = useState({
    simulationInput: '',
    simulationResponse: '',
    sendingMessage: false
  });

  const [stats, setStats] = useState({
    totalUsers: 12500,
    messagesSent: 185000,
    transactions: 54000,
    farmersReached: 8500
  });

  // Check API connection
  const checkAPIStatus = async () => {
    setApiState(prev => ({ ...prev, loading: true }));
    try {
      const response = await axios.get(`${API_CONFIG.baseUrl}/status`);
      setApiState({
        connected: true,
        loading: false,
        status: response.data
      });
    } catch (error) {
      setApiState({
        connected: false,
        loading: false,
        status: { error: error.message }
      });
    }
  };

  // Send SMS
  const sendSMS = async (keyword, message) => {
    setSimulationState(prev => ({ ...prev, sendingMessage: true }));
    try {
      const response = await axios.post(`${API_CONFIG.baseUrl}/sms/send`, {
        phoneNumber: ussdState.phoneNumber,
        message: message
      });
      
      setStats(prev => ({
        ...prev,
        messagesSent: prev.messagesSent + 1,
        transactions: prev.transactions + 1
      }));
      
      return response.data;
    } catch (error) {
      console.error('SMS sending error:', error);
      return { success: false, error: error.message };
    } finally {
      setSimulationState(prev => ({ ...prev, sendingMessage: false }));
    }
  };

  // Simulate USSD session
  const simulateUssdSession = async (input) => {
    if (!ussdState.sessionActive) {
      setUssdState(prev => ({
        ...prev,
        sessionActive: true,
        currentMenu: 'main',
        sessionHistory: [{ menu: 'main', input: 'START' }]
      }));
      return `CON Welcome to SianAgriTech\nSelect Service:\n1. Insurance Services\n2. Marketplace\n3. Weather Info\n4. Financial Services\n5. Expert Advice\n6. Govt Subsidies\n\n00. Main Menu\n99. Exit`;
    }

    let response = '';
    if (ussdState.currentMenu === 'main') {
      const service = ussdServices[parseInt(input) - 1];
      if (service) {
        setUssdState(prev => ({
          ...prev,
          selectedService: service.id,
          currentMenu: service.id
        }));
        response = `CON ${service.name}\n${service.submenus.map((sub, index) => `${index + 1}. ${sub.text}`).join('\n')}\n\n0. Back\n00. Main Menu\n99. Exit`;
      } else if (input === '99') {
        endSession();
        response = 'END Thank you for using SianAgriTech. Goodbye!';
      }
    } else if (ussdState.selectedService) {
      if (input === '0' || input === '00') {
        setUssdState(prev => ({
          ...prev,
          selectedService: null,
          currentMenu: 'main'
        }));
        response = `CON Welcome to SianAgriTech\nSelect Service:\n1. Insurance Services\n2. Marketplace\n3. Weather Info\n4. Financial Services\n5. Expert Advice\n6. Govt Subsidies\n\n00. Main Menu\n99. Exit`;
      } else if (input === '99') {
        endSession();
        response = 'END Thank you for using SianAgriTech. Goodbye!';
      } else {
        response = 'END Request processed. You will receive SMS confirmation.';
        // Send SMS notification
        await sendSMS('SERVICE', 'Your USSD request has been processed successfully.');
      }
    }

    return response;
  };

  const endSession = () => {
    setUssdState(prev => ({
      ...prev,
      sessionActive: false,
      currentMenu: 'main',
      selectedService: null
    }));
  };

  const handleUssdInput = async () => {
    if (!simulationState.simulationInput.trim()) return;
    
    const response = await simulateUssdSession(simulationState.simulationInput);
    const newHistory = [...ussdState.sessionHistory, {
      menu: ussdState.currentMenu,
      input: simulationState.simulationInput,
      response: response
    }];
    
    setUssdState(prev => ({
      ...prev,
      sessionHistory: newHistory
    }));
    
    setSimulationState(prev => ({
      ...prev,
      simulationResponse: response,
      simulationInput: ''
    }));
  };

  const startNewSession = () => {
    const countries = [
      { code: '+256', network: 'MTN Uganda', location: 'Kampala, Uganda' },
      { code: '+254', network: 'Safaricom', location: 'Nairobi, Kenya' },
      { code: '+255', network: 'Vodacom', location: 'Dar es Salaam, Tanzania' }
    ];
    const country = countries[Math.floor(Math.random() * countries.length)];
    
    setUssdState({
      phoneNumber: country.code + '7' + Math.floor(Math.random() * 10000000).toString().padStart(8, '0'),
      sessionActive: true,
      currentMenu: 'main',
      selectedService: null,
      sessionHistory: [],
      balance: country.code === '+256' ? 'UGX 50,250' : 'KES 500.25',
      network: country.network,
      location: country.location,
      provider: country.network.includes('MTN') ? 'MTN Uganda' : 'Africa\'s Talking'
    });
    
    setSimulationState({
      simulationInput: '',
      simulationResponse: 'CON Welcome to SianAgriTech\nSelect Service:\n1. Insurance Services\n2. Marketplace\n3. Weather Info\n4. Financial Services\n5. Expert Advice\n6. Govt Subsidies\n\n00. Main Menu\n99. Exit',
      sendingMessage: false
    });
  };

  const sendTestSMS = async (service) => {
    const message = `${service.keyword}: Test message from SianAgriTech Gateway. Dial *384# for services.`;
    const result = await sendSMS(service.keyword, message);
    
    if (result.success) {
      alert(`✅ SMS sent to ${ussdState.phoneNumber}`);
    } else {
      alert(`❌ SMS failed: ${result.error}`);
    }
  };

  const formatNumber = (num) => num.toLocaleString('en-US');

  useEffect(() => {
    checkAPIStatus();
  }, []);

  return (
    <div className="ussd-gateway">
      <div className="gateway-header">
        <h1>📱 USSD/SMS Gateway</h1>
        <p className="subtitle">Reach every farmer with or without smartphone. Dial <strong>*384#</strong></p>
        
        <div className="api-status">
          <div className={`api-status-item ${apiState.connected ? 'connected' : 'disconnected'}`}>
            <span className="status-dot"></span>
            <span className="status-text">Backend API: {apiState.connected ? '✅ Connected' : '❌ Disconnected'}</span>
          </div>
          <button className="test-api-btn" onClick={checkAPIStatus} disabled={apiState.loading}>
            {apiState.loading ? '🔄 Testing...' : '🔍 Check API'}
          </button>
        </div>
      </div>

      <div className="gateway-container">
        <div className="left-panel">
          <div className="services-card">
            <div className="card-header">
              <h3>📞 USSD Services</h3>
              <button className="new-session-btn" onClick={startNewSession}>
                {ussdState.sessionActive ? '🔄 Restart Session' : '▶️ Start New Session'}
              </button>
            </div>
            
            <div className="services-grid">
              {ussdServices.map(service => (
                <div key={service.id} className="service-card" style={{ borderLeft: `4px solid ${service.color}` }}>
                  <div className="service-icon">{service.icon}</div>
                  <div className="service-content">
                    <div className="service-name">{service.name}</div>
                    <div className="service-code">{service.code}</div>
                    <div className="service-desc">{service.description}</div>
                    <div className="service-submenus">
                      {service.submenus.slice(0, 3).map(sub => (
                        <span key={sub.id} className="submenu-tag">{sub.text}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="sms-card">
            <h3>💬 SMS Services</h3>
            <p className="card-subtitle">Keyword-based services for quick access</p>
            
            <div className="sms-services">
              {smsServices.map(service => (
                <div key={service.id} className="sms-service">
                  <div className="sms-header">
                    <span className="sms-keyword">{service.keyword}</span>
                    <span className="sms-cost">{service.cost}</span>
                  </div>
                  <div className="sms-desc">{service.description}</div>
                  <div className="sms-example">{service.example}</div>
                  <div className="sms-footer">
                    <span className="sms-usage">Usage: {service.usage}</span>
                    <button className="test-sms-btn" onClick={() => sendTestSMS(service)}>
                      Test SMS
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="middle-panel">
          <div className="simulator-card">
            <div className="simulator-header">
              <h3>📱 USSD Simulator</h3>
              <div className="session-info">
                <span className="phone-number">{ussdState.phoneNumber}</span>
                <span className={`session-status ${ussdState.sessionActive ? 'active' : 'inactive'}`}>
                  {ussdState.sessionActive ? '📞 Session Active' : '📴 Session Inactive'}
                </span>
              </div>
            </div>
            
            <div className="phone-simulator">
              <div className="phone-screen">
                <div className="screen-header">
                  <span className="network">{ussdState.network}</span>
                  <span className="balance">{ussdState.balance}</span>
                </div>
                
                <div className="screen-content">
                  <div className="ussd-display">
                    {simulationState.simulationResponse ? (
                      <div className="ussd-response">
                        {simulationState.simulationResponse.split('\n').map((line, index) => (
                          <div key={index} className="ussd-line">{line}</div>
                        ))}
                      </div>
                    ) : (
                      <div className="ussd-welcome">
                        <div className="welcome-icon">📱</div>
                        <div className="welcome-text">Dial *384# to start</div>
                      </div>
                    )}
                  </div>
                  
                  <div className="input-area">
                    <input
                      type="text"
                      value={simulationState.simulationInput}
                      onChange={(e) => setSimulationState(prev => ({ ...prev, simulationInput: e.target.value }))}
                      placeholder="Enter USSD input..."
                      className="ussd-input"
                      disabled={!ussdState.sessionActive}
                    />
                    <button className="send-btn" onClick={handleUssdInput} disabled={!ussdState.sessionActive || !simulationState.simulationInput.trim()}>
                      Send
                    </button>
                  </div>
                </div>
                
                <div className="screen-footer">
                  <div className="keypad">
                    <div className="keypad-row">
                      <button className="key" onClick={() => setSimulationState(prev => ({ ...prev, simulationInput: prev.simulationInput + '1' }))}>1</button>
                      <button className="key" onClick={() => setSimulationState(prev => ({ ...prev, simulationInput: prev.simulationInput + '2' }))}>2</button>
                      <button className="key" onClick={() => setSimulationState(prev => ({ ...prev, simulationInput: prev.simulationInput + '3' }))}>3</button>
                    </div>
                    <div className="keypad-row">
                      <button className="key" onClick={() => setSimulationState(prev => ({ ...prev, simulationInput: prev.simulationInput + '4' }))}>4</button>
                      <button className="key" onClick={() => setSimulationState(prev => ({ ...prev, simulationInput: prev.simulationInput + '5' }))}>5</button>
                      <button className="key" onClick={() => setSimulationState(prev => ({ ...prev, simulationInput: prev.simulationInput + '6' }))}>6</button>
                    </div>
                    <div className="keypad-row">
                      <button className="key" onClick={() => setSimulationState(prev => ({ ...prev, simulationInput: prev.simulationInput + '7' }))}>7</button>
                      <button className="key" onClick={() => setSimulationState(prev => ({ ...prev, simulationInput: prev.simulationInput + '8' }))}>8</button>
                      <button className="key" onClick={() => setSimulationState(prev => ({ ...prev, simulationInput: prev.simulationInput + '9' }))}>9</button>
                    </div>
                    <div className="keypad-row">
                      <button className="key" onClick={() => setSimulationState(prev => ({ ...prev, simulationInput: prev.simulationInput + '*' }))}>*</button>
                      <button className="key" onClick={() => setSimulationState(prev => ({ ...prev, simulationInput: prev.simulationInput + '0' }))}>0</button>
                      <button className="key" onClick={() => setSimulationState(prev => ({ ...prev, simulationInput: prev.simulationInput + '#' }))}>#</button>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="simulator-controls">
                <button className="control-btn" onClick={startNewSession}>
                  {ussdState.sessionActive ? '🔄 Restart' : '▶️ Start'}
                </button>
                <button className="control-btn" onClick={endSession} disabled={!ussdState.sessionActive}>
                  📴 End
                </button>
                <button className="control-btn" onClick={() => setSimulationState(prev => ({ ...prev, simulationInput: '' }))}>
                  🗑️ Clear
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="right-panel">
          <div className="stats-card">
            <h3>📊 Gateway Statistics</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-value">{formatNumber(stats.totalUsers)}</div>
                <div className="stat-label">Farmers Registered</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{formatNumber(stats.messagesSent)}</div>
                <div className="stat-label">SMS Sent</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{formatNumber(stats.transactions)}</div>
                <div className="stat-label">Transactions</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{formatNumber(stats.farmersReached)}</div>
                <div className="stat-label">Farmers Reached</div>
              </div>
            </div>
          </div>

          <div className="api-info-card">
            <h3>🔗 API Information</h3>
            <div className="api-info">
              <div className="info-item">
                <span className="info-label">USSD Code:</span>
                <span className="info-value">*384#</span>
              </div>
              <div className="info-item">
                <span className="info-label">SMS Shortcode:</span>
                <span className="info-value">384</span>
              </div>
              <div className="info-item">
                <span className="info-label">Backend URL:</span>
                <span className="info-value">http://localhost:3001</span>
              </div>
              <div className="info-item">
                <span className="info-label">API Status:</span>
                <span className={`info-value ${apiState.connected ? 'connected' : 'disconnected'}`}>
                  {apiState.connected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default USSDGateway;