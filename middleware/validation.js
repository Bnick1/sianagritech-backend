// backend/middleware/validation.js
import { body, query, param, validationResult, header } from 'express-validator';

// Simple HTML sanitizer (no external dependencies)
const sanitizeHtml = (input, options = {}) => {
  if (!input || typeof input !== 'string') return input || '';
  
  let output = input;
  const config = {
    allowedTags: options.allowedTags || [],
    allowedAttributes: options.allowedAttributes || {},
    disallowedTagsMode: options.disallowedTagsMode || 'escape'
  };
  
  // Basic XSS prevention
  const dangerousPatterns = [
    /<script\b[^>]*>(.*?)<\/script>/gi,
    /javascript:[^'"]*/gi,
    /on\w+\s*=/gi,
    /expression\s*\(/gi,
    /vbscript:/gi,
    /data:/gi
  ];
  
  dangerousPatterns.forEach(pattern => {
    output = output.replace(pattern, '');
  });
  
  if (config.disallowedTagsMode === 'escape') {
    const escapeMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;'
    };
    output = output.replace(/[&<>"'\/]/g, match => escapeMap[match]);
  }
  
  return output.trim();
};

class ValidationMiddleware {
  constructor() {
    this.rules = this.initializeRules();
  }

  initializeRules() {
    return {
      // USSD validation
      ussd: [
        body('sessionId')
          .notEmpty().withMessage('Session ID is required')
          .isString().withMessage('Session ID must be a string')
          .isLength({ min: 10, max: 100 }).withMessage('Session ID must be 10-100 characters'),
        
        body('phoneNumber')
          .notEmpty().withMessage('Phone number is required')
          .matches(/^\+?[1-9]\d{1,14}$/).withMessage('Invalid phone number format')
          .customSanitizer(value => value.replace(/\s+/g, '')),
        
        body('serviceCode')
          .notEmpty().withMessage('Service code is required')
          .matches(/^\*\d+#$/).withMessage('Invalid service code format'),
        
        body('text')
          .optional()
          .isString().withMessage('Text must be a string')
          .trim()
          .escape()
      ],

      // SMS validation
      sms: [
        body('from')
          .notEmpty().withMessage('Sender number is required')
          .matches(/^\+?[1-9]\d{1,14}$/).withMessage('Invalid sender number'),
        
        body('text')
          .notEmpty().withMessage('Message text is required')
          .isString().withMessage('Text must be a string')
          .isLength({ min: 1, max: 160 }).withMessage('Message must be 1-160 characters')
          .customSanitizer(value => this.sanitizeText(value)),
        
        body('to').optional().isString(),
        body('date').optional().isISO8601(),
        body('id').optional().isString()
      ],

      // Farmer registration
      farmerRegistration: [
        body('phone')
          .notEmpty().withMessage('Phone number is required')
          .matches(/^\+?[1-9]\d{1,14}$/).withMessage('Invalid phone number format')
          .customSanitizer(value => value.replace(/\s+/g, '')),
        
        body('name')
          .notEmpty().withMessage('Name is required')
          .isString().withMessage('Name must be a string')
          .isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters')
          .customSanitizer(value => this.sanitizeName(value)),
        
        body('password')
          .notEmpty().withMessage('Password is required')
          .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
        
        body('location.district')
          .optional()
          .isString().withMessage('District must be a string')
          .isLength({ max: 100 }).withMessage('District too long'),
        
        body('farmSize')
          .optional()
          .isFloat({ min: 0.1, max: 1000 }).withMessage('Farm size must be 0.1-1000 acres'),
        
        body('primaryCrop')
          .optional()
          .isString().withMessage('Primary crop must be a string')
          .isIn(['maize', 'coffee', 'tea', 'bananas', 'beans', 'rice', 'other'])
          .withMessage('Invalid crop type')
      ],

      // Farmer login (using phone)
      farmerLogin: [
        body('phone')
          .notEmpty().withMessage('Phone number is required')
          .matches(/^\+?[1-9]\d{1,14}$/).withMessage('Invalid phone number format')
          .customSanitizer(value => value.replace(/\s+/g, '')),
        
        body('password')
          .notEmpty().withMessage('Password is required')
          .isString().withMessage('Password must be a string')
      ],

      // Phone verification
      phoneVerification: [
        body('phone')
          .notEmpty().withMessage('Phone number is required')
          .matches(/^\+?[1-9]\d{1,14}$/).withMessage('Invalid phone number format')
          .customSanitizer(value => value.replace(/\s+/g, '')),
        
        body('code')
          .notEmpty().withMessage('Verification code is required')
          .isString().withMessage('Code must be a string')
          .isLength({ min: 4, max: 6 }).withMessage('Code must be 4-6 characters')
          .matches(/^\d+$/).withMessage('Code must contain only digits'),
        
        body('sessionId')
          .optional()
          .isString().withMessage('Session ID must be a string')
      ],

      // Sensor data
      sensorData: [
        body('sensorId')
          .notEmpty().withMessage('Sensor ID is required')
          .isString().withMessage('Sensor ID must be a string')
          .matches(/^[A-Z0-9_-]+$/).withMessage('Invalid sensor ID format'),
        
        body('farmId')
          .notEmpty().withMessage('Farm ID is required')
          .isMongoId().withMessage('Invalid farm ID format'),
        
        body('readings')
          .notEmpty().withMessage('Readings are required')
          .isObject().withMessage('Readings must be an object'),
        
        body('readings.temperature')
          .optional()
          .isFloat({ min: -50, max: 100 }).withMessage('Temperature must be -50 to 100°C'),
        
        body('readings.soilMoisture')
          .optional()
          .isFloat({ min: 0, max: 100 }).withMessage('Soil moisture must be 0-100%'),
        
        body('readings.humidity')
          .optional()
          .isFloat({ min: 0, max: 100 }).withMessage('Humidity must be 0-100%'),
        
        body('readings.phLevel')
          .optional()
          .isFloat({ min: 0, max: 14 }).withMessage('pH level must be 0-14'),
        
        body('readings.nitrogen')
          .optional()
          .isFloat({ min: 0, max: 100 }).withMessage('Nitrogen must be 0-100%'),
        
        body('timestamp')
          .optional()
          .isISO8601().withMessage('Invalid timestamp format')
          .default(() => new Date().toISOString())
      ],

      // Pagination
      pagination: [
        query('page')
          .optional()
          .isInt({ min: 1 }).withMessage('Page must be a positive integer')
          .default(1),
        
        query('limit')
          .optional()
          .isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100')
          .default(20),
        
        query('sort')
          .optional()
          .isString().withMessage('Sort must be a string')
          .isIn(['asc', 'desc', 'createdAt', 'updatedAt', 'name', 'date'])
          .withMessage('Invalid sort field'),
        
        query('search')
          .optional()
          .isString().withMessage('Search must be a string')
          .isLength({ max: 100 }).withMessage('Search too long')
          .customSanitizer(value => this.sanitizeSearch(value))
      ],

      // Authentication (email-based)
      login: [
        body('email')
          .notEmpty().withMessage('Email is required')
          .isEmail().withMessage('Invalid email format')
          .normalizeEmail(),
        
        body('password')
          .notEmpty().withMessage('Password is required')
          .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
      ],

      // User registration (email-based)
      register: [
        body('email')
          .notEmpty().withMessage('Email is required')
          .isEmail().withMessage('Invalid email format')
          .normalizeEmail(),
        
        body('password')
          .notEmpty().withMessage('Password is required')
          .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
        
        body('confirmPassword')
          .notEmpty().withMessage('Confirm password is required')
          .custom((value, { req }) => {
            if (value !== req.body.password) {
              throw new Error('Passwords do not match');
            }
            return true;
          }),
        
        body('name')
          .notEmpty().withMessage('Name is required')
          .isString().withMessage('Name must be a string')
          .isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters')
          .customSanitizer(value => this.sanitizeName(value)),
        
        body('role')
          .optional()
          .isString().withMessage('Role must be a string')
          .isIn(['farmer', 'admin', 'agent', 'viewer'])
          .withMessage('Invalid role')
          .default('farmer')
      ],

      // API Key validation
      apiKey: [
        header('x-api-key')
          .notEmpty().withMessage('API key is required')
          .isString().withMessage('API key must be a string')
          .isLength({ min: 32, max: 64 }).withMessage('Invalid API key length')
      ],

      // ID parameter validation
      idParam: [
        param('id')
          .notEmpty().withMessage('ID is required')
          .isMongoId().withMessage('Invalid ID format')
      ],

      // Farmer update validation
      farmerUpdate: [
        param('id')
          .notEmpty().withMessage('ID is required')
          .isMongoId().withMessage('Invalid ID format'),
        
        body('name')
          .optional()
          .isString().withMessage('Name must be a string')
          .isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters')
          .customSanitizer(value => this.sanitizeName(value)),
        
        body('location.district')
          .optional()
          .isString().withMessage('District must be a string')
          .isLength({ max: 100 }).withMessage('District too long'),
        
        body('farmSize')
          .optional()
          .isFloat({ min: 0.1, max: 1000 }).withMessage('Farm size must be 0.1-1000 acres'),
        
        body('primaryCrop')
          .optional()
          .isString().withMessage('Primary crop must be a string')
          .isIn(['maize', 'coffee', 'tea', 'bananas', 'beans', 'rice', 'other'])
          .withMessage('Invalid crop type'),
        
        body('status')
          .optional()
          .isString().withMessage('Status must be a string')
          .isIn(['active', 'inactive', 'suspended'])
          .withMessage('Invalid status')
      ],

      // Crop data submission
      cropData: [
        body('cropType')
          .notEmpty().withMessage('Crop type is required')
          .isString().withMessage('Crop type must be a string')
          .isIn(['maize', 'coffee', 'tea', 'bananas', 'beans', 'rice', 'wheat', 'sorghum', 'other'])
          .withMessage('Invalid crop type'),
        
        body('plantingDate')
          .notEmpty().withMessage('Planting date is required')
          .isISO8601().withMessage('Invalid date format'),
        
        body('expectedHarvestDate')
          .notEmpty().withMessage('Expected harvest date is required')
          .isISO8601().withMessage('Invalid date format')
          .custom((value, { req }) => {
            if (new Date(value) <= new Date(req.body.plantingDate)) {
              throw new Error('Harvest date must be after planting date');
            }
            return true;
          }),
        
        body('area')
          .notEmpty().withMessage('Area is required')
          .isFloat({ min: 0.1, max: 1000 }).withMessage('Area must be 0.1-1000 acres'),
        
        body('location.coordinates')
          .optional()
          .isArray().withMessage('Coordinates must be an array')
          .custom((value) => {
            if (value.length !== 2) {
              throw new Error('Coordinates must be [longitude, latitude]');
            }
            if (!value.every(coord => typeof coord === 'number')) {
              throw new Error('Coordinates must be numbers');
            }
            return true;
          })
      ],

      // Weather alert subscription
      weatherAlert: [
        body('phone')
          .notEmpty().withMessage('Phone number is required')
          .matches(/^\+?[1-9]\d{1,14}$/).withMessage('Invalid phone number format')
          .customSanitizer(value => value.replace(/\s+/g, '')),
        
        body('location.district')
          .notEmpty().withMessage('District is required')
          .isString().withMessage('District must be a string'),
        
        body('alertTypes')
          .optional()
          .isArray().withMessage('Alert types must be an array')
          .custom((value) => {
            const validTypes = ['rain', 'drought', 'flood', 'frost', 'storm'];
            return value.every(type => validTypes.includes(type));
          })
          .withMessage('Invalid alert type')
      ],

      // Market price query
      marketPrice: [
        query('crop')
          .notEmpty().withMessage('Crop type is required')
          .isString().withMessage('Crop type must be a string')
          .isIn(['maize', 'coffee', 'tea', 'bananas', 'beans', 'rice', 'wheat'])
          .withMessage('Invalid crop type'),
        
        query('district')
          .optional()
          .isString().withMessage('District must be a string'),
        
        query('date')
          .optional()
          .isISO8601().withMessage('Invalid date format')
          .custom((value) => {
            if (new Date(value) > new Date()) {
              throw new Error('Date cannot be in the future');
            }
            return true;
          })
      ],

      // File upload validation (for images/documents)
      fileUpload: [
        body('fileName')
          .optional()
          .isString().withMessage('File name must be a string')
          .matches(/^[a-zA-Z0-9._-]+$/).withMessage('Invalid file name'),
        
        body('fileType')
          .optional()
          .isString().withMessage('File type must be a string')
          .isIn(['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain'])
          .withMessage('Invalid file type'),
        
        body('fileSize')
          .optional()
          .isInt({ max: 10 * 1024 * 1024 }) // 10MB max
          .withMessage('File size must be less than 10MB')
      ]
    };
  }

  // Sanitization methods
  sanitizeText(text) {
    return sanitizeHtml(text, {
      allowedTags: [],
      allowedAttributes: {},
      disallowedTagsMode: 'escape'
    }).trim();
  }

  sanitizeName(name) {
    return sanitizeHtml(name, {
      allowedTags: [],
      allowedAttributes: {},
      disallowedTagsMode: 'escape'
    })
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^a-zA-Z\s-']/g, '');
  }

  sanitizeSearch(search) {
    return sanitizeHtml(search, {
      allowedTags: [],
      allowedAttributes: {},
      disallowedTagsMode: 'escape'
    })
    .trim()
    .substring(0, 100);
  }

  // Validation middleware generator
  validate(validationType) {
    const rules = this.rules[validationType];
    if (!rules) {
      throw new Error(`Validation type '${validationType}' not found`);
    }

    return async (req, res, next) => {
      try {
        // Run all validation rules
        await Promise.all(rules.map(rule => rule.run(req)));

        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: errors.array().map(err => ({
              field: err.path,
              message: err.msg,
              value: err.value
            }))
          });
        }

        // Additional custom validation can be added here
        await this.additionalValidation(req, validationType);

        next();
      } catch (error) {
        console.error('Validation error:', error);
        return res.status(500).json({
          success: false,
          error: 'Validation server error',
          message: error.message
        });
      }
    };
  }

  // Additional custom validations
  async additionalValidation(req, validationType) {
    switch (validationType) {
      case 'sensorData':
        await this.validateSensorData(req);
        break;
      case 'farmerRegistration':
        await this.validateFarmerUniqueness(req);
        break;
      case 'cropData':
        await this.validateCropSeason(req);
        break;
      default:
        // No additional validation needed
        break;
    }
  }

  async validateSensorData(req) {
    // Validate that at least one reading is provided
    const readings = req.body.readings || {};
    const readingKeys = Object.keys(readings);
    
    if (readingKeys.length === 0) {
      throw new Error('At least one reading (temperature, soilMoisture, humidity, phLevel, or nitrogen) must be provided');
    }

    // Validate sensor ID format (can be extended to check against database)
    if (!/^SEN_[A-Z0-9]{8}$/.test(req.body.sensorId)) {
      // Note: This is just an example format validation
      // In production, you might want to check against registered sensors
      console.warn(`Sensor ID ${req.body.sensorId} doesn't match expected format`);
    }
  }

  async validateFarmerUniqueness(req) {
    // In production, this would check against database
    // This is a placeholder implementation
    const { phone } = req.body;
    
    // Example: Check if farmer with phone already exists
    // const existingFarmer = await Farmer.findOne({ phone });
    // if (existingFarmer) {
    //   throw new Error('Farmer with this phone number already registered');
    // }
    
    return true;
  }

  async validateCropSeason(req) {
    const { cropType, plantingDate } = req.body;
    const plantingMonth = new Date(plantingDate).getMonth() + 1;
    
    // Validate planting season for specific crops
    const seasonalConstraints = {
      maize: { minMonth: 3, maxMonth: 5 }, // March to May
      coffee: { minMonth: 4, maxMonth: 6 }, // April to June
      tea: { minMonth: 2, maxMonth: 4 },   // February to April
      rice: { minMonth: 5, maxMonth: 7 }    // May to July
    };

    if (seasonalConstraints[cropType]) {
      const { minMonth, maxMonth } = seasonalConstraints[cropType];
      if (plantingMonth < minMonth || plantingMonth > maxMonth) {
        throw new Error(`${cropType} should be planted between month ${minMonth} and ${maxMonth}`);
      }
    }
  }

  // Optional: Dynamic validation rule creation
  createCustomValidation(fields, options = {}) {
    const validations = [];
    
    for (const [field, rules] of Object.entries(fields)) {
      let validation = body(field);
      
      if (rules.required) {
        validation = validation.notEmpty().withMessage(`${field} is required`);
      }
      
      if (rules.type) {
        switch (rules.type) {
          case 'string':
            validation = validation.isString().withMessage(`${field} must be a string`);
            if (rules.minLength || rules.maxLength) {
              validation = validation.isLength({
                min: rules.minLength || 0,
                max: rules.maxLength || 255
              }).withMessage(
                `${field} must be ${rules.minLength || 0}-${rules.maxLength || 255} characters`
              );
            }
            break;
          case 'number':
            validation = validation.isFloat();
            if (rules.min !== undefined || rules.max !== undefined) {
              validation = validation.custom(value => {
                if (rules.min !== undefined && value < rules.min) {
                  throw new Error(`${field} must be at least ${rules.min}`);
                }
                if (rules.max !== undefined && value > rules.max) {
                  throw new Error(`${field} must be at most ${rules.max}`);
                }
                return true;
              });
            }
            break;
          case 'email':
            validation = validation.isEmail().withMessage('Invalid email format');
            break;
          case 'phone':
            validation = validation.matches(/^\+?[1-9]\d{1,14}$/).withMessage('Invalid phone number');
            break;
          default:
            break;
        }
      }
      
      if (rules.enum) {
        validation = validation.isIn(rules.enum).withMessage(`Invalid ${field} value`);
      }
      
      if (rules.sanitize) {
        validation = validation.customSanitizer(value => {
          return this.sanitizeText(value);
        });
      }
      
      validations.push(validation);
    }
    
    return validations;
  }

  // Batch validation for multiple endpoints
  batchValidate(validations) {
    return async (req, res, next) => {
      try {
        for (const validationType of validations) {
          const rules = this.rules[validationType];
          if (!rules) continue;
          
          await Promise.all(rules.map(rule => rule.run(req)));
        }
        
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: errors.array()
          });
        }
        
        next();
      } catch (error) {
        next(error);
      }
    };
  }

  // Quick validation middleware for simple cases
  simpleValidate(field, rules) {
    return async (req, res, next) => {
      try {
        const validations = this.createCustomValidation({ [field]: rules });
        await Promise.all(validations.map(validation => validation.run(req)));
        
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: errors.array()
          });
        }
        
        next();
      } catch (error) {
        next(error);
      }
    };
  }
}

// Export singleton instance
export default new ValidationMiddleware();