// backend/services/FarmerService.js
import Farmer from '../models/Farmer.js';
import UniversalIdentity from '../models/UniversalIdentity.js';

class FarmerService {
  // Register farmer via USSD/SMS
  async registerFarmer(registrationData) {
    const { phone, name, district, village } = registrationData;
    
    // Check if farmer already exists
    const existingFarmer = await Farmer.findOne({ phone });
    if (existingFarmer) {
      throw new Error('Farmer already registered');
    }
    
    // Generate universal ID
    const universalId = await this.generateUniversalId(phone);
    
    // Create farmer record
    const farmer = new Farmer({
      phone,
      name,
      universalId,
      location: {
        district,
        village
      },
      registeredVia: registrationData.source || 'ussd',
      registeredBy: registrationData.agentId || 'system'
    });
    
    await farmer.save();
    
    // Create/update universal identity
    await this.updateUniversalIdentity(universalId, phone, farmer._id);
    
    return {
      success: true,
      farmerId: farmer._id,
      universalId,
      message: 'Farmer registered successfully'
    };
  }
  
  // Link to FinTech
  async linkToFintech(farmerId, fintechData) {
    const farmer = await Farmer.findById(farmerId);
    if (!farmer) throw new Error('Farmer not found');
    
    farmer.fintechLinked = true;
    farmer.fintechUserId = fintechData.userId;
    farmer.fintechAccountNumber = fintechData.accountNumber;
    
    await farmer.save();
    
    return {
      success: true,
      message: 'Linked to FinTech successfully'
    };
  }
  
  // Get farmer profile
  async getFarmerProfile(farmerId) {
    const farmer = await Farmer.findById(farmerId);
    if (!farmer) throw new Error('Farmer not found');
    
    // Get farms associated with this farmer
    const farms = await this.getFarmerFarms(farmerId);
    
    return {
      ...farmer.toObject(),
      farms,
      fullLocation: farmer.fullLocation
    };
  }
  
  // USSD session management
  async handleUssdSession(phone, menu, data) {
    let farmer = await Farmer.findByPhone(phone);
    
    if (!farmer) {
      // Create temporary session for new users
      farmer = new Farmer({
        phone,
        status: 'pending',
        ussdSession: {
          currentMenu: menu,
          sessionData: data,
          lastActivity: new Date()
        }
      });
      await farmer.save();
    } else {
      await farmer.updateUssdSession(menu, data);
    }
    
    return farmer;
  }
  
  // Generate universal ID
  async generateUniversalId(phone) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 6);
    return `AGRI-${phone.slice(-6)}-${timestamp}-${random}`.toUpperCase();
  }
  
  // Update universal identity
  async updateUniversalIdentity(universalId, phone, farmerId) {
    let identity = await UniversalIdentity.findOne({ primaryPhone: phone });
    
    if (identity) {
      // Update existing identity
      identity.services.agritech = {
        enrolled: true,
        enrolledAt: new Date(),
        profileId: farmerId.toString(),
        lastSync: new Date()
      };
    } else {
      // Create new identity
      identity = new UniversalIdentity({
        universalId,
        primaryPhone: phone,
        services: {
          agritech: {
            enrolled: true,
            enrolledAt: new Date(),
            profileId: farmerId.toString(),
            lastSync: new Date()
          }
        },
        kycStatus: 'pending'
      });
    }
    
    await identity.save();
    return identity;
  }
  
  // Get farmer farms (placeholder - will implement Farm model later)
  async getFarmerFarms(farmerId) {
    // TODO: Implement when Farm model is created
    return [];
  }
  
  // Analytics
  async getFarmerStats(farmerId) {
    const farmer = await Farmer.findById(farmerId);
    if (!farmer) throw new Error('Farmer not found');
    
    return {
      farmCount: farmer.farmCount,
      farmSize: farmer.farmSize,
      lastActivity: farmer.ussdSession?.lastActivity || farmer.updatedAt,
      status: farmer.status,
      isVerified: farmer.isVerified,
      fintechLinked: farmer.fintechLinked
    };
  }
}

export default new FarmerService();