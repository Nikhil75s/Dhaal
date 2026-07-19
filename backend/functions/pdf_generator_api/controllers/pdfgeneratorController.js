// Controller layer for pdf_generator_api.
// Responsibilities:
// - Receive a plain JavaScript request object.
// - Delegate to the service layer.
// - Return the service result without runtime-specific error handling.

const fetchPdfGeneratorStatus = require('../services/pdfgeneratorService');

/**
 * Controller responsible for handling PDF generation requests.
 */
class PdfGeneratorController {
  /**
   * Handles an incoming request by delegating it to the service layer.
   *
   * @param {object} requestData - Normalized request data for the controller.
   * @returns {Promise<*>} Service result.
   */
  async handleRequest(requestData) {
    // Delegate the normalized request object to the service layer.
    return fetchPdfGeneratorStatus(requestData);
  }
}

module.exports = PdfGeneratorController;
