// Service layer for ai_predictions_api.
// Responsibilities:
// - Coordinate repository access.
// - Hold future business logic for this endpoint.
// - Keep the controller focused on request handling.

const getAllPredictionData = require('../repositories/aipredictionsRepository');

// TODO: introduce future business logic here for crime forecasting,
// district risk assessment, hotspot prediction, and trend analysis.
/**
 * Fetches AI prediction data by delegating to the repository layer.
 *
 * @param {object} req - Incoming request object.
 * @returns {Promise<*>} Repository result.
 */
async function fetchAllPredictions(req) {
  // Delegate directly to the repository layer.
  return getAllPredictionData(req);
}

module.exports = fetchAllPredictions;
