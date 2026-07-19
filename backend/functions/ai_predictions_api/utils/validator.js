// Enhanced input validation for DHAAL backend services.
// Provides reusable validation functions for district names,
// required fields, enum membership, and date ranges.

const { KARNATAKA_DISTRICTS } = require('../constants/districts');

/**
 * Validates that a request object exists and is non-null.
 *
 * @param {*} req - The request to validate.
 * @returns {{ isValid: boolean, message: string }}
 */
function validateRequest(req) {
  if (!req) {
    return { isValid: false, message: 'Request object is missing.' };
  }
  return { isValid: true, message: 'Request validation passed.' };
}

/**
 * Validates that a district name is a recognized Karnataka district.
 *
 * @param {string} name - The district name to validate.
 * @returns {{ isValid: boolean, message: string }}
 */
function validateDistrict(name) {
  if (!name || typeof name !== 'string') {
    return { isValid: false, message: 'District name is required.' };
  }

  const normalized = name.trim().toLowerCase();
  const match = KARNATAKA_DISTRICTS.find(
    d => d.name.toLowerCase() === normalized
  );

  if (!match) {
    return {
      isValid: false,
      message: `District "${name}" is not a recognized Karnataka district.`
    };
  }

  return { isValid: true, message: 'District is valid.', district: match };
}

/**
 * Validates that all required fields exist on an object.
 *
 * @param {object} obj - The object to check.
 * @param {string[]} fields - Array of required field names.
 * @returns {{ isValid: boolean, message: string, missingFields?: string[] }}
 */
function validateRequired(obj, fields) {
  if (!obj || typeof obj !== 'object') {
    return { isValid: false, message: 'Input object is missing.', missingFields: fields };
  }

  const missing = fields.filter(field => obj[field] === undefined || obj[field] === null || obj[field] === '');

  if (missing.length > 0) {
    return {
      isValid: false,
      message: `Missing required fields: ${missing.join(', ')}`,
      missingFields: missing
    };
  }

  return { isValid: true, message: 'All required fields present.' };
}

/**
 * Validates that a value is a member of an allowed set.
 *
 * @param {*} value - The value to check.
 * @param {Array} allowedValues - Array of allowed values.
 * @param {string} [fieldName='value'] - Field name for error messages.
 * @returns {{ isValid: boolean, message: string }}
 */
function validateEnum(value, allowedValues, fieldName = 'value') {
  if (!allowedValues.includes(value)) {
    return {
      isValid: false,
      message: `Invalid ${fieldName}: "${value}". Allowed values: ${allowedValues.join(', ')}`
    };
  }
  return { isValid: true, message: `${fieldName} is valid.` };
}

/**
 * Validates that a date range is logically correct.
 *
 * @param {string} startDate - ISO date string for range start.
 * @param {string} endDate - ISO date string for range end.
 * @returns {{ isValid: boolean, message: string }}
 */
function validateDateRange(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime())) {
    return { isValid: false, message: `Invalid start date: "${startDate}"` };
  }
  if (isNaN(end.getTime())) {
    return { isValid: false, message: `Invalid end date: "${endDate}"` };
  }
  if (start > end) {
    return { isValid: false, message: 'Start date must be before or equal to end date.' };
  }

  return { isValid: true, message: 'Date range is valid.' };
}

module.exports = {
  validateRequest,
  validateDistrict,
  validateRequired,
  validateEnum,
  validateDateRange
};
