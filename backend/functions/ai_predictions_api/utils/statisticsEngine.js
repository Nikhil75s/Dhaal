// Statistical analysis utilities for DHAAL Intelligence Layer.
// Pure math functions with no external dependencies.
// Used by ai_predictions_api and anomaly_alerts_api for
// trend analysis, deviation detection, and baseline computation.

/**
 * Computes the arithmetic mean of a numeric array.
 *
 * @param {number[]} values - Array of numbers.
 * @returns {number} Mean value, or 0 if the array is empty.
 */
function mean(values) {
  if (!values || values.length === 0) return 0;
  const sum = values.reduce((acc, val) => acc + val, 0);
  return sum / values.length;
}

/**
 * Computes the population standard deviation.
 *
 * @param {number[]} values - Array of numbers.
 * @returns {number} Standard deviation, or 0 if fewer than 2 values.
 */
function standardDeviation(values) {
  if (!values || values.length < 2) return 0;
  const avg = mean(values);
  const squaredDiffs = values.map(val => (val - avg) ** 2);
  return Math.sqrt(mean(squaredDiffs));
}

/**
 * Computes the z-score (standard score) of a value relative to a distribution.
 *
 * @param {number} value - The observed value.
 * @param {number} avg - The distribution mean.
 * @param {number} stdDev - The distribution standard deviation.
 * @returns {number} Z-score, or 0 if stdDev is 0 (no variance).
 */
function zScore(value, avg, stdDev) {
  if (stdDev === 0) return 0;
  return (value - avg) / stdDev;
}

/**
 * Computes the percentile rank of a value within a sorted array.
 *
 * @param {number} value - The value to rank.
 * @param {number[]} sortedValues - Array sorted in ascending order.
 * @returns {number} Percentile rank (0–100), or 0 if the array is empty.
 */
function percentileRank(value, sortedValues) {
  if (!sortedValues || sortedValues.length === 0) return 0;
  let count = 0;
  for (const v of sortedValues) {
    if (v < value) count++;
  }
  return (count / sortedValues.length) * 100;
}

/**
 * Computes the percentage change between two values.
 *
 * @param {number} oldValue - The previous value.
 * @param {number} newValue - The current value.
 * @returns {number} Percentage change, or 0 if oldValue is 0.
 */
function percentageChange(oldValue, newValue) {
  if (oldValue === 0) return newValue === 0 ? 0 : 100;
  return ((newValue - oldValue) / Math.abs(oldValue)) * 100;
}

/**
 * Computes the slope of a linear trend using least-squares regression.
 * A positive slope indicates an increasing trend; negative indicates decreasing.
 *
 * @param {number[]} timeSeries - Ordered array of values (one per time period).
 * @returns {{ slope: number, direction: string }} Slope and human-readable direction.
 */
function linearTrendSlope(timeSeries) {
  if (!timeSeries || timeSeries.length < 2) {
    return { slope: 0, direction: 'STABLE' };
  }

  const n = timeSeries.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += timeSeries[i];
    sumXY += i * timeSeries[i];
    sumXX += i * i;
  }

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return { slope: 0, direction: 'STABLE' };

  const slope = (n * sumXY - sumX * sumY) / denominator;

  // Classify direction based on slope relative to the mean magnitude.
  const avg = sumY / n;
  const normalizedSlope = avg !== 0 ? slope / Math.abs(avg) : 0;

  let direction;
  if (normalizedSlope > 0.02) {
    direction = 'INCREASING';
  } else if (normalizedSlope < -0.02) {
    direction = 'DECREASING';
  } else {
    direction = 'STABLE';
  }

  return { slope, direction };
}

/**
 * Computes a simple moving average over a window.
 *
 * @param {number[]} values - Array of numeric values.
 * @param {number} windowSize - Number of periods in the moving window.
 * @returns {number[]} Array of moving average values (length = values.length - windowSize + 1).
 */
function movingAverage(values, windowSize) {
  if (!values || values.length === 0 || windowSize < 1) return [];
  if (windowSize > values.length) return [mean(values)];

  const result = [];
  for (let i = 0; i <= values.length - windowSize; i++) {
    const window = values.slice(i, i + windowSize);
    result.push(mean(window));
  }
  return result;
}

module.exports = {
  mean,
  standardDeviation,
  zScore,
  percentileRank,
  percentageChange,
  linearTrendSlope,
  movingAverage
};
