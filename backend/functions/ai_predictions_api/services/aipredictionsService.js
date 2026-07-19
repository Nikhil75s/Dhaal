// Service layer for ai_predictions_api.
// Responsibilities:
// - Coordinate repository access.
// - Implement business logic for crime forecasting, risk assessment, and trend analysis.
// - Keep the controller focused on request handling.

const { getAllCases } = require('../repositories/aipredictionsRepository');
const { validateDistrict, validateRequired } = require('../utils/validator');
const { CRIME_CATEGORIES, getCategoryKeys } = require('../constants/crimeCategories');
const { SEVERITY_LEVELS } = require('../constants/severityLevels');
const dateUtils = require('../utils/dateUtils');
const { percentileRank, linearTrendSlope, percentageChange, mean, standardDeviation, zScore } = require('../utils/statisticsEngine');
const responseBuilder = require('../utils/responseBuilder');
const { createLogger } = require('../utils/logger');

const logger = createLogger('aipredictions_service');

// Map operational categories to severity weights
const CATEGORY_SEVERITY_MAP = {
  VIOLENT: SEVERITY_LEVELS.CRITICAL.value,
  SEXUAL: SEVERITY_LEVELS.CRITICAL.value,
  NARCOTICS: SEVERITY_LEVELS.HIGH.value,
  PROPERTY: SEVERITY_LEVELS.MEDIUM.value,
  CYBER: SEVERITY_LEVELS.MEDIUM.value,
  ECONOMIC: SEVERITY_LEVELS.MEDIUM.value,
  PUBLIC_ORDER: SEVERITY_LEVELS.LOW.value,
  OTHER: SEVERITY_LEVELS.LOW.value
};

/**
 * Helper: Maps a crime group name to its operational severity weight.
 * @param {string} crimeGroupName - The name of the crime group.
 * @returns {number} The numeric severity weight.
 */
function _getSeverityWeightForCrime(crimeGroupName) {
  if (!crimeGroupName) return SEVERITY_LEVELS.LOW.value;
  
  const lowerCrime = crimeGroupName.toLowerCase();
  for (const key of getCategoryKeys()) {
    const examples = CRIME_CATEGORIES[key].examples;
    if (examples.some(ex => lowerCrime.includes(ex.toLowerCase()))) {
      return CATEGORY_SEVERITY_MAP[key];
    }
  }
  return SEVERITY_LEVELS.LOW.value;
}

/**
 * Helper: Computes absolute risk scores for all districts based on historical cases.
 * @param {Array<object>} cases - Array of normalized cases.
 * @returns {object} Map of normalized district keys to absolute risk scores.
 */
function _computeDistrictScores(cases) {
  const scores = {};
  for (const c of cases) {
    if (!c.DistrictID) continue;
    
    // Assumption: CaseMaster.DistrictID stores the string name. 
    // If it stores a numeric foreign key, it must be mapped.
    const districtKey = c.DistrictID.toString().trim().toLowerCase();
    
    if (!scores[districtKey]) {
      scores[districtKey] = 0;
    }
    scores[districtKey] += _getSeverityWeightForCrime(c.CrimeGroupName);
  }
  return scores;
}

/**
 * Milestone 2A: District Risk Assessment
 * 
 * Computes a unified risk score for a specific district based on the frequency 
 * and severity of historical crimes, providing a comparative measure against other districts.
 * 
 * @param {object} req - Incoming request object.
 * @param {object} args - Extracted action arguments from controller.
 * @returns {Promise<object>} Standardized API response.
 */
