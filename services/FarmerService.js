// backend/services/FarmerService.js - Fixed version
import Farmer from '../models/Farmer.js';
import bcrypt from 'bcrypt';
import axios from 'axios';

class FarmerService {
  // Helper: Split full name
  splitName(fullName) {
    const nameParts = fullName.trim().split(' ');
    if (nameParts.length === 1) {
      return { firstName: nameParts[0], lastName: nameParts[0] };
    }
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ');
    return { firstName, lastName };
  }

  // Normalize phone number
  normalizePhone(phone) {
    if (!phone) return phone;
    let normalized = phone.replace(/\s/g, '');
    if (normalized.startsWith('0')) {
      normalized = '+256' + normalized.substring(1);
    } else if (normalized.startsWith('256') && !normalized.startsWith('+')) {
      normalized = '+' + normalized;
    } else if (!normalized.startsWith('+')) {
      normalized = '+' + normalized;
    }
    return normalized;
  }

  // Register farmer
  async registerFarmer(registrationData) {
    const { phone, name, district, village, nationalId, source, agentId } = registrationData;
    
    // Normalize phone
    const normalizedPhone = this.normalizePhone(phone);
    
    console.log('📝 Registering farmer:', { phone: normalizedPhone, name, district, village });
    
    try {
      // Check if farmer already exists
      const existingFarmer = await Farmer.findOne({ phone: normalizedPhone });
      if (existingFarmer) {
        throw new Error('Farmer already registered with this phone number');
      }
      
      // Generate a simple password (phone last 6 digits)
      const hashedPassword = await bcrypt.hash(normalizedPhone.slice(-6), 10);
      
      // Create farmer record with minimal required fields
      const farmer = new Farmer({
        phone: normalizedPhone,
        name: name,
        password: hashedPassword,
        nationalId: nationalId || null,
        location: {
          district: district || 'Unknown',
          village: village || 'Unknown'
        },
        registrationSource: source || 'ussd',
        status: 'active',
        isVerified: true,
        creditScore: 50
      });
      
      await farmer.save();
      console.log('✅ Farmer saved successfully:', farmer._id);
      
      // Update farmer with farmerId based on _id
      const farmerId = `FARM-${farmer._id.toString().slice(-8).toUpperCase()}`;
      farmer.farmerId = farmerId;
      await farmer.save();
      
      return {
        success: true,
        farmerId: farmerId,
        universalId: farmerId,
        pdmEnrolled: false,
        emyoogaGroup: null,
        message: 'Farmer registered successfully'
      };
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }
  
  // Find farmer by phone number
  async findByPhone(phoneNumber) {
    const normalizedPhone = this.normalizePhone(phoneNumber);
    console.log(`🔍 Looking for farmer: ${normalizedPhone}`);
    
    try {
      const farmer = await Farmer.findOne({ phone: normalizedPhone });
      if (!farmer) {
        console.log('❌ Farmer not found');
        return null;
      }
      
      console.log('✅ Farmer found:', farmer.name);
      
      return {
        _id: farmer._id,
        phone: farmer.phone,
        name: farmer.name,
        nationalId: farmer.nationalId,
        creditScore: farmer.creditScore || 50,
        verified: farmer.isVerified || false,
        status: farmer.status,
        pdmEnrolled: false,
        emyoogaGroup: null,
        location: farmer.location || {},
        loanHistory: farmer.loanHistory || []
      };
    } catch (error) {
      console.error('Find by phone error:', error);
      return null;
    }
  }
  
  // Find farmer by ID
  async findById(farmerId) {
    try {
      const farmer = await Farmer.findById(farmerId);
      if (!farmer) return null;
      return farmer;
    } catch (error) {
      console.error('Find by ID error:', error);
      return null;
    }
  }
  
  // Save loan application
  async saveLoanApplication(phone, loanData) {
    const farmer = await this.findByPhone(phone);
    if (!farmer) {
      throw new Error('Farmer not found');
    }
    
    const loan = {
      id: `LN_${Date.now()}`,
      farmerId: farmer._id,
      ...loanData,
      status: 'pending',
      appliedAt: new Date().toISOString()
    };
    
    // Update farmer's loan history
    await Farmer.updateOne(
      { _id: farmer._id },
      { $push: { loanHistory: loan } }
    );
    
    return loan;
  }
  
  // Get farmer stats
  async getFarmerStats(farmerId) {
    const farmer = await Farmer.findById(farmerId);
    if (!farmer) throw new Error('Farmer not found');
    
    return {
      farmCount: farmer.farmCount || 0,
      farmSize: farmer.farmSize || 0,
      status: farmer.status,
      isVerified: farmer.isVerified,
      creditScore: farmer.creditScore || 50
    };
  }
  
  // USSD session management (temporary storage)
  ussdSessions = new Map();
  
  async handleUssdSession(phone, menu, data) {
    const session = this.ussdSessions.get(phone) || {};
    session[menu] = data;
    session.lastActivity = new Date();
    this.ussdSessions.set(phone, session);
    return session;
  }
}

export default new FarmerService();
