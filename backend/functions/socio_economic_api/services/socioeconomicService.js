// Service layer for socio_economic_api.
// Responsibilities:
// - Validate inputs using Phase 2 utilities.
// - Apply business logic: filtering, sorting, pagination, aggregation.
// - Return processed results ready for the response envelope.
//
// Each public method corresponds to one supported API action.
// Routing is handled by the controller — the service does not dispatch actions.

const repository = require('../repositories/socioeconomicRepository');
const { validateDistrict, validateRequired, validateEnum } = require('../utils/validator');
const { AppError } = require('../utils/errorHandler');
const errorCodes = require('../constants/errorCodes');
const { mean, standardDeviation, percentileRank } = require('../utils/statisticsEngine');
const { createLogger } = require('../utils/logger');

const logger = createLogger('socio_economic_service');

// TODO: These indicator field names are assumed based on the expected SocioEconomicData schema.
// Update once the actual Catalyst Data Store column names are confirmed.
const NUMERIC_INDICATORS = ['Population', 'Urbanization', 'Literacy', 'Employment', 'Income'];
const SORTABLE_FIELDS = ['District', ...NUMERIC_INDICATORS];

// ---------------------------------------------------------------------------
// Public API — one method per supported action
// ---------------------------------------------------------------------------

/**
 * Returns all socio-economic records with optional sorting and pagination.
 *
 * @param {object} requestData - Catalyst request context.
 * @param {object} args - BasicIO arguments.
 * @param {string} [args.sortBy] - Field name to sort by.
 * @param {string} [args.sortOrder='asc'] - 'asc' or 'desc'.
 * @param {string} [args.limit] - Maximum records to return.
 * @param {string} [args.offset] - Records to skip.
 * @returns {Promise<Array<object>>} Sorted and paginated records.
 */
async function getAllData(requestData, args) {
  let records = await repository.getAllRecords(requestData);

  if (records.length === 0) {
    logger.warn('No socio-economic records found in Data Store');
    return [];
  }

  if (args.sortBy) {
    const sortCheck = validateEnum(args.sortBy, SORTABLE_FIELDS, 'sortBy');
    if (!sortCheck.isValid) {
      throw new AppError(errorCodes.INVALID_REQUEST, sortCheck.message);
    }
    records = sortRecords(records, args.sortBy, (args.sortOrder || 'asc').toLowerCase());
  }

  const limit = parseInt(args.limit, 10);
  const offset = parseInt(args.offset, 10) || 0;

  if (limit > 0) {
    records = records.slice(offset, offset + limit);
  } else if (offset > 0) {
    records = records.slice(offset);
  }

  logger.info('getAllData completed', { count: records.length });
  return records;
}

/**
 * Returns socio-economic data for a specific Karnataka district.
 *
 * @param {object} requestData - Catalyst request context.
 * @param {object} args - BasicIO arguments.
 * @param {string} args.district - District name to look up.
 * @returns {Promise<object|Array<object>>} District record(s).
 */
async function getByDistrict(requestData, args) {
  const reqCheck = validateRequired(args, ['district']);
  if (!reqCheck.isValid) {
    throw new AppError(errorCodes.MISSING_REQUIRED_FIELD, reqCheck.message);
  }

  const districtCheck = validateDistrict(args.district);
  if (!districtCheck.isValid) {
    throw new AppError(errorCodes.INVALID_DISTRICT, districtCheck.message);
  }

  const records = await repository.getAllRecords(requestData);

  const targetName = args.district.trim().toLowerCase();
  const matched = records.filter(
    r => r.District && r.District.trim().toLowerCase() === targetName
  );

  if (matched.length === 0) {
    throw new AppError(
      errorCodes.RECORD_NOT_FOUND,
      `No socio-economic data found for district "${args.district}".`
    );
  }

  logger.info('getByDistrict completed', { district: args.district, records: matched.length });
  return matched.length === 1 ? matched[0] : matched;
}

/**
 * Returns a statewide summary with aggregate statistics for each indicator.
 *
 * @param {object} requestData - Catalyst request context.
 * @returns {Promise<object>} Summary statistics.
 */
