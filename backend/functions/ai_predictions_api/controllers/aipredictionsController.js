// Controller layer for ai_predictions_api.
// Responsibilities:
// - Receive a plain JavaScript request object.
// - Delegate to the service layer.
// - Return the service result without runtime-specific error handling.

const fetchAllPredictions = require('../services/aipredictionsService');

/**
 * Controller responsible for handling AI prediction requests.
 */
class AiPredictionsController {
  /**
   * Handles an incoming request by delegating it to the service layer.
   *
   * @param {object} requestData - Normalized request data for the controller.
   * @returns {Promise<*>} Service result.
   */
  async handleRequest(requestData) {
    // Delegate the normalized request object to the service layer.
    return fetchAllPredictions(requestData);
  }
}

module.exports = AiPredictionsController;
