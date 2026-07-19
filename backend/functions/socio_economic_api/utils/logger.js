// Enhanced structured logger for DHAAL backend services.
// Provides module-scoped logging with consistent format.
// Each module creates its own logger via createLogger(moduleName).

/**
 * Creates a module-scoped logger instance.
 *
 * @param {string} moduleName - The name of the module (e.g. 'socio_economic').
 * @returns {object} Logger instance with info, warn, and error methods.
 */
function createLogger(moduleName) {
  const prefix = `[${moduleName.toUpperCase()}]`;

  return {
    /**
     * Logs an informational message.
     *
     * @param {string} message - Log message.
     * @param {*} [meta=null] - Optional metadata object.
     */
    info(message, meta = null) {
      if (meta) {
        console.log(`${prefix} [INFO] ${message}`, JSON.stringify(meta));
      } else {
        console.log(`${prefix} [INFO] ${message}`);
      }
    },

    /**
     * Logs a warning message.
     *
     * @param {string} message - Log message.
     * @param {*} [meta=null] - Optional metadata object.
     */
    warn(message, meta = null) {
      if (meta) {
        console.warn(`${prefix} [WARN] ${message}`, JSON.stringify(meta));
      } else {
        console.warn(`${prefix} [WARN] ${message}`);
      }
    },

    /**
     * Logs an error message with optional error object.
     *
     * @param {string} message - Log message.
     * @param {Error|*} [error=null] - Optional error instance or metadata.
     */
    error(message, error = null) {
      if (error) {
        console.error(`${prefix} [ERROR] ${message}`, error instanceof Error ? error.stack : JSON.stringify(error));
      } else {
        console.error(`${prefix} [ERROR] ${message}`);
      }
    }
  };
}

module.exports = { createLogger };
