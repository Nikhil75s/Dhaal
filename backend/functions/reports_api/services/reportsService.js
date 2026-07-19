// Service layer for reports_api.
// Responsibilities:
// - Generate PDF using Catalyst SmartBrowz (Phase 4).
// - Pagination calculation and validation for historical reports (Phase 6).
// - Business logic enforcement (limits, string validations).

const ReportsRepository = require('../repositories/reportsRepository.js');
const catalyst = require('zcatalyst-sdk-node');
const { logger } = require('../utils/logger');

// Configurable Template and Folder IDs
const SMARTBROWZ_TEMPLATE_ID = process.env.SMARTBROWZ_TEMPLATE_ID;
const STRATUS_FOLDER_ID = process.env.STRATUS_FOLDER_ID;

class ReportsService {
  constructor(repository = new ReportsRepository()) {
    this.repository = repository;
  }

  /**
   * Generates a PDF intelligence brief and stores it in Stratus.
   *
   * @param {object} args - The anomaly alert payload.
   * @param {object} req - The incoming Catalyst request object.
   * @param {object} context - The Catalyst context.
   * @param {object} authenticatedUser - The explicitly authorized user.
   * @returns {Promise<object>} Pipeline execution result and metadata.
   */
  async generateIntelligenceBrief(args, req, context, authenticatedUser) {
    logger.info('Starting Intelligence Brief generation for alert', { 
      alertId: args.alertId,
      requestedByUserId: authenticatedUser.user_id,
      timestamp: new Date().toISOString()
    });

    if (!SMARTBROWZ_TEMPLATE_ID || !STRATUS_FOLDER_ID) {
      throw new Error('Configuration Error: Missing Catalyst Resource IDs');
    }

    try {
      const catalystApp = catalyst.initialize(req);
      const smartbrowz = catalystApp.smartbrowz();
      
      const pdfStream = await smartbrowz.generateFromTemplate(
        SMARTBROWZ_TEMPLATE_ID,
        { data: args }
      );
      
      const filestore = catalystApp.filestore();
      const folder = filestore.folder(STRATUS_FOLDER_ID);
      const fileName = `intelligence_brief_${args.alertId}_${Date.now()}.pdf`;
      
      const uploadResult = await folder.uploadFile({ code: pdfStream, name: fileName });
      logger.info('PDF uploaded successfully', { uploadResultId: uploadResult.id });

      // Note: We currently rely on application logs to trace the actor (authenticatedUser.user_id).
      // Future Schema Enhancement: Add a 'GeneratedBy' column to the IntelligenceReports schema.
      const metadata = {
        alertId: args.alertId,
        pdfUrl: uploadResult.id,
        generatedDate: new Date().toISOString()
      };

      // Pass catalystApp instead of req to the repository
      const dbResult = await this.repository.insertReportMetadata(catalystApp, metadata);

      return {
        message: 'Intelligence Brief generated successfully',
        data: {
          reportId: dbResult.ROWID,
          alertId: metadata.alertId,
          pdfUrl: metadata.pdfUrl,
          generatedDate: metadata.generatedDate
        }
      };
    } catch (error) {
      logger.error('Failed to generate intelligence brief pipeline', { errorMsg: error.message });
      error.statusCode = error.statusCode || 500;
      error.message = error.message || 'Intelligence Brief generation failed';
      throw error;
    }
  }

  /**
   * Retrieves a paginated list of historical reports.
   *
   * @param {object} args - Payload arguments (page, limit, alertId).
   * @param {object} req - Catalyst request object.
   * @param {object} authenticatedUser - The authorized user.
   * @returns {Promise<object>} Paginated results metadata.
   */
  async listHistoricalReports(args, req, authenticatedUser) {
    logger.info('Starting listHistoricalReports', { 
      requestedByUserId: authenticatedUser.user_id,
      timestamp: new Date().toISOString()
    });

    try {
      // 1. Pagination Validation
      let page = parseInt(args.page, 10);
      let limit = parseInt(args.limit, 10);

      if (isNaN(page) || page < 1) page = 1;
      if (isNaN(limit) || limit < 1) limit = 10;
      
      // Enforce max limit of 100
      if (limit > 100) limit = 100;

      const offset = (page - 1) * limit;

      // 2. AlertID Validation
      let alertId = args.alertId || null;
      if (alertId) {
        // Enforce strict whitelist validation (alphanumeric, dashes, underscores) to prevent ZCQL injection
        const alertIdRegex = /^[A-Za-z0-9_-]+$/;
        if (!alertIdRegex.test(alertId)) {
          const err = new Error('Invalid alertId format: Must be alphanumeric');
          err.statusCode = 400;
          throw err;
        }
      }

      // 3. Delegate to Repository (fetch limit + 1 to determine hasNextPage)
      const catalystApp = catalyst.initialize(req);
      const queryLimit = limit + 1;

      const rawRows = await this.repository.listReports(catalystApp, alertId, queryLimit, offset);

      // 4. Calculate pagination state
      const hasNextPage = rawRows.length > limit;
      
      // Trim the extra row if it exists
      const pagedRows = hasNextPage ? rawRows.slice(0, limit) : rawRows;

      return {
        message: 'Historical reports retrieved successfully',
        data: {
          reports: pagedRows.map(row => ({
            reportId: row.ROWID,
            alertId: row.AlertID,
            pdfUrl: row.PdfUrl,
            generatedDate: row.GeneratedDate
          })),
          pagination: {
            page,
            limit,
            hasNextPage
          }
        }
      };
    } catch (error) {
      logger.error('Failed to list historical reports', { errorMsg: error.message });
      error.statusCode = error.statusCode || 500;
      throw error;
    }
  }

  /**
   * Retrieves a single historical report by ID.
   *
   * @param {object} args - Payload arguments (reportId).
   * @param {object} req - Catalyst request object.
   * @param {object} authenticatedUser - The authorized user.
   * @returns {Promise<object>} The report metadata.
   */
  async getHistoricalReport(args, req, authenticatedUser) {
    logger.info('Starting getHistoricalReport', { 
      requestedByUserId: authenticatedUser.user_id,
      reportId: args.reportId,
      timestamp: new Date().toISOString()
    });

    if (!args.reportId) {
      const err = new Error('Missing required argument: reportId');
      err.statusCode = 400;
      throw err;
    }

    try {
      const catalystApp = catalyst.initialize(req);
      const row = await this.repository.getReportById(catalystApp, args.reportId);
      
      return {
        message: 'Report retrieved successfully',
        data: {
          reportId: row.ROWID,
          alertId: row.AlertID,
          pdfUrl: row.PdfUrl,
          generatedDate: row.GeneratedDate
        }
      };
    } catch (error) {
      logger.error('Failed to get historical report', { errorMsg: error.message });
      // The Catalyst SDK (CatalystError) exposes structured properties like statusCode and code.
      // We check these structured identifiers first before falling back to error message parsing, 
      // ensuring resilient mapping if Catalyst updates their underlying error string formats.
      if (
        error.statusCode === 404 || 
        (error.code && error.code.toUpperCase().includes('NOT_FOUND')) ||
        (error.message && error.message.toLowerCase().includes('not exist'))
      ) {
        error.statusCode = 404;
        error.message = 'Report not found';
      } else {
        error.statusCode = error.statusCode || 500;
      }
      throw error;
    }
  }
}

module.exports = ReportsService;
