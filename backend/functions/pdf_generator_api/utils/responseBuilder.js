// Unified response builder for DHAAL backend services.
// Produces a consistent API envelope across all Intelligence Layer modules.
//
// Success: { success, message, data, meta: { timestamp, count, module } }
// Error:   { success, message, code, data: null, meta: { timestamp, module } }
//
// The existing fields (success, message, data) are preserved for backward
// compatibility with the frontend. The meta object is additive.

/**
 * Builds a standardized success response envelope.
 *
 * @param {*} data - The response payload.
 * @param {object} [options] - Optional overrides.
 * @param {string} [options.message='Request completed successfully'] - Success message.
 * @param {string} [options.module] - Source module identifier.
 * @returns {object} Formatted success response.
 */
function success(data, options = {}) {
  const {
    message = 'Request completed successfully',
    module: moduleName = undefined
  } = options;

  const response = {
    success: true,
    message,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      count: Array.isArray(data) ? data.length : 1
    }
  };

  if (moduleName) {
    response.meta.module = moduleName;
  }

  return response;
}

/**
 * Builds a standardized error response envelope.
 *
 * @param {object} [options] - Error details.
 * @param {string} [options.message='Internal Server Error'] - Human-readable error message.
 * @param {string} [options.code='INTERNAL_SERVER_ERROR'] - Machine-readable error code.
 * @param {string} [options.module] - Source module identifier.
 * @returns {object} Formatted error response.
 */
function error(options = {}) {
  const {
    message = 'Internal Server Error',
    code = 'INTERNAL_SERVER_ERROR',
    module: moduleName = undefined
  } = options;

  const response = {
    success: false,
    message,
    code,
    data: null,
    meta: {
      timestamp: new Date().toISOString()
    }
  };

  if (moduleName) {
    response.meta.module = moduleName;
  }

  return response;
}

/**
 * Builds an error response from an AppError instance.
 *
 * @param {import('./errorHandler').AppError} appError - Structured application error.
 * @param {string} [moduleName] - Source module identifier.
 * @returns {object} Formatted error response.
 */
function fromAppError(appError, moduleName) {
  return error({
    message: appError.message,
    code: appError.code,
    module: moduleName
  });
}

module.exports = {
  success,
  error,
  fromAppError
};
