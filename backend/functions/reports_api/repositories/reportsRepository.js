// Repository layer for reports_api.
// Responsibilities:
// - Interact with the Catalyst Data Store.
// - Execute ZCQL queries.
// - Keep persistence logic separate from service logic (no business validation).
// - Depend only on the initialized catalystApp, not raw req objects.

const { logger } = require('../utils/logger');

class ReportsRepository {
  /**
   * Inserts report metadata into the IntelligenceReports table.
   *
   * @param {object} catalystApp - Initialized Catalyst SDK app instance.
   * @param {object} metadata - The metadata to insert.
   * @returns {Promise<object>} The inserted row data.
   */
  async insertReportMetadata(catalystApp, metadata) {
    try {
      const datastore = catalystApp.datastore();
      const table = datastore.table('IntelligenceReports');

      logger.info('Inserting report metadata into IntelligenceReports table');

      const rowData = {
        AlertID: metadata.alertId,
        PdfUrl: metadata.pdfUrl,
        GeneratedDate: metadata.generatedDate
      };

      const result = await table.insertRow(rowData);
      logger.info('Successfully inserted report metadata', { rowId: result.ROWID });
      
      return result;
    } catch (error) {
      logger.error('Failed to insert report metadata', { errorMsg: error.message });
      throw error;
    }
  }

  /**
   * Retrieves a paginated list of reports, optionally filtered by AlertID.
   * Uses ZCQL for deterministic ordering (GeneratedDate DESC).
   *
   * @param {object} catalystApp - Initialized Catalyst SDK app instance.
   * @param {string|null} alertId - Optional AlertID filter.
   * @param {number} limit - Maximum number of rows to retrieve.
   * @param {number} offset - Number of rows to skip.
   * @returns {Promise<Array>} Array of row metadata.
   */
  async listReports(catalystApp, alertId, limit, offset) {
    try {
      logger.info('Executing ZCQL to list reports', { alertId, limit, offset });
      
      // Construct ZCQL Query safely
      let query = 'SELECT ROWID, AlertID, PdfUrl, GeneratedDate FROM IntelligenceReports';
      
      if (alertId) {
        // Enclose dynamic string in single quotes per ZCQL syntax
        // AlertID is pre-validated by the Service layer, preventing injection
        query += ` WHERE AlertID = '${alertId}'`;
      }
      
      query += ` ORDER BY GeneratedDate DESC LIMIT ${limit} OFFSET ${offset}`;

      const zcql = catalystApp.zcql();
      const results = await zcql.executeZCQLQuery(query);
      
      // ZCQL returns an array of objects nested under the table name, e.g., { IntelligenceReports: { ROWID: ... } }
      // We map it to flatten the results.
      return results.map(row => row.IntelligenceReports);
    } catch (error) {
      logger.error('Failed to list reports via ZCQL', { errorMsg: error.message });
      throw error;
    }
  }

  /**
   * Retrieves a single report by its ReportID (ROWID).
   *
   * @param {object} catalystApp - Initialized Catalyst SDK app instance.
   * @param {string} reportId - The ROWID of the report.
   * @returns {Promise<object>} The row metadata.
   */
  async getReportById(catalystApp, reportId) {
    try {
      logger.info('Fetching single report by ID', { reportId });
      
      const datastore = catalystApp.datastore();
      const table = datastore.table('IntelligenceReports');
      
      const result = await table.getRow(reportId);
      return result;
    } catch (error) {
      logger.error('Failed to fetch report by ID', { reportId, errorMsg: error.message });
      // Catalyst SDK throws if row is not found. We let the service catch and map it.
      throw error;
    }
  }
}

module.exports = ReportsRepository;
