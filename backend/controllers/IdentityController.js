const UniversalIdentity = require('../models/UniversalIdentity.js');

class IdentityController {
  async verifyIdentity(req, res) {
    try {
      const { phone, nationalId } = req.body;
      
      const identity = await UniversalIdentity.findOne({
        $or: [
          { primaryPhone: phone },
          { nationalId: nationalId }
        ]
      });
      
      if (!identity) {
        return res.json({
          success: false,
          message: 'Identity not found',
          exists: false
        });
      }
      
      res.json({
        success: true,
        data: {
          exists: true,
          universalId: identity.universalId,
          kycStatus: identity.kycStatus,
          services: identity.services
        }
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Verification failed',
        error: error.message
      });
    }
  }
  
  async getIdentityProfile(req, res) {
    try {
      const { universalId } = req.params;
      
      const identity = await UniversalIdentity.findOne({ universalId });
      if (!identity) {
        return res.status(404).json({
          success: false,
          message: 'Identity not found'
        });
      }
      
      res.json({
        success: true,
        data: identity
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get identity profile',
        error: error.message
      });
    }
  }
  
  async linkService(req, res) {
    try {
      const { universalId, service, profileId } = req.body;
      
      const identity = await UniversalIdentity.findOne({ universalId });
      if (!identity) {
        return res.status(404).json({
          success: false,
          message: 'Identity not found'
        });
      }
      
      await identity.enrollInService(service, profileId);
      
      res.json({
        success: true,
        message: `Service ${service} linked successfully`,
        data: {
          universalId,
          service,
          profileId
        }
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to link service',
        error: error.message
      });
    }
  }
}

module.exports = new IdentityController();