async function getSummary(requestData) {
  const records = await repository.getAllRecords(requestData);

  if (records.length === 0) {
    throw new AppError(
      errorCodes.INSUFFICIENT_DATA,
      'No socio-economic data available for summary computation.'
    );
  }

  const summary = {
    totalDistricts: records.length,
    indicators: {}
  };

  for (const indicator of NUMERIC_INDICATORS) {
    const values = records
      .map(r => parseFloat(r[indicator]))
      .filter(v => !isNaN(v));

    if (values.length > 0) {
      const sorted = [...values].sort((a, b) => a - b);
      summary.indicators[indicator] = {
        mean: round(mean(values)),
        standardDeviation: round(standardDeviation(values)),
        min: sorted[0],
        max: sorted[sorted.length - 1],
        count: values.length
      };
    }
  }

  const populations = records
    .map(r => parseFloat(r.Population))
    .filter(v => !isNaN(v));

  if (populations.length > 0) {
    summary.totalPopulation = populations.reduce((a, b) => a + b, 0);
  }

  logger.info('getSummary completed', { districts: records.length });
  return summary;
}

/**
 * Ranks districts by a specified numeric indicator.
 *
 * @param {object} requestData - Catalyst request context.
 * @param {object} args - BasicIO arguments.
 * @param {string} args.indicator - Numeric field to rank by.
 * @param {string} [args.order='desc'] - 'asc' or 'desc'.
 * @param {string} [args.limit] - Return only top N districts.
 * @returns {Promise<object>} Rankings with indicator metadata.
 */
async function getRankings(requestData, args) {
  const reqCheck = validateRequired(args, ['indicator']);
  if (!reqCheck.isValid) {
    throw new AppError(errorCodes.MISSING_REQUIRED_FIELD, reqCheck.message);
  }

  const indicatorCheck = validateEnum(args.indicator, NUMERIC_INDICATORS, 'indicator');
  if (!indicatorCheck.isValid) {
    throw new AppError(errorCodes.INVALID_REQUEST, indicatorCheck.message);
  }

  const records = await repository.getAllRecords(requestData);

  if (records.length === 0) {
    throw new AppError(
      errorCodes.INSUFFICIENT_DATA,
      'No socio-economic data available for ranking.'
    );
  }

  const indicator = args.indicator;
  const order = (args.order || 'desc').toLowerCase();

  const validRecords = records.filter(r => !isNaN(parseFloat(r[indicator])));

  if (validRecords.length === 0) {
    throw new AppError(
      errorCodes.INSUFFICIENT_DATA,
      `No valid data found for indicator "${indicator}".`
    );
  }

  const sorted = sortRecords(validRecords, indicator, order);

  const ascValues = validRecords
    .map(r => parseFloat(r[indicator]))
    .sort((a, b) => a - b);

  const rankings = sorted.map((record, index) => ({
    rank: index + 1,
    district: record.District || 'Unknown',
    value: parseFloat(record[indicator]),
    percentile: round(percentileRank(parseFloat(record[indicator]), ascValues), 1)
  }));

  const limit = parseInt(args.limit, 10);
  const result = limit > 0 ? rankings.slice(0, limit) : rankings;

  logger.info('getRankings completed', { indicator, order, count: result.length });

  return {
    indicator,
    order,
    totalDistricts: validRecords.length,
    rankings: result
  };
}

// ---------------------------------------------------------------------------
// Private Helpers
// ---------------------------------------------------------------------------

/**
 * Sorts records by a field, auto-detecting numeric vs string comparison.
 * Returns a new array — does not mutate the input.
 */
function sortRecords(records, field, order = 'asc') {
  return [...records].sort((a, b) => {
    const numA = parseFloat(a[field]);
    const numB = parseFloat(b[field]);

    const comparison = (!isNaN(numA) && !isNaN(numB))
      ? numA - numB
      : String(a[field] || '').localeCompare(String(b[field] || ''));

    return order === 'desc' ? -comparison : comparison;
  });
}

/**
 * Rounds a number to a specified number of decimal places.
 */
function round(value, decimals = 2) {
  return parseFloat(value.toFixed(decimals));
}

module.exports = { getAllData, getByDistrict, getSummary, getRankings };
