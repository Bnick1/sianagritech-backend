import axios from 'axios';

class FintechIntegrationService {
  constructor() {
    this.fintechApiUrl = process.env.SIANFINTECH_API_URL || 'http://localhost:8082';
    this.fintechApiKey = process.env.SIANFINTECH_API_KEY;
  }

  async processRoyaltyPayment(royaltyData) {
    try {
      // Create a payment request in SianFinTech
      const response = await axios.post(
        `${this.fintechApiUrl}/api/payments/royalty`,
        {
          amount: royaltyData.amount,
          currency: 'UGX',
          payerId: royaltyData.exporterId,
          payeeId: royaltyData.governmentEntityId,
          reference: royaltyData.reference,
          metadata: {
            mineralBatchId: royaltyData.batchId,
            mineralType: royaltyData.mineralType,
            quantity: royaltyData.quantity
          }
        },
        {
          headers: { 
            'X-API-Key': this.fintechApiKey,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return {
        success: true,
        paymentId: response.data.transactionId,
        status: response.data.status,
        receipt: response.data.receipt
      };
    } catch (error) {
      console.error('Royalty payment failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async generateInvoice(exportData) {
    try {
      const response = await axios.post(
        `${this.fintechApiUrl}/api/invoices/generate`,
        exportData,
        {
          headers: { 
            'X-API-Key': this.fintechApiKey,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('Invoice generation failed:', error.message);
      return null;
    }
  }

  async verifyPayment(paymentId) {
    try {
      const response = await axios.get(
        `${this.fintechApiUrl}/api/payments/${paymentId}`,
        {
          headers: { 'X-API-Key': this.fintechApiKey }
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('Payment verification failed:', error.message);
      return null;
    }
  }
}

export default new FintechIntegrationService();