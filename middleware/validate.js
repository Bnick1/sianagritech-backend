// backend/middleware/validate.js
import validation from './validation.js';

export const validate = (validationType) => {
  return validation.validate(validationType);
};

export const batchValidate = (validations) => {
  return validation.batchValidate(validations);
};

// Common validation combinations
export const validateFarmerAndCrop = batchValidate(['farmerRegistration', 'cropData']);
export const validateSensorWithPagination = batchValidate(['sensorData', 'pagination']);
export const validateAuthWithApiKey = batchValidate(['login', 'apiKey']);