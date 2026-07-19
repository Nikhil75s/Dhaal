// Structured error handling for DHAAL backend services.
// Provides a lightweight AppError class that carries a machine-readable code,
// a human-readable message, and optional details.
//
// Usage:
//   throw new AppError('DISTRICT_NOT_FOUND', 'District "XYZ" not found in Karnataka');
//
// The runtime adapter catches AppError instances and formats them
// via responseBuilder.fromAppError().

/**
 * Application-level error with a machine-readable code.
 * Extends the native Error class for compatibility with standard catch blocks.
 */
class AppError extends Error {
  /**
   * @param {string} code - Machine-readable error code (e.g. 'DISTRICT_NOT_FOUND').
   * @param {string} message - Human-readable error description.
   * @param {*} [details=null] - Optional additional context for debugging.
   */
  constructor(code, message, details = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
  }
}

module.exports = { AppError };
