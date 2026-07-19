// Controller layer for anomaly_alerts_api.
// Responsibilities:
// - Receive a plain JavaScript request object.
// - Delegate to the service layer.
// - Return the service result without runtime-specific error handling.

const fetchAllAnomalyAlerts = require('../services/anomalyalertsService');

/**
 * Controller responsible for handling anomaly alert requests.
 */
class AnomalyAlertsController {
  /**
   * Handles an incoming request by delegating it to the service layer.
   *
   * @param {object} requestData - Normalized request data for the controller.
   * @returns {Promise<*>} Service result.
   */
  async handleRequest(requestData) {
    // Delegate the normalized request object to the service layer.
    return fetchAllAnomalyAlerts(requestData);
  }
}

module.exports = AnomalyAlertsController;
