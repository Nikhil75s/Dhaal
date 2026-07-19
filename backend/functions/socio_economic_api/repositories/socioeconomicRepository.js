// Repository layer for socio_economic_api.
// Responsibilities:
// - Access the Catalyst Data Store table directly.
// - Paginate using getPagedRows() (SDK v3.4.0).
// - Normalize Catalyst rows into plain JavaScript objects.
// - Return raw data without applying business logic.

const { initializeCatalystApp } = require('../utils/catalystHelper');
const { createLogger } = require('../utils/logger');

const logger = createLogger('socio_economic_repository');

// TODO: Confirm table name matches the Catalyst Data Store configuration.
// This assumes the table was provisioned as 'SocioEconomicData' in the Catalyst console.
const TABLE_NAME = 'SocioEconomicData';

// Catalyst system fields stripped during normalization.
// Business logic should never depend on these internal metadata fields.
const SYSTEM_FIELDS = new Set(['CREATORID', 'CREATEDTIME', 'MODIFIEDTIME']);

/**
 * Retrieves all rows from a Data Store table using paginated fetches.
 * Uses getPagedRows() with automatic pagination via next_token.
 *
 * @param {import('zcatalyst-sdk-node/lib/datastore/table').Table} table - Catalyst table instance.
 * @returns {Promise<Array<object>>} All rows from the table.
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

/**
 * Strips Catalyst system metadata from a row and returns a clean object.
 * ROWID is preserved as 'id' since it may be needed for record identification.
 *
 * TODO: Confirm actual column names once the Data Store table schema is finalized.
 * Current assumption: District, Population, Urbanization, Literacy, Employment, Income.
 *
 * @param {object} row - Raw Catalyst Data Store row.
 * @returns {object} Normalized plain JavaScript object.
 */
function normalizeRow(row) {
  const normalized = {};

  for (const [key, value] of Object.entries(row)) {
    if (key === 'ROWID') {
      normalized.id = value;
    } else if (!SYSTEM_FIELDS.has(key)) {
      normalized[key] = value;
    }
  }

  return normalized;
}

/**
 * Retrieves all socio-economic records from the Data Store.
 *
 * @param {object} requestData - Normalized request data from the runtime adapter.
 * @returns {Promise<Array<object>>} Normalized socio-economic records.
 */
async function getAllRecords(requestData) {
  logger.info('Fetching all records from Data Store', { table: TABLE_NAME });

  const app = initializeCatalystApp(requestData);
  const table = app.datastore().table(TABLE_NAME);
  const rawRows = await fetchAllRowsPaginated(table);

  logger.info('Records fetched successfully', { count: rawRows.length });
  return rawRows.map(normalizeRow);
}

module.exports = { getAllRecords };
