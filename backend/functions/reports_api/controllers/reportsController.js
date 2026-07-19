// Controller layer for reports_api.
// Responsibilities:
// - Parse incoming request data.
// - Validate request input.
// - Delegate authentication to AuthService.
// - Delegate business logic to ReportsService.
// - Return a standard HTTP response.

const { createSuccessResponse, createErrorResponse } = require('../utils/apiResponse');
const { validateRequest } = require('../utils/validator');
const { logger } = require('../utils/logger');
const ReportsService = require('../services/reportsService.js');
const AuthService = require('../services/authService.js');

class ReportsController {
  constructor() {
    this.service = new ReportsService();
    this.authService = new AuthService();
  }

  async handleRequest(req, context) {
    try {
      // Basic request validation
      const validation = validateRequest(req);
      if (!validation.isValid) {
        return createErrorResponse(validation.message, 400);
      }

      logger.info('Request accepted by controller', { 
        endpoint: '/api/v1/reports', 
        method: req?.method || 'UNKNOWN',
        timestamp: new Date().toISOString()
      });

      // Extract the payload (action + args)
      const payload = req.body || {};
      const action = payload.action;
      const args = payload.body || {};

      switch (action) {
        case 'generate': {
          const authenticatedUser = await this.authService.verifyAndAuthorize(req, 'generate_report');
          if (!args.alertId || !args.district || !args.severity || !args.details) {
            return createErrorResponse('Missing required arguments: alertId, district, severity, details', 400);
          }
          const result = await this.service.generateIntelligenceBrief(args, req, context, authenticatedUser);
          return createSuccessResponse(result.message, result.data);
        }
        case 'list': {
          const authenticatedUser = await this.authService.verifyAndAuthorize(req, 'view_report');
          const result = await this.service.listHistoricalReports(args, req, authenticatedUser);
          return createSuccessResponse(result.message, result.data);
        }
        case 'get': {
          const authenticatedUser = await this.authService.verifyAndAuthorize(req, 'view_report');
          if (!args.reportId) {
            return createErrorResponse('Missing required argument: reportId', 400);
          }
          const result = await this.service.getHistoricalReport(args, req, authenticatedUser);
          return createSuccessResponse(result.message, result.data);
        }
        default: {
          return createErrorResponse('Invalid action. Supported actions: generate, list, get', 400);
        }
      }
    } catch (error) {
      // Log errors safely. Note: AuthService already logs security failures.
      logger.error('Controller failed to process request', { 
        errorMsg: error.message,
        statusCode: error.statusCode || error.status || 500,
        timestamp: new Date().toISOString()
      });
      const code = error.statusCode || error.status || 500;
      const message = error.message || 'Internal server error';
      return createErrorResponse(message, code);
    }
  }
}

module.exports = ReportsController;