async function getDistrictRisk(req, args) {
  logger.info('Starting getDistrictRisk assessment', { args });

  // 1. Validation
  const reqValidation = validateRequired(args, ['district']);
  if (!reqValidation.isValid) {
    logger.warn('Validation failed: missing fields', { missing: reqValidation.missingFields });
    return responseBuilder.error(400, 'INVALID_REQUEST', reqValidation.message);
  }

  const distValidation = validateDistrict(args.district);
  if (!distValidation.isValid) {
    logger.warn('Validation failed: invalid district', { input: args.district });
    return responseBuilder.error(400, 'INVALID_DISTRICT', distValidation.message);
  }

  // Use the canonical district name from the validator
  const targetDistrict = distValidation.district.name;
  const targetDistrictKey = targetDistrict.toLowerCase();

  try {
    // 2. Data Retrieval
    const cases = await getAllCases(req);
    logger.info(`Retrieved ${cases.length} total cases for risk assessment`);

    // 3. Score Computation
    const scores = _computeDistrictScores(cases);
    const absoluteScore = scores[targetDistrictKey] || 0;

    // 4. Percentile Ranking
    // Extract all scores and sort ascending to compute percentile rank
    const allScores = Object.values(scores).sort((a, b) => a - b);
    
    // If the target district has 0 cases, its rank is 0.
    const relativeRiskRank = absoluteScore > 0 
      ? percentileRank(absoluteScore, allScores) 
      : 0;

    logger.info('Successfully computed district risk', { 
      district: targetDistrict, 
      absoluteScore, 
      relativeRiskRank 
    });

    // 5. Response Building
    return responseBuilder.success('District risk assessed successfully', {
      district: targetDistrict,
      absoluteScore,
      relativeRiskRank
    });

  } catch (error) {
    logger.error('Failed to assess district risk', error);
    // Let the global error handler catch this or return generic error
    throw error;
  }
}

/**
 * Helper: Groups cases by month, sorts them, and fills missing months with zeroes.
 * @param {Array<object>} cases - Array of case objects.
 * @returns {Array<{ month: string, count: number }>} Continuous, sorted time series.
 */
function _buildContinuousTimeSeries(cases) {
  if (!cases || cases.length === 0) return [];

  // Group by month
  const groupedMap = dateUtils.groupByPeriod(cases, 'CrimeRegisteredDate', 'MONTHLY');
  
  // Sort the keys to find min and max month
  const sortedKeys = Array.from(groupedMap.keys()).sort();
  if (sortedKeys.length === 0) return [];
  
  const minKey = sortedKeys[0];
  const maxKey = sortedKeys[sortedKeys.length - 1];
  
  const minParts = minKey.split('-');
  const maxParts = maxKey.split('-');
  
  let currentYear = parseInt(minParts[0], 10);
  let currentMonth = parseInt(minParts[1], 10);
  const endYear = parseInt(maxParts[0], 10);
  const endMonth = parseInt(maxParts[1], 10);
  
  const timeSeries = [];
  
  // Zero-fill iteration
  while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
    const monthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    const casesInMonth = groupedMap.get(monthKey) || [];
    
    timeSeries.push({
      month: monthKey,
      count: casesInMonth.length
    });
    
    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }
  }
  
  return timeSeries;
}

/**
 * Milestone 2B: Trend Forecasting
 * 
 * Analyzes historical crime volumes over time to forecast whether crime in a 
 * specific district (or statewide) is increasing, decreasing, or stable.
 * 
 * @param {object} req - Incoming request object.
 * @param {object} args - Extracted action arguments from controller.
 * @returns {Promise<object>} Standardized API response.
 */
async function predictTrend(req, args) {
  const argsData = args || {};
  logger.info('Starting predictTrend', { args: argsData });
  
  let targetDistrict = null;
  
  // 1. Validation (District is optional for trend analysis, if missing = statewide)
  if (argsData.district) {
    const distValidation = validateDistrict(argsData.district);
    if (!distValidation.isValid) {
      logger.warn('Validation failed: invalid district', { input: argsData.district });
      return responseBuilder.error(400, 'INVALID_DISTRICT', distValidation.message);
    }
    // Use canonical name
    targetDistrict = distValidation.district.name;
  }
  
  try {
    // 2. Data Retrieval
    const allCases = await getAllCases(req);
    
    // 3. Filtering
    const filteredCases = targetDistrict 
      ? allCases.filter(c => c.DistrictID && c.DistrictID.toString().trim().toLowerCase() === targetDistrict.toLowerCase())
      : allCases;
      
    logger.info(`Analyzing trend for ${targetDistrict || 'STATEWIDE'} with ${filteredCases.length} cases`);

    // 4. Grouping & Zero-Filling
    const timeSeriesData = _buildContinuousTimeSeries(filteredCases);
    
    // Extract counts for statistics engine
    const counts = timeSeriesData.map(t => t.count);
    
    // 5. Statistical Analysis
    const trendAnalysis = linearTrendSlope(counts);
    
    let shortTermChange = 0;
    if (counts.length >= 2) {
      const lastMonthCount = counts[counts.length - 1];
      const prevMonthCount = counts[counts.length - 2];
      shortTermChange = percentageChange(prevMonthCount, lastMonthCount);
    }
    
    logger.info('Successfully calculated trend', { 
      district: targetDistrict || 'STATEWIDE', 
      trend: trendAnalysis.direction,
      dataPoints: counts.length
    });

    // 6. Response Building
    return responseBuilder.success('Trend forecast calculated successfully', {
      district: targetDistrict || 'STATEWIDE',
      trend: trendAnalysis.direction,
      slope: trendAnalysis.slope,
      shortTermChange,
      timeSeries: timeSeriesData
    });

  } catch (error) {
    logger.error('Failed to calculate trend', error);
    throw error;
  }
}

/**
 * Helper: Filters cases to those occurring within the last N days relative to the latest date.
 * @param {Array<object>} cases - Array of all cases.
 * @param {number} days - Number of days to look back.
 * @returns {Array<object>} Filtered recent cases.
 */
function _filterRecentCases(cases, days = 30) {
  let maxDate = 0;
  for (const c of cases) {
    if (!c.CrimeRegisteredDate) continue;
    const time = new Date(c.CrimeRegisteredDate).getTime();
    if (time > maxDate) {
      maxDate = time;
    }
  }
  
  if (maxDate === 0) return [];

  const cutoffTime = maxDate - (days * 24 * 60 * 60 * 1000);
  
  return cases.filter(c => {
    if (!c.CrimeRegisteredDate) return false;
    const caseTime = new Date(c.CrimeRegisteredDate).getTime();
    return caseTime >= cutoffTime;
  });
}

/**
 * Helper: Groups cases by district and counts them, ensuring all historically 
 * known districts are initialized to 0 to preserve population accuracy.
 * @param {Array<object>} recentCases - Cases in the recent window.
 * @param {Array<object>} allCases - All historical cases.
 * @returns {object} Object containing counts map and original names map.
 */
function _computeDistrictCaseCounts(recentCases, allCases) {
  const counts = {};
  const originalNames = {};
  
  // 1. Initialize all known districts
  for (const c of allCases) {
    if (c.DistrictID) {
      const districtKey = c.DistrictID.toString().trim().toLowerCase();
      if (counts[districtKey] === undefined) {
        counts[districtKey] = 0;
        originalNames[districtKey] = c.DistrictID.toString().trim();
      }
    }
  }
  
  // 2. Count recent cases
  for (const c of recentCases) {
    if (!c.DistrictID) continue;
    const districtKey = c.DistrictID.toString().trim().toLowerCase();
    if (counts[districtKey] !== undefined) {
      counts[districtKey] += 1;
    }
  }
  
  return { counts, originalNames };
}

/**
 * Milestone 2C: Hotspot Prediction
 * 
 * Identifies districts currently experiencing a statistically significant, 
 * anomalous spike in crime compared to peer districts across the state.
 * 
 * @param {object} req - Incoming request object.
 * @param {object} args - Extracted action arguments from controller.
 * @returns {Promise<object>} Standardized API response.
 */
async function predictHotspots(req, args) {
  const argsData = args || {};
  logger.info('Starting predictHotspots', { args: argsData });
  
  const days = parseInt(argsData.days, 10) || 30;
  const threshold = parseFloat(argsData.threshold) || 1.5;

  try {
    // 1. Data Retrieval
    const allCases = await getAllCases(req);
    
    // 2. Filter recent cases using maximum date in dataset
    const recentCases = _filterRecentCases(allCases, days);
    logger.info(`Found ${recentCases.length} cases in the last ${days} days of the dataset`);

    // 3. Compute district counts (ensuring 0-counts are captured for accurate stats)
    const { counts, originalNames } = _computeDistrictCaseCounts(recentCases, allCases);
    const countValues = Object.values(counts);

    // 4. Compute population statistics
    const avg = mean(countValues);
    const stdDev = standardDeviation(countValues);
    
    logger.info('Computed statewide hotspot baseline statistics', { avg, stdDev });

    // 5. Calculate Z-scores and classify hotspots
    const hotspots = [];
    for (const [districtKey, count] of Object.entries(counts)) {
      const z = zScore(count, avg, stdDev);
      if (z > threshold) {
        hotspots.push({
          district: originalNames[districtKey],
          caseCount: count,
          zScore: parseFloat(z.toFixed(2))
        });
      }
    }

    // 6. Sort descending by Z-score
    hotspots.sort((a, b) => b.zScore - a.zScore);

    logger.info(`Identified ${hotspots.length} hotspots`, { threshold });

    // 7. Response Building
    return responseBuilder.success('Hotspot prediction completed successfully', {
      timeWindowDays: days,
      zScoreThreshold: threshold,
      statewideAverage: parseFloat(avg.toFixed(2)),
      hotspots
    });
  } catch (error) {
    logger.error('Failed to predict hotspots', error);
    throw error;
  }
}

/**
 * Helper: Maps a raw crime group name to its normalized operational category.
 * @param {string} crimeGroupName - Raw crime group from the database.
 * @returns {string} Normalized category key (e.g., 'VIOLENT', 'PROPERTY', 'OTHER').
 */
function _getNormalizedCategory(crimeGroupName) {
  if (!crimeGroupName) return 'OTHER';
  
  const lowerCrime = crimeGroupName.toLowerCase();
  for (const key of getCategoryKeys()) {
    const examples = CRIME_CATEGORIES[key].examples;
    if (examples.some(ex => lowerCrime.includes(ex.toLowerCase()))) {
      return key;
    }
  }
  return 'OTHER';
}

/**
 * Helper: Computes crime category frequencies and probabilities for a dataset.
 * @param {Array<object>} cases - Array of cases.
 * @returns {Array<object>} Array of predicted categories sorted by probability.
 */
function _computeCategoryPredictions(cases) {
  const counts = {};
  let totalValidCases = 0;
  
  // Initialize all known categories to 0
  for (const key of getCategoryKeys()) {
    counts[key] = 0;
  }
  
  for (const c of cases) {
    const category = _getNormalizedCategory(c.CrimeGroupName);
    counts[category]++;
    totalValidCases++;
  }
  
  if (totalValidCases === 0) return [];
  
  const predictions = [];
  for (const [key, count] of Object.entries(counts)) {
    if (count > 0) {
      predictions.push({
        category: key,
        label: CRIME_CATEGORIES[key].label,
        count: count,
        probability: parseFloat(((count / totalValidCases) * 100).toFixed(2))
      });
    }
  }
  
  // Sort descending by probability
  predictions.sort((a, b) => b.probability - a.probability);
  
  return predictions;
}

/**
 * Milestone 2D: Crime Category Prediction
 * 
 * Predicts the most likely types of crime to occur in a specific district 
 * based on historical distribution, aiding in specialized resource allocation.
 * 
 * @param {object} req - Incoming request object.
 * @param {object} args - Extracted action arguments from controller.
 * @returns {Promise<object>} Standardized API response.
 */
async function predictCategory(req, args) {
  const argsData = args || {};
  logger.info('Starting predictCategory', { args: argsData });

  // 1. Validation
  const reqValidation = validateRequired(argsData, ['district']);
  if (!reqValidation.isValid) {
    logger.warn('Validation failed: missing fields', { missing: reqValidation.missingFields });
    return responseBuilder.error(400, 'INVALID_REQUEST', reqValidation.message);
  }

  const distValidation = validateDistrict(argsData.district);
  if (!distValidation.isValid) {
    logger.warn('Validation failed: invalid district', { input: argsData.district });
    return responseBuilder.error(400, 'INVALID_DISTRICT', distValidation.message);
  }

  const targetDistrict = distValidation.district.name;

  try {
    // 2. Data Retrieval
    const allCases = await getAllCases(req);
    
    // 3. Filtering
    const districtCases = allCases.filter(c => 
      c.DistrictID && c.DistrictID.toString().trim().toLowerCase() === targetDistrict.toLowerCase()
    );
    
    logger.info(`Found ${districtCases.length} historical cases for district ${targetDistrict}`);

    // 4. Computation
    const predictions = _computeCategoryPredictions(districtCases);
    
    logger.info(`Generated category predictions for ${targetDistrict}`, { 
      topCategory: predictions.length > 0 ? predictions[0].category : null 
    });

    // 5. Response Building
    return responseBuilder.success('Crime category prediction completed successfully', {
      district: targetDistrict,
      totalAnalyzedCases: districtCases.length,
      predictions
    });

  } catch (error) {
    logger.error('Failed to predict category', error);
    throw error;
  }
}

module.exports = {
  getDistrictRisk,
  predictTrend,
  predictHotspots,
  predictCategory
};
