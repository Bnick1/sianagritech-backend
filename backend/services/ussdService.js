// backend/services/ussdService.js
import FarmerService from './FarmerService.js';

class USSDService {
  async handleRequest(sessionId, phoneNumber, serviceCode, text) {
    console.log(`📱 USSD: ${phoneNumber} - "${text}"`);
    
    const farmer = await FarmerService.findByPhone(phoneNumber);
    const selections = text ? text.split('*') : [];
    const step = selections.length;
    
    // Main menu
    if (!text || text === '') {
      if (farmer) {
        return `CON Welcome back, ${farmer.name}!

1. My Credit Score
2. Apply for Loan
3. Government Programs
4. Help`;
      } else {
        return `CON Welcome to SianAgriTech!

1. Register Now
2. Help`;
      }
    }
    
    // Registration flow
    if (!farmer && selections[0] === '1') {
      if (step === 1) {
        return `CON Enter your National ID (NIN):`;
      }
      if (step === 2) {
        return `CON Enter your full name:`;
      }
      if (step === 3) {
        return `CON Enter your district:`;
      }
      if (step === 4) {
        return `CON Enter your village:`;
      }
      if (step === 5) {
        const nationalId = selections[1];
        const name = selections[2];
        const district = selections[3];
        const village = selections[4];
        
        try {
          const result = await FarmerService.registerFarmer({
            phone: phoneNumber,
            name,
            district,
            village,
            nationalId,
            source: 'ussd'
          });
          
          return `END ✅ REGISTRATION SUCCESSFUL!

Farmer ID: ${result.farmerId}
Name: ${name}
Credit Score: 50/100

Dial *384# to check your credit score!`;
        } catch (error) {
          return `END ❌ Registration failed: ${error.message}`;
        }
      }
    }
    
    // Credit score
    if (farmer && selections[0] === '1') {
      return `END 📊 CREDIT SCORE REPORT

Name: ${farmer.name}
Credit Score: ${farmer.creditScore}/100
Risk Level: ${farmer.creditScore >= 70 ? 'Low' : farmer.creditScore >= 50 ? 'Medium' : 'High'}

Loan Limit: UGX ${(farmer.creditScore * 25000).toLocaleString()}

Dial *384# → 2 to apply for a loan.`;
    }
    
    // Loan application
    if (farmer && selections[0] === '2') {
      return `END 💰 LOAN APPLICATION

Your credit score: ${farmer.creditScore}/100
Maximum loan: UGX ${(farmer.creditScore * 25000).toLocaleString()}

Application submitted!
A loan officer will contact you within 24 hours.`;
    }
    
    // Help
    if (selections[0] === '2' || selections[0] === '4') {
      return `END 📞 HELP

Commands:
• Dial *384# for main menu

Services:
1. Registration
2. Credit Score
3. Loans
4. Government Programs

Support: +256 741 430 326`;
    }
    
    return 'END Invalid option. Dial *384# to start over.';
  }
}

export default new USSDService();
