// Service layer for anomaly_alerts_api.
// Responsibilities:
// - Coordinate repository access.
// - Hold future business logic for this endpoint.
// - Keep the controller focused on request handling.

const getAllAnomalyAlertData = require('../repositories/anomalyalertsRepository');

// TODO: introduce future business logic here for spike detection,
// seasonal deviation analysis, spatial anomalies, and statistical outliers.
/**
 * Fetches anomaly alert data by delegating to the repository layer.
 *
 * @param {object} req - Incoming request object.
 * @returns {Promise<*>} Repository result.
 */
async function fetchAllAnomalyAlerts(req) {
  // Delegate directly to the repository layer.
  return getAllAnomalyAlertData(req);
}

module.exports = fetchAllAnomalyAlerts;
