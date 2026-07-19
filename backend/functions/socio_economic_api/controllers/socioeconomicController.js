// Controller layer for socio_economic_api.
// Responsibilities:
// - Read the requested action from BasicIO arguments.
// - Route to the appropriate service method.
// - Return the service result.
// No business logic belongs here.

const service = require('../services/socioeconomicService');
const { AppError } = require('../utils/errorHandler');
const errorCodes = require('../constants/errorCodes');
const { createLogger } = require('../utils/logger');

const logger = createLogger('socio_economic_controller');

const SUPPORTED_ACTIONS = ['getAllData', 'getByDistrict', 'getSummary', 'getRankings'];

/**
 * Controller responsible for routing socio-economic requests to service methods.
 */
class SocioEconomicController {
  /**
   * Handles an incoming request by routing to the appropriate service method.
   *
   * @param {object} requestData - Normalized request data from the runtime adapter.
   * @returns {Promise<*>} Service result ready for the response envelope.
   * @throws {AppError} If the requested action is not supported.
   */
  async handleRequest(requestData) {
    const args = requestData.arguments || {};
    const action = args.action || 'getAllData';

    if (!SUPPORTED_ACTIONS.includes(action)) {
      throw new AppError(
        errorCodes.INVALID_REQUEST,
        `Invalid action: "${action}". Allowed values: ${SUPPORTED_ACTIONS.join(', ')}`
      );
    }

    logger.info('Processing request', { action });

    switch (action) {
      case 'getAllData':
        return service.getAllData(requestData, args);
      case 'getByDistrict':
        return service.getByDistrict(requestData, args);
      case 'getSummary':
        return service.getSummary(requestData);
      case 'getRankings':
        return service.getRankings(requestData, args);
    }
  }
}

module.exports = SocioEconomicController;
