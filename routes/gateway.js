// backend/routes/gateway.js
import express from 'express';
import rateLimit from 'express-rate-limit';
import USSDService from '../services/ussdService.js';
import SMSService from '../services/smsService.js';
import { checkDatabaseConnection, checkRedisConnection, getActiveConnections } from '../services/healthService.js';

const router = express.Router();

// ==================== RATE LIMITING ====================
const ussdLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute per IP
  message: { error: 'Too many USSD requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false
});

const smsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many SMS requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

// ==================== SECURITY MIDDLEWARE ====================
const validateUSSDRequest = (req, res, next) => {
  const { sessionId, phoneNumber, serviceCode } = req.body;
  
  if (!sessionId || !phoneNumber || !serviceCode) {
    return res.status(400).send('END Invalid request parameters');
  }
  
  // Validate phone number format
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  if (!phoneRegex.test(phoneNumber)) {
    return res.status(400).send('END Invalid phone number format');
  }
  
  next();
};

const validateSMSRequest = (req, res, next) => {
  const { from, text } = req.body;
  
  if (!from || !text) {
    return res.status(400).json({ 
      error: 'Missing required fields: from, text' 
    });
  }
  
  // Sanitize SMS text
  req.body.text = text.trim().substring(0, 160); // Limit to 160 chars
  
  next();
};

// ==================== USSD ENDPOINT ====================
router.post('/ussd', ussdLimiter, validateUSSDRequest, async (req, res) => {
  try {
    const { sessionId, serviceCode, phoneNumber, text } = req.body;
    
    console.log(`📞 USSD Request: ${phoneNumber} | Session: ${sessionId} | Input: "${text}"`);
    
    // Log request for analytics
    logUSSDRequest({
      sessionId,
      phoneNumber,
      serviceCode,
      text,
      timestamp: new Date(),
      ip: req.ip
    });
    
    const response = await USSDService.handleRequest(
      sessionId,
      phoneNumber,
      serviceCode,
      text
    );
    
    // Log response
    logUSSDResponse({
      sessionId,
      phoneNumber,
      response,
      timestamp: new Date()
    });
    
    res.set('Content-Type', 'text/plain');
    res.send(response);
    
  } catch (error) {
    console.error('❌ USSD Error:', {
      error: error.message,
      stack: error.stack,
      body: req.body,
      timestamp: new Date().toISOString()
    });
    
    // Don't expose internal errors to user
    const userMessage = process.env.NODE_ENV === 'production' 
      ? 'END System error. Please try again later.'
      : `END Error: ${error.message}`;
    
    res.status(500).send(userMessage);
  }
});

// ==================== SMS ENDPOINTS ====================
router.post('/sms/incoming', smsLimiter, validateSMSRequest, async (req, res) => {
  try {
    const { from, to, text, date, id } = req.body;
    
    console.log(`📱 SMS Received: ${from} -> ${to} | "${text}"`);
    
    // Log incoming SMS
    logSMSReceived({
      from,
      to,
      text,
      date,
      messageId: id,
      timestamp: new Date(),
      ip: req.ip
    });
    
    // Process SMS based on keyword
    const keyword = text.split(' ')[0].toUpperCase();
    let response = '';
    
    switch(keyword) {
      case 'WEATHER':
        const location = text.substring(8) || 'Nairobi';
        const forecast = await getWeatherForecast(location);
        response = `Weather for ${location}: ${forecast}`;
        break;
        
      case 'PRICE':
        const commodity = text.substring(6) || 'maize';
        const prices = await getMarketPrices(commodity);
        response = `Price for ${commodity}: ${prices}`;
        break;
        
      case 'INSURANCE':
        const insuranceInfo = await getInsuranceStatus(from);
        response = `Insurance: ${insuranceInfo}`;
        break;
        
      case 'LOAN':
        const loanStatus = await processLoanInquiry(from);
        response = `Loan: ${loanStatus}`;
        break;
        
      case 'EXPERT':
        const problem = text.substring(7) || 'general';
        const expertAdvice = await getExpertAdvice(problem, from);
        response = `Expert advice: ${expertAdvice}`;
        break;
        
      case 'SUBSIDY':
        const subsidyInfo = await checkSubsidyEligibility(from);
        response = `Subsidy: ${subsidyInfo}`;
        break;
        
      case 'HELP':
        response = 'SianAgri Commands: WEATHER [location], PRICE [crop], INSURANCE, LOAN, EXPERT [problem], SUBSIDY, HELP';
        break;
        
      default:
        response = 'Invalid keyword. Send HELP for commands';
    }
    
    // Send response SMS
    const result = await SMSService.sendSMS(from, response);
    
    // Log SMS response
    logSMSSent({
      to: from,
      message: response,
      success: result.success,
      provider: result.provider,
      timestamp: new Date()
    });
    
    res.status(200).json({ 
      status: 'success',
      message: 'SMS processed',
      response,
      provider: result.provider
    });
    
  } catch (error) {
    console.error('❌ SMS Processing Error:', error);
    
    // Try to send error SMS to user
    try {
      await SMSService.sendSMS(req.body.from, 'Sorry, service temporarily unavailable. Please try again later.');
    } catch (smsError) {
      console.error('Failed to send error SMS:', smsError);
    }
    
    res.status(500).json({ 
      status: 'error', 
      error: process.env.NODE_ENV === 'production' 
        ? 'Internal server error' 
        : error.message 
    });
  }
});

