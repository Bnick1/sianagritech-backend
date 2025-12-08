// backend/services/ussdService.js
import FarmerService from './FarmerService.js';

class USSDService {
  async handleRequest(sessionId, phoneNumber, serviceCode, text) {
    console.log(`USSD: ${phoneNumber} - ${text}`);
    
    const selections = text.split('*');
    const currentStep = selections.length;
    const lastInput = selections[selections.length - 1];
    
    // Handle farmer registration flow
    if (text === '') {
      return `CON Welcome to SianAgriTech!
1. Register as Farmer
2. Weather Forecast
3. Market Prices
4. Farm Advisory
5. Loan Services
6. My Account`;
    }
    
    // First selection
    if (currentStep === 1) {
      switch (lastInput) {
        case '1':
          return 'CON Enter your name:';
        case '6':
          return `CON My Account:
1. Check Profile
2. Farm Status
3. Loan Status
4. Insurance`;
        default:
          return this.handleOtherServices(lastInput, selections);
      }
    }
    
    // Farmer registration flow
    if (selections[0] === '1') {
      return await this.handleFarmerRegistration(phoneNumber, selections);
    }
    
    return 'END Thank you for using SianAgriTech!';
  }
  
  async handleFarmerRegistration(phone, selections) {
    const step = selections.length;
    
    switch (step) {
      case 2: // Got name
        await FarmerService.handleUssdSession(phone, 'registration_name', { name: selections[1] });
        return 'CON Enter your district:';
        
      case 3: // Got district
        await FarmerService.handleUssdSession(phone, 'registration_district', { 
          district: selections[2],
          name: selections[1]
        });
        return 'CON Enter your village:';
        
      case 4: // Got village
        const registrationData = {
          phone,
          name: selections[1],
          district: selections[2],
          village: selections[3],
          source: 'ussd'
        };
        
        try {
          const result = await FarmerService.registerFarmer(registrationData);
          return `END Registration successful!
Your Farmer ID: ${result.farmerId}
Dial *384# for services.`;
        } catch (error) {
          return `END ${error.message}`;
        }
        
      default:
        return 'END Invalid input. Dial *384# to start again.';
    }
  }
  
  handleOtherServices(selection, selections) {
    // Your existing logic for weather, prices, etc.
    switch (selection) {
      case '2': // Weather
        return 'CON Enter location for weather forecast:';
      case '3': // Market Prices
        return `CON Select commodity:
1. Maize
2. Beans
3. Coffee
4. Bananas
5. Cassava`;
      case '4': // Farm Advisory
        return `CON Farm Advisory:
1. Pest Control
2. Fertilizer Use
3. Irrigation Tips
4. Soil Testing`;
      case '5': // Loan Services
        return `CON Loan Services:
1. Apply for Loan
2. Check Loan Status
3. Make Repayment
4. Loan Calculator`;
      default:
        return 'END Service coming soon. Thank you!';
    }
  }
}

export default new USSDService();