// services/IdentityService.js
import UniversalIdentity from '../models/UniversalIdentity.js';
import crypto from 'crypto';

class IdentityService {
  constructor() {
    this.encryptionKey = process.env.IDENTITY_ENCRYPTION_KEY;
  }
  
  // Create universal identity
  async createIdentity(identityData) {
    const identity = new UniversalIdentity({
      primaryPhone: identityData.phone,
      email: identityData.email,
      nationalId: identityData.nationalId,
      biometric: identityData.biometric ? this.encryptBiometric(identityData.biometric) : undefined
    });
    
    return await identity.save();
  }
  
  // Enroll in specific service
  async enrollService(universalId, service, serviceProfileId) {
    const identity = await UniversalIdentity.findOne({ universalId });
    if (!identity) throw new Error('Identity not found');
    
    await identity.enrollInService(service, serviceProfileId);
    
    // Emit event
    this.emitEvent('identity.service_enrolled', {
      universalId,
      service,
      timestamp: new Date()
    });
    
    return identity;
  }
  
  // Verify identity using multiple factors
  async verifyIdentity(verificationData) {
    const { phone, nationalId, biometric } = verificationData;
    
    const identity = await UniversalIdentity.findOne({
      $or: [
        { primaryPhone: phone },
        { nationalId: nationalId }
      ]
    });
    
    if (!identity) {
      return { verified: false, reason: 'identity_not_found' };
    }
    
    let verificationScore = 0;
    
    // Phone verification
    if (phone === identity.primaryPhone) verificationScore += 30;
    
    // National ID verification
    if (nationalId && nationalId === identity.nationalId) verificationScore += 40;
    
    // Biometric verification
    if (biometric && identity.biometric) {
      const match = await this.verifyBiometric(biometric, identity.biometric);
      if (match) verificationScore += 30;
    }
    
    const verified = verificationScore >= 70;
    
    if (verified) {
      identity.identityVerifications.push({
        method: 'multi_factor',
        verifiedBy: 'system',
        verifiedAt: new Date(),
        confidenceScore: verificationScore
      });
      
      if (verificationScore >= 85) {
        identity.kycStatus = 'verified';
        identity.kycTier = 'tier2';
      }
      
      await identity.save();
    }
    
    return {
      verified,
      universalId: identity.universalId,
      confidenceScore: verificationScore,
      kycStatus: identity.kycStatus
    };
  }
  
  // Get consolidated profile across services
  async getConsolidatedProfile(universalId, requestingService) {
    const identity = await UniversalIdentity.findOne({ universalId });
    if (!identity) throw new Error('Identity not found');
    
    // Check consent
    const hasConsent = identity.consents.some(
      consent => consent.service === requestingService && consent.granted
    );
    
    if (!hasConsent) {
      throw new Error('Consent required for cross-service profile access');
    }
    
    return identity.getCrossServiceProfile();
  }
  
  // Private methods
  encryptBiometric(biometricData) {
    const cipher = crypto.createCipher('aes-256-gcm', this.encryptionKey);
    return {
      fingerprintHash: cipher.update(biometricData.fingerprint, 'utf8', 'hex'),
      facialRecognitionHash: cipher.update(biometricData.facial, 'utf8', 'hex')
    };
  }
  
  async verifyBiometric(inputBiometric, storedBiometric) {
    // Simplified biometric verification
    // In production, use proper biometric matching libraries
    return true;
  }
  
  emitEvent(eventType, data) {
    // Connect to event bus
    EventBus.publish(eventType, data);
  }
}

export default new IdentityService();