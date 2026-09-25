// services/AgriTechGeoService.js
// Connects SianAgriTech to SianGeo for geospatial intelligence

import axios from 'axios';

class AgriTechGeoService {
    constructor() {
        this.geoApiUrl = process.env.SIAN_GEO_URL || 'https://api-gateway-navy.vercel.app';
        this.geoApiKey = process.env.SIAN_GEO_API_KEY || 'sian_geo_2026';
        this.timeout = 10000;
    }

    /**
     * Get crop health for a farm (for farmer advisory)
     */
    async getCropHealth(farmId) {
        try {
            const response = await axios.get(`${this.geoApiUrl}/api/satellite/ndvi/farm/${farmId}`, {
                headers: { 'X-API-Key': this.geoApiKey },
                timeout: this.timeout
            });
            return response.data.data;
        } catch (error) {
            console.warn('⚠️ SianGeo crop health unavailable:', error.message);
            return null;
        }
    }

    /**
     * Get weather data for a location
     */
    async getWeather(lat, lon) {
        try {
            const response = await axios.post(`${this.geoApiUrl}/api/weather/current`, {
                lat,
                lon
            }, {
                headers: { 'X-API-Key': this.geoApiKey },
                timeout: this.timeout
            });
            return response.data.data;
        } catch (error) {
            console.warn('⚠️ Weather data unavailable:', error.message);
            return null;
        }
    }

    /**
     * Get drought risk assessment
     */
    async getDroughtRisk(district, farmId) {
        try {
            const response = await axios.post(`${this.geoApiUrl}/api/climate/drought-risk`, {
                district,
                farmId
            }, {
                headers: { 'X-API-Key': this.geoApiKey },
                timeout: this.timeout
            });
            return response.data.data;
        } catch (error) {
            console.warn('⚠️ Drought risk assessment unavailable:', error.message);
            return null;
        }
    }

    /**
     * Get farm advisory (combines geospatial + agritech data)
     */
    async getFarmAdvisory(farmerId, farmId) {
        try {
            // Get farmer data
            const Farmer = mongoose.model('Farmer');
            const farmer = await Farmer.findById(farmerId);
            if (!farmer) {
                throw new Error('Farmer not found');
            }

            // Get geospatial data
            const geoData = await this.getCropHealth(farmId);
            const weatherData = farmer.location?.coordinates ? 
                await this.getWeather(farmer.location.coordinates[0], farmer.location.coordinates[1]) : null;

            // Generate advisory
            const advisory = this.generateAdvisory(geoData, weatherData);

            return {
                farmer: farmer.getPublicProfile(),
                geospatial: geoData,
                weather: weatherData,
                advisory,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Farm advisory error:', error);
            return {
                error: error.message,
                advisory: {
                    status: 'unavailable',
                    message: 'Unable to generate advisory at this time'
                }
            };
        }
    }

    generateAdvisory(geoData, weatherData) {
        const recommendations = [];

        // Crop health advisory
        if (geoData && geoData.cropHealth) {
            const health = geoData.cropHealth;
            if (health > 80) {
                recommendations.push('✅ Excellent crop health. Continue current practices.');
            } else if (health > 60) {
                recommendations.push('📈 Good crop health. Monitor for any changes.');
            } else if (health > 40) {
                recommendations.push('⚠️ Moderate crop health. Consider irrigation and fertilization.');
            } else {
                recommendations.push('🚨 URGENT: Crop stress detected. Immediate intervention required.');
            }
        }

        // Weather advisory
        if (weatherData) {
            if (weatherData.rainfall && weatherData.rainfall < 20) {
                recommendations.push('☀️ Low rainfall expected. Schedule irrigation.');
            }
            if (weatherData.temperature && weatherData.temperature > 35) {
                recommendations.push('🌡️ High temperatures forecasted. Protect crops from heat stress.');
            }
        }

        return {
            status: recommendations.length > 0 ? 'available' : 'no_data',
            recommendations: recommendations.length > 0 ? recommendations : ['No specific recommendations at this time'],
            generatedAt: new Date().toISOString()
        };
    }
}

export default new AgriTechGeoService();