import axios from 'axios';

class GeoIntegrationService {
  constructor() {
    this.geoApiUrl = process.env.SIANGEO_API_URL || 'http://localhost:3000';
    this.geoApiKey = process.env.SIANGEO_API_KEY;
  }

  async verifyMineLocation(coordinates, mineId) {
    try {
      const response = await axios.post(
        `${this.geoApiUrl}/api/v1/minerals/verify-location`,
        {
          coordinates,
          mineId,
          verificationType: 'mine_site'
        },
        {
          headers: { 'X-API-Key': this.geoApiKey }
        }
      );
      
      return {
        success: true,
        verified: response.data.verified,
        boundaryVerified: response.data.boundaryVerified,
        satelliteImage: response.data.satelliteImage,
        confidenceScore: response.data.confidenceScore
      };
    } catch (error) {
      console.error('Geo verification failed:', error.message);
      return {
        success: false,
        verified: false,
        error: error.message
      };
    }
  }

  async getSatelliteImagery(coordinates, date) {
    try {
      const response = await axios.get(
        `${this.geoApiUrl}/api/v1/imagery`,
        {
          params: { bbox: coordinates, date },
          headers: { 'X-API-Key': this.geoApiKey }
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('Satellite imagery fetch failed:', error.message);
      return null;
    }
  }
}

export default new GeoIntegrationService();