// Repository layer for anomaly_alerts_api.
// Responsibilities:
// - Access the Catalyst Data Store table directly.
// - Return raw records without applying business logic.

const { initializeCatalystApp } = require('../utils/catalystHelper');

/**
 * Retrieves all rows from a Data Store table using paginated fetches.
 * Replaces the deprecated getAllRows() which was capped at 200 rows.
 *
 * Uses getPagedRows() (SDK v3.4.0 recommended API) with automatic
 * pagination via next_token to collect the complete result set.
 *
 * @param {import('zcatalyst-sdk-node/lib/datastore/table').Table} table - Catalyst table instance.
 * @returns {Promise<Array>} All rows from the table.
 */
async function fetchAllRowsPaginated(table) {
  const allRows = [];
  let nextToken;

  do {
    const response = await table.getPagedRows({ nextToken, maxRows: 200 });
    if (response.data && response.data.length > 0) {
      allRows.push(...response.data);
    }
    nextToken = response.next_token;
  } while (nextToken);

  return allRows;
}

// TODO: replace placeholder table name with the finalized anomaly alerts table.
/**
 * Retrieves all rows from the AnomalyAlerts table.
 *
 * @param {object} req - Normalized request data from the runtime adapter.
 * @returns {Promise<Array>} Raw rows returned by the data store.
 */
async function getAllAnomalyAlertData(req) {
  const app = initializeCatalystApp(req);

  const datastore = app.datastore();
  const table = datastore.table('AnomalyAlerts');

  // TODO: implement alert-specific queries, severity filtering, and time-range scoping.
  return fetchAllRowsPaginated(table);
}

module.exports = getAllAnomalyAlertData;
