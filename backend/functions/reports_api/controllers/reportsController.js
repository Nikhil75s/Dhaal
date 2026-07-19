// Controller layer for reports_api.
// Responsibilities:
// - Parse incoming request data.
// - Validate request input.
// - Delegate to the service layer.
// - Return a standard HTTP response.

const { createSuccessResponse, createErrorResponse } = require('../utils/apiResponse');
const { validateRequest } = require('../utils/validator');
const { logger } = require('../utils/logger');
const ReportsService = require('../services/reportsService.js');

class ReportsController {
  constructor() {
    this.service = new ReportsService();
  }

  async handleRequest(req, context) {
    try {
      const validation = validateRequest(req);
      if (!validation.isValid) {
        return createErrorResponse(validation.message, 400);
      }

      logger.info('Request accepted by controller', { endpoint: '/api/v1/reports', method: req?.method || 'UNKNOWN' });

      // TODO: add endpoint-specific routing when the real API contract is known.
      return this.service.executePlaceholder(req, context);
    } catch (error) {
      logger.error('Controller failed to process request', error);
      return createErrorResponse('Internal server error', 500);
    }
  }
}

module.exports = ReportsController;