router.post('/sms/send', smsLimiter, async (req, res) => {
  try {
    const { phoneNumber, message, priority = 'normal' } = req.body;
    
    if (!phoneNumber || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing phoneNumber or message'
      });
    }
    
    // Validate message length
    if (message.length > 160) {
      return res.status(400).json({
        success: false,
        error: 'Message exceeds 160 character limit'
      });
    }
    
    // Choose provider based on priority
    const result = await SMSService.sendSMS(phoneNumber, message, priority);
    
    // Log SMS sending
    logSMSSent({
      to: phoneNumber,
      message,
      success: result.success,
      provider: result.provider,
      priority,
      timestamp: new Date()
    });
    
    res.json({
      success: result.success,
      provider: result.provider,
      messageId: result.messageId,
      cost: result.cost,
      timestamp: new Date().toISOString(),
      meta: {
        length: message.length,
        priority,
        segments: Math.ceil(message.length / 160)
      }
    });
    
  } catch (error) {
    console.error('❌ Send SMS Error:', error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ==================== GATEWAY STATUS ====================
router.get('/status', async (req, res) => {
  try {
    const clientIP = req.ip || req.connection.remoteAddress;
    console.log(`📊 Status check from IP: ${clientIP}`);
    
    // Check all external services in parallel
    const services = await Promise.allSettled([
      SMSService.getATBalance(),
      SMSService.getMTNBalance(),
      checkDatabaseConnection(),
      checkRedisConnection()
    ]);

    // Calculate service health
    const healthyServices = services.filter(s => s.status === 'fulfilled').length;
    const healthPercentage = (healthyServices / services.length) * 100;
    
    const status = {
      timestamp: new Date().toISOString(),
      service: 'SianAgriTech Gateway API',
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      health: {
        status: healthPercentage >= 75 ? 'healthy' : healthPercentage >= 50 ? 'degraded' : 'unhealthy',
        percentage: Math.round(healthPercentage),
        lastCheck: new Date().toISOString()
      },
      services: {
        africasTalking: services[0].status === 'fulfilled' 
          ? { ...services[0].value, status: 'operational' }
          : { status: 'failed', error: services[0].reason?.message },
        
        mtnUganda: services[1].status === 'fulfilled' 
          ? { ...services[1].value, status: 'operational' }
          : { status: 'failed', error: services[1].reason?.message },
        
        database: services[2].status === 'fulfilled' 
          ? { status: 'connected', latency: services[2].value.latency }
          : { status: 'disconnected', error: services[2].reason?.message },
        
        cache: services[3].status === 'fulfilled' 
          ? { status: 'connected', latency: services[3].value.latency }
          : { status: 'disconnected', error: services[3].reason?.message }
      },
      metrics: {
        memory: {
          rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
          heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`
        },
        connections: await getActiveConnections(),
        nodeVersion: process.version,
        platform: process.platform
      },
      rateLimits: {
        ussd: '10 requests/minute',
        sms: '20 requests/minute'
      }
    };

    // Cache response for 30 seconds
    cacheGatewayStatus(status);
    
    // Set cache headers
    res.set('Cache-Control', 'public, max-age=30');
    res.set('X-API-Version', process.env.APP_VERSION || '1.0.0');
    res.set('X-Environment', process.env.NODE_ENV || 'development');
    
    res.json(status);
    
  } catch (error) {
    console.error('❌ Gateway status error:', error);
    
    // Return cached status if available
    const cachedStatus = getCachedGatewayStatus();
    if (cachedStatus) {
      return res.json({ 
        ...cachedStatus, 
        cached: true, 
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
    
    res.status(503).json({
      error: 'Service temporarily unavailable',
      timestamp: new Date().toISOString(),
      service: 'SianAgriTech Gateway API'
    });
  }
});

// ==================== BULK SMS ENDPOINT ====================
router.post('/sms/bulk', async (req, res) => {
  try {
    const { recipients, message, schedule } = req.body;
    
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Recipients must be a non-empty array'
      });
    }
    
    // Limit batch size
    const maxBatchSize = 1000;
    const batch = recipients.slice(0, maxBatchSize);
    
    console.log(`📨 Bulk SMS: Sending to ${batch.length} recipients`);
    
    const results = await SMSService.sendBulkSMS(batch, message, schedule);
    
    res.json({
      success: true,
      total: batch.length,
      sent: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results: results.map(r => ({
        phone: r.phone,
        success: r.success,
        messageId: r.messageId,
        error: r.error
      })),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Bulk SMS Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ==================== HELPER FUNCTIONS ====================
const logUSSDRequest = (data) => {
  // In production, send to analytics service (e.g., Segment, Mixpanel)
  console.log('📊 USSD Request Logged:', {
    ...data,
    timestamp: data.timestamp.toISOString()
  });
};

const logUSSDResponse = (data) => {
  console.log('📊 USSD Response Logged:', {
    ...data,
    timestamp: data.timestamp.toISOString()
  });
};

const logSMSReceived = (data) => {
  console.log('📊 SMS Received Logged:', {
    ...data,
    timestamp: data.timestamp.toISOString()
  });
};

const logSMSSent = (data) => {
  console.log('📊 SMS Sent Logged:', {
    ...data,
    timestamp: data.timestamp.toISOString()
  });
};

const cacheGatewayStatus = (status) => {
  // Simple in-memory cache - replace with Redis in production
  global.gatewayStatusCache = {
    data: status,
    timestamp: Date.now()
  };
};

const getCachedGatewayStatus = () => {
  if (!global.gatewayStatusCache) return null;
  
  const cacheAge = Date.now() - global.gatewayStatusCache.timestamp;
  const maxAge = 30 * 1000; // 30 seconds
  
  if (cacheAge > maxAge) {
    global.gatewayStatusCache = null;
    return null;
  }
  
  return global.gatewayStatusCache.data;
};

// Mock service functions (implement these in your services)
const getWeatherForecast = async (location) => {
  // Integrate with weather API
  return 'Sunny, 25°C, 10% rain. Good for farming.';
};

const getMarketPrices = async (commodity) => {
  // Integrate with market data API
  return 'UGX 2,800/kg (Kampala), UGX 3,200/kg (Jinja)';
};

const getInsuranceStatus = async (phone) => {
  // Check insurance status from database
  return 'Your policy is active. Premium due in 15 days.';
};

const processLoanInquiry = async (phone) => {
  // Process loan inquiry
  return 'Application received. We\'ll SMS decision in 24h.';
};

const getExpertAdvice = async (problem, phone) => {
  // Connect to expert system
  return 'For your issue, consult extension officer or visit clinic.';
};

const checkSubsidyEligibility = async (phone) => {
  // Check subsidy eligibility
  return 'You qualify for 50% fertilizer discount. Visit NAADS office.';
};

export default router;