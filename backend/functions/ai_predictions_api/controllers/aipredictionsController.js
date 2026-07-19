// Controller layer for ai_predictions_api.
// Responsibilities:
// - Receive a normalized request object from the runtime adapter.
// - Route the request to the correct service method based on the action.
// - Throw AppError for unsupported actions.
// - No business logic or calculations belong here.

const { getDistrictRisk, predictTrend, predictHotspots, predictCategory } = require('../services/aipredictionsService');
const { AppError } = require('../utils/errorHandler');
const { createLogger } = require('../utils/logger');

const logger = createLogger('aipredictions_controller');

/**
 * Controller responsible for routing AI prediction requests.
 */
class AiPredictionsController {
  /**
   * Handles an incoming request by routing it to the appropriate service.
   *
   * @param {object} requestData - Normalized request data.
   * @returns {Promise<object>} Service response.
   * @throws {AppError} If action is missing or unsupported.
   */
  async handleRequest(requestData) {
    const action = requestData.action;
    const args = requestData.body || {};

    logger.info(`Routing request for action: ${action}`);

    if (!action) {
      throw new AppError('INVALID_REQUEST', 'Action parameter is required');
    }

    switch (action) {
      case 'getDistrictRisk':
        return await getDistrictRisk(requestData, args);

      case 'predictTrend':
        return await predictTrend(requestData, args);

      case 'predictHotspots':
        return await predictHotspots(requestData, args);

      case 'predictCategory':
        return await predictCategory(requestData, args);

      default:
        logger.warn(`Unsupported action requested: ${action}`);
        throw new AppError(
          'INVALID_REQUEST',
          `Action "${action}" is not supported by the ai_predictions_api`
        );
    }
  }
}

module.exports = AiPredictionsController;
