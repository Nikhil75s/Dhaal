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
      // Basic request validation
      const validation = validateRequest(req);
      if (!validation.isValid) {
        return createErrorResponse(validation.message, 400);
      }

      logger.info('Request accepted by controller', { endpoint: '/api/v1/reports', method: req?.method || 'UNKNOWN' });

      // Extract the payload (action + args)
      // Assuming a standardized request body format based on the implementation plan
      const payload = req.body || {};
      const action = payload.action;
      const args = payload.body || {};

      if (action === 'generate') {
        // Validate required arguments for 'generate'
        if (!args.alertId || !args.district || !args.severity || !args.details) {
          return createErrorResponse('Missing required arguments: alertId, district, severity, details', 400);
        }
        
        const result = await this.service.generateIntelligenceBrief(args, req, context);
        return createSuccessResponse(result.message, result.data);
      }

      return createErrorResponse('Invalid action. Supported actions: generate', 400);
    } catch (error) {
      logger.error('Controller failed to process request', error);
      const code = error.statusCode || error.status || 500;
      const message = error.message || 'Internal server error';
      return createErrorResponse(message, code);
    }
  }
}

module.exports = ReportsController;
