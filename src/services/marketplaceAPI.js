import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'https://api.siantechnologies.tech';

class MarketplaceAPI {
  constructor() {
    this.api = axios.create({
      baseURL: `${API_BASE}/api/v1/marketplace`,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Add auth token to requests
    this.api.interceptors.request.use(config => {
      const token = localStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  async getCurrentUser() {
    try {
      const response = await this.api.get('/user');
      return response.data;
    } catch (error) {
      console.error('Failed to get user:', error);
      throw error;
    }
  }

  async getFinancingStatus() {
    try {
      const response = await this.api.get('/financing/status');
      return response.data;
    } catch (error) {
      console.error('Failed to get financing:', error);
      throw error;
    }
  }

  async applyForLoan(application) {
    try {
      const response = await this.api.post('/financing/apply', application);
      return response.data;
    } catch (error) {
      console.error('Failed to apply for loan:', error);
      throw error;
    }
  }

  async createOrder(order) {
    try {
      const response = await this.api.post('/orders', order);
      return response.data;
    } catch (error) {
      console.error('Failed to create order:', error);
      throw error;
    }
  }

  async processFinancingPayment(payment) {
    try {
      const response = await this.api.post('/financing/pay', payment);
      return response.data;
    } catch (error) {
      console.error('Failed to process financing payment:', error);
      throw error;
    }
  }

  async processWalletPayment(payment) {
    try {
      const response = await this.api.post('/wallet/pay', payment);
      return response.data;
    } catch (error) {
      console.error('Failed to process wallet payment:', error);
      throw error;
    }
  }
}

export default new MarketplaceAPI();