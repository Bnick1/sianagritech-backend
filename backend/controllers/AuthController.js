// backend/controllers/AuthController.js
import authMiddleware from '../middleware/auth.js';
import validation from '../middleware/validation.js';
import Farmer from '../models/Farmer.js';

class AuthController {
  // Farmer registration
  async register(req, res) {
    try {
      const { phone, name, password, location, farmSize, primaryCrop } = req.body;
      
      // Check if farmer already exists
      const existingFarmer = await Farmer.findOne({ phone });
      if (existingFarmer) {
        return res.status(409).json({
          success: false,
          error: 'Farmer with this phone number already exists'
        });
      }

      // Hash password
      const hashedPassword = await authMiddleware.hashPassword(password);

      // Generate OTP for verification
      const verificationCode = authMiddleware.generateOTP();
      
      // Create farmer
      const farmer = new Farmer({
        phone,
        name,
        password: hashedPassword,
        location,
        farmSize,
        primaryCrop,
        verificationCode,
        verificationExpires: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        status: 'pending'
      });

      await farmer.save();

      // In production: Send OTP via SMS
      console.log(`OTP for ${phone}: ${verificationCode}`);

      res.status(201).json({
        success: true,
        message: 'Registration successful. Please verify your phone.',
        data: {
          farmerId: farmer._id,
          phone: farmer.phone,
          requiresVerification: true
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        error: 'Registration failed'
      });
    }
  }

  // Farmer login
  async login(req, res) {
    try {
      const { phone, password } = req.body;
      
      // Find farmer
      const farmer = await Farmer.findOne({ phone });
      if (!farmer) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }

      // Check if account is verified
      if (farmer.status !== 'active') {
        return res.status(403).json({
          success: false,
          error: 'Account not verified. Please verify your phone first.'
        });
      }

      // Verify password
      const isValidPassword = await authMiddleware.verifyPassword(password, farmer.password);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }

      // Generate tokens
      const accessToken = authMiddleware.generateToken(farmer);
      const refreshToken = await authMiddleware.generateRefreshToken(farmer);

      // Update last login
      farmer.lastLogin = new Date();
      await farmer.save();

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          accessToken,
          refreshToken,
          farmer: {
            id: farmer._id,
            phone: farmer.phone,
            name: farmer.name,
            role: farmer.role,
            status: farmer.status
          }
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: 'Login failed'
      });
    }
  }

  // Phone verification
  async verifyPhone(req, res) {
    try {
      const { phone, code } = req.body;
      
      const farmer = await Farmer.findOne({ 
        phone,
        verificationCode: code,
        verificationExpires: { $gt: new Date() }
      });

      if (!farmer) {
        return res.status(400).json({
          success: false,
          error: 'Invalid or expired verification code'
        });
      }

      // Mark as verified
      farmer.status = 'active';
      farmer.isVerified = true;
      farmer.verificationCode = undefined;
      farmer.verificationExpires = undefined;
      farmer.verifiedAt = new Date();

      await farmer.save();

      // Generate tokens after verification
      const accessToken = authMiddleware.generateToken(farmer);
      const refreshToken = await authMiddleware.generateRefreshToken(farmer);

      res.json({
        success: true,
        message: 'Phone verified successfully',
        data: {
          accessToken,
          refreshToken,
          farmer: {
            id: farmer._id,
            phone: farmer.phone,
            name: farmer.name
          }
        }
      });
    } catch (error) {
      console.error('Verification error:', error);
      res.status(500).json({
        success: false,
        error: 'Verification failed'
      });
    }
  }

  // Resend verification code
  async resendVerification(req, res) {
    try {
      const { phone } = req.body;
      
      const farmer = await Farmer.findOne({ phone });
      if (!farmer) {
        return res.status(404).json({
          success: false,
          error: 'Farmer not found'
        });
      }

      if (farmer.status === 'active') {
        return res.status(400).json({
          success: false,
          error: 'Account already verified'
        });
      }

      // Generate new OTP
      const verificationCode = authMiddleware.generateOTP();
      farmer.verificationCode = verificationCode;
      farmer.verificationExpires = new Date(Date.now() + 10 * 60 * 1000);

      await farmer.save();

      // In production: Send OTP via SMS
      console.log(`New OTP for ${phone}: ${verificationCode}`);

      res.json({
        success: true,
        message: 'Verification code resent'
      });
    } catch (error) {
      console.error('Resend verification error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to resend verification code'
      });
    }
  }

  // Refresh token
  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          error: 'Refresh token required'
        });
      }

      const result = await authMiddleware.refreshAccessToken(refreshToken);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(401).json({
        success: false,
        error: 'Invalid refresh token'
      });
    }
  }

  // Logout
  async logout(req, res) {
    try {
      const token = req.token;
      
      if (token) {
        authMiddleware.blacklistToken(token);
      }

      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        error: 'Logout failed'
      });
    }
  }

  // Get current user profile
  async getProfile(req, res) {
    try {
      const farmer = await Farmer.findById(req.user.id)
        .select('-password -verificationCode')
        .lean();

      if (!farmer) {
        return res.status(404).json({
          success: false,
          error: 'Farmer not found'
        });
      }

      res.json({
        success: true,
        data: farmer
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get profile'
      });
    }
  }

  // Update profile
  async updateProfile(req, res) {
    try {
      const updates = req.body;
      delete updates.password; // Prevent password update via this endpoint
      delete updates.phone; // Prevent phone change via this endpoint
      delete updates.status; // Prevent status change via this endpoint

      const farmer = await Farmer.findByIdAndUpdate(
        req.user.id,
        { $set: updates },
        { new: true, runValidators: true }
      ).select('-password -verificationCode');

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: farmer
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update profile'
      });
    }
  }

  // Change password
  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      
      const farmer = await Farmer.findById(req.user.id);
      
      // Verify current password
      const isValid = await authMiddleware.verifyPassword(currentPassword, farmer.password);
      if (!isValid) {
        return res.status(400).json({
          success: false,
          error: 'Current password is incorrect'
        });
      }

      // Hash new password
      farmer.password = await authMiddleware.hashPassword(newPassword);
      await farmer.save();

      // Blacklist all tokens for security
      // In production, you might want to implement token invalidation

      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to change password'
      });
    }
  }

  // Forgot password - request reset
  async forgotPassword(req, res) {
    try {
      const { phone } = req.body;
      
      const farmer = await Farmer.findOne({ phone });
      if (!farmer) {
        // Don't reveal if user exists for security
        return res.json({
          success: true,
          message: 'If an account exists, a reset code will be sent'
        });
      }

      // Generate reset code
      const resetCode = authMiddleware.generateOTP();
      farmer.resetPasswordCode = resetCode;
      farmer.resetPasswordExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

      await farmer.save();

      // In production: Send reset code via SMS
      console.log(`Password reset code for ${phone}: ${resetCode}`);

      res.json({
        success: true,
        message: 'Password reset code sent'
      });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process password reset'
      });
    }
  }

  // Reset password with code
  async resetPassword(req, res) {
    try {
      const { phone, code, newPassword } = req.body;
      
      const farmer = await Farmer.findOne({
        phone,
        resetPasswordCode: code,
        resetPasswordExpires: { $gt: new Date() }
      });

      if (!farmer) {
        return res.status(400).json({
          success: false,
          error: 'Invalid or expired reset code'
        });
      }

      // Update password
      farmer.password = await authMiddleware.hashPassword(newPassword);
      farmer.resetPasswordCode = undefined;
      farmer.resetPasswordExpires = undefined;

      await farmer.save();

      res.json({
        success: true,
        message: 'Password reset successfully'
      });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to reset password'
      });
    }
  }
}

export default new AuthController();