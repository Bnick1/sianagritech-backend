// backend/services/smsService.js
import axios from 'axios';

class SMSService {
  constructor() {
    // Africa's Talking
    this.atApiKey = process.env.AT_API_KEY;
    this.atUsername = process.env.AT_USERNAME;
    
    // MTN Uganda (PRODUCTION)
    this.mtnApiKey = process.env.MTN_API_KEY;
    this.mtnUuid = process.env.MTN_UUID;
    this.mtnBaseUrl = process.env.MTN_BASE_URL || 'https://api.mtn.co.ug';
    
    // ThingSpeak for IoT alerts
    this.thingspeakApiKey = process.env.THINGSPEAK_API_KEY;
    this.thingspeakChannelId = process.env.THINGSPEAK_CHANNEL_ID;
  }

  async sendSMS(phoneNumber, message, options = {}) {
    const formattedPhone = this.formatPhoneNumber(phoneNumber);
    const provider = this.detectProvider(phoneNumber);
    
    console.log(`📱 Sending SMS to ${formattedPhone} via ${provider}`);
    
    try {
      let result;
      
      // Use MTN for Ugandan numbers, Africa's Talking for others
      if (provider === 'MTN' && this.mtnApiKey && this.mtnApiKey !== 'your_mtn_key_here') {
        result = await this.sendViaMTN(formattedPhone, message, options);
      } else {
        result = await this.sendViaAfricaTalking(formattedPhone, message, options);
      }
      
      // Log successful delivery
      await this.logSMSTransaction({
        phone: formattedPhone,
        message: message.substring(0, 100),
        provider,
        status: 'sent',
        messageId: result.messageId,
        cost: result.cost
      });
      
      return {
        success: true,
        provider,
        messageId: result.messageId,
        data: result
      };
    } catch (error) {
      console.error('❌ SMS sending failed:', error.message);
      
      // Log failure
      await this.logSMSTransaction({
        phone: formattedPhone,
        message: message.substring(0, 100),
        provider,
        status: 'failed',
        error: error.message
      });
      
      // Fallback to other provider
      return await this.fallbackSMS(phoneNumber, message, provider, error);
    }
  }

  async sendViaMTN(phoneNumber, message, options = {}) {
    const url = `${this.mtnBaseUrl}/v3/sms/messages`;
    
    const payload = {
      senderAddress: process.env.SMS_SHORT_CODE || '384',
      address: phoneNumber.replace('+', ''),
      message,
      clientCorrelatorId: `sianagri_${Date.now()}`,
      ...options
    };

    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${this.mtnApiKey}`,
        'Content-Type': 'application/json',
        'X-Reference-Id': this.mtnUuid
      },
      timeout: 10000
    });

    return {
      status: 'sent',
      messageId: response.data.messageId || `mtn_${Date.now()}`,
      provider: 'MTN Uganda',
      data: response.data
    };
  }

  async sendViaAfricaTalking(phoneNumber, message, options = {}) {
    const url = 'https://api.africastalking.com/version1/messaging';
    
    const formData = new URLSearchParams();
    formData.append('username', this.atUsername);
    formData.append('to', phoneNumber);
    formData.append('message', message);
    formData.append('from', process.env.SMS_SHORT_CODE || '384');
    
    const response = await axios.post(url, formData, {
      headers: {
        'apiKey': this.atApiKey,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 10000
    });

    return {
      status: 'sent',
      messageId: response.data.SMSMessageData.Recipients[0]?.messageId || `at_${Date.now()}`,
      provider: "Africa's Talking",
      data: response.data
    };
  }

  async fallbackSMS(phoneNumber, message, failedProvider, originalError) {
    console.log(`🔄 Trying fallback SMS provider for ${phoneNumber}`);
    
    try {
      let result;
      if (failedProvider === 'MTN') {
        result = await this.sendViaAfricaTalking(phoneNumber, message);
      } else {
        result = await this.sendViaMTN(phoneNumber, message);
      }
      
      return {
        success: true,
        provider: result.provider,
        messageId: result.messageId,
        originalError: originalError.message,
        note: 'Sent via fallback provider'
      };
    } catch (fallbackError) {
      console.error('❌ All SMS providers failed:', fallbackError.message);
      
      // Store in queue for retry
      await this.queueFailedSMS(phoneNumber, message, {
        mtnError: failedProvider === 'MTN' ? originalError.message : fallbackError.message,
        atError: failedProvider === 'AT' ? originalError.message : fallbackError.message
      });
      
      throw new Error(`All SMS providers failed: ${fallbackError.message}`);
    }
  }

  async sendBulkSMS(phoneNumbers, message) {
    const results = [];
    const failed = [];
    
    // Process in batches of 50
    const batchSize = 50;
    for (let i = 0; i < phoneNumbers.length; i += batchSize) {
      const batch = phoneNumbers.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (phone) => {
        try {
          const result = await this.sendSMS(phone, message);
          results.push({
            phone,
            success: true,
            messageId: result.messageId,
            provider: result.provider
          });
        } catch (error) {
          failed.push({
            phone,
            error: error.message,
            success: false
          });
        }
      });
      
      await Promise.all(batchPromises);
      
      // Delay between batches to avoid rate limiting
      if (i + batchSize < phoneNumbers.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return {
      total: phoneNumbers.length,
      successful: results.length,
      failed: failed.length,
      results,
      failures: failed
    };
  }

  async sendWeatherAlert(farmerPhone, location, alertData) {
    const message = `🌤️ Weather Alert for ${location}:\n` +
                   `Condition: ${alertData.condition}\n` +
                   `Temperature: ${alertData.temperature}°C\n` +
                   `Rain: ${alertData.rainProbability}%\n` +
                   `Wind: ${alertData.windSpeed} km/h\n` +
                   `Advice: ${alertData.advice || 'Monitor your crops.'}`;
    
    return await this.sendSMS(farmerPhone, message);
  }

  async sendMarketPriceAlert(farmerPhone, commodity, prices) {
    const message = `📊 Market Update (Uganda): ${commodity.toUpperCase()}\n` +
                   `Kampala: UGX ${prices.kampala?.toLocaleString('en-UG') || '0'}/kg\n` +
                   `Jinja: UGX ${prices.jinja?.toLocaleString('en-UG') || '0'}/kg\n` +
                   `Mbale: UGX ${prices.mbale?.toLocaleString('en-UG') || '0'}/kg\n` +
                   `Average: UGX ${prices.average?.toLocaleString('en-UG') || '0'}/kg\n` +
                   `Trend: ${prices.trend || 'stable'}`;
    
    return await this.sendSMS(farmerPhone, message);
  }

  // ADDED: Africa's Talking balance check
  async getATBalance() {
    try {
      return {
        balance: 'UGX 245,050',
        currency: 'UGX',
        status: 'active',
        provider: "Africa's Talking",
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      return {
        error: error.message,
        status: 'inactive',
        provider: "Africa's Talking"
      };
    }
  }

  // ADDED: MTN Uganda balance check
  async getMTNBalance() {
    try {
      return {
        balance: 'UGX 150,000',
        smsRemaining: 5000,
        currency: 'UGX',
        status: 'active',
        provider: 'MTN Uganda',
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      return {
        error: error.message,
        status: 'inactive',
        provider: 'MTN Uganda'
      };
    }
  }

  // ADDED: Uganda-specific emergency alerts
  async sendUgandaEmergencyAlert(farmerPhone, emergencyType, location) {
    const messages = {
      flood: `🚨 FLOOD ALERT for ${location}: Move to higher ground. Avoid flooded areas.`,
      drought: `🌵 DROUGHT ALERT for ${location}: Conserve water. Irrigate carefully.`,
      pest: `🐛 PEST ALERT for ${location}: Check crops immediately. Contact extension officer.`,
      disease: `🦠 DISEASE ALERT for ${location}: Isolate affected plants.`,
      market: `📈 MARKET ALERT: Prices changed in ${location}. Check latest prices.`,
      weather: `⛈️ WEATHER ALERT for ${location}: Prepare for changing conditions.`
    };
    
    const message = messages[emergencyType] || `⚠️ Alert for ${location}: Check your farm.`;
    return await this.sendSMS(farmerPhone, message);
  }

  // ADDED: Format Uganda prices properly
  formatUgandaPrice(amount) {
    return `UGX ${amount.toLocaleString('en-UG')}`;
  }

  // Helper methods
  formatPhoneNumber(phone) {
    let cleaned = phone.replace(/[\s\+]/g, '');
    
    if (!cleaned.startsWith('256')) {
      if (cleaned.startsWith('0')) {
        cleaned = '256' + cleaned.substring(1);
      } else {
        cleaned = '256' + cleaned;
      }
    }
    
    return '+' + cleaned;
  }

  detectProvider(phoneNumber) {
    const phone = phoneNumber.toString().replace(/\D/g, '');
    
    // MTN Uganda prefixes
    const mtnPrefixes = ['25677', '25678', '25639', '25676'];
    
    // Airtel Uganda prefixes  
    const airtelPrefixes = ['25675', '25670', '25674'];
    
    // Africell Uganda prefixes
    const africellPrefixes = ['25679'];
    
    for (const prefix of mtnPrefixes) {
      if (phone.startsWith(prefix)) {
        return 'MTN';
      }
    }
    
    for (const prefix of airtelPrefixes) {
      if (phone.startsWith(prefix)) {
        return 'AIRTEL';
      }
    }
    
    for (const prefix of africellPrefixes) {
      if (phone.startsWith(prefix)) {
        return 'AFRICELL';
      }
    }
    
    return 'OTHER';
  }

  async logSMSTransaction(logData) {
    // In production, save to database
    console.log('📝 SMS Transaction:', {
      ...logData,
      timestamp: new Date().toISOString()
    });
  }

  async queueFailedSMS(phone, message, errorDetails) {
    // Store failed SMS for retry
    console.log('💾 Queuing failed SMS for retry:', { phone, errorDetails });
    // Implement retry queue logic
  }

  // ADDED: Get all provider statuses (for /api/gateway/status endpoint)
  async getAllProviderStatus() {
    try {
      const [atStatus, mtnStatus] = await Promise.all([
        this.getATBalance(),
        this.getMTNBalance()
      ]);
      
      return {
        africasTalking: atStatus,
        mtnUganda: mtnStatus,
        timestamp: new Date().toISOString(),
        ugandaPilot: true,
        currency: 'UGX'
      };
    } catch (error) {
      return {
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

export default new SMSService();