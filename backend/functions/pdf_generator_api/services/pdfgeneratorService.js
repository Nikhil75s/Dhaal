// Service layer for pdf_generator_api.
// Responsibilities:
// - Coordinate repository access.
// - Hold future business logic for this endpoint.
// - Keep the controller focused on request handling.

const getPdfGeneratorStatus = require('../repositories/pdfgeneratorRepository');

// TODO: introduce future business logic here for HTML template rendering,
// intelligence brief composition, and PDF generation orchestration.
/**
 * Fetches PDF generator status by delegating to the repository layer.
 *
 * @param {object} req - Incoming request object.
 * @returns {Promise<*>} Repository result.
 */
async function fetchPdfGeneratorStatus(req) {
  // Delegate directly to the repository layer.
  return getPdfGeneratorStatus(req);
}

module.exports = fetchPdfGeneratorStatus;
