// Repository layer for ai_predictions_api.
// Responsibilities:
// - Isolate Catalyst Data Store interactions.
// - Implement ZCQL pagination loop to bypass 300-row limit.
// - Flatten and normalize the nested ZCQL response.
// - Extract system ROWIDs correctly.
// No business logic belongs here.

const catalystHelper = require('../utils/catalystHelper');
const { createLogger } = require('../utils/logger');

const logger = createLogger('aipredictions_repository');

/**
 * Normalizes a nested ZCQL row into a flat plain JavaScript object.
 * Extracts values from CaseMaster and CrimeHead tables.
 *
 * @param {object} row - The nested ZCQL row object.
 * @returns {object} Flattened plain object.
 */
function normalizeRow(row) {
  const caseMaster = row.CaseMaster || {};
  const crimeHead = row.CrimeHead || {};

  return {
    id: caseMaster.ROWID,
    CaseMasterID: caseMaster.CaseMasterID,
    DistrictID: caseMaster.DistrictID,
    CrimeRegisteredDate: caseMaster.CrimeRegisteredDate,
    CrimeMajorHeadID: caseMaster.CrimeMajorHeadID,
    latitude: caseMaster.latitude,
    longitude: caseMaster.longitude,
    CrimeGroupName: crimeHead.CrimeGroupName || 'Unknown'
  };
}

/**
 * Fetches all crime cases by executing a paginated ZCQL query that joins
 * CaseMaster and CrimeHead.
 *
 * @param {object} requestData - Normalized Catalyst request context.
 * @returns {Promise<Array<object>>} Flattened array of all cases.
 */
async function getAllCases(requestData) {
  const catalystApp = catalystHelper.initialize(requestData.catalystRequest);
  const zcql = catalystApp.zcql();

  // ZCQL JOIN query fetching required fields for predictions.
  // We omit system metadata (CREATORID, CREATEDTIME, MODIFIEDTIME) intentionally.
  const queryTemplate = `
    SELECT CaseMaster.ROWID, CaseMaster.CaseMasterID, CaseMaster.DistrictID, CaseMaster.CrimeRegisteredDate, CaseMaster.CrimeMajorHeadID, CaseMaster.latitude, CaseMaster.longitude, CrimeHead.CrimeGroupName
    FROM CaseMaster
    INNER JOIN CrimeHead ON CaseMaster.CrimeMajorHeadID = CrimeHead.ROWID
  `;

  logger.info('Fetching cases from Data Store via ZCQL pagination');

  let offset = 1;
  const limit = 200;
  const allResults = [];

  while (true) {
    const paginatedQuery = `${queryTemplate} LIMIT ${limit} OFFSET ${offset}`;
    
    // executeZCQLQuery returns an array of nested objects: [{ CaseMaster: {...}, CrimeHead: {...} }]
    const results = await zcql.executeZCQLQuery(paginatedQuery);
    
    // Normalize and flatten rows inline
    const normalizedBatch = results.map(normalizeRow);
    allResults.push(...normalizedBatch);

    // If the results returned are less than the limit, we've reached the end
    if (results.length < limit) {
      break;
    }
    
    offset += limit;
  }

  logger.info('Completed Data Store fetch', { totalCount: allResults.length });
  return allResults;
}

module.exports = {
  getAllCases
};
