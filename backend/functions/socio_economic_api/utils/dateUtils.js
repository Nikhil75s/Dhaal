// Date aggregation utilities for DHAAL Intelligence Layer.
// Provides time-period grouping functions needed by every module
// that works with temporal crime data.

/**
 * Returns a month key from a date string or Date object.
 *
 * @param {string|Date} date - Date input.
 * @returns {string} Month key in "YYYY-MM" format.
 */
function getMonthKey(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Returns a quarter key from a date string or Date object.
 *
 * @param {string|Date} date - Date input.
 * @returns {string} Quarter key in "YYYY-Q#" format.
 */
function getQuarterKey(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const quarter = Math.ceil((d.getMonth() + 1) / 3);
  return `${year}-Q${quarter}`;
}

/**
 * Returns a year key from a date string or Date object.
 *
 * @param {string|Date} date - Date input.
 * @returns {string} Year key in "YYYY" format.
 */
function getYearKey(date) {
  const d = new Date(date);
  return String(d.getFullYear());
}

/**
 * Returns an ISO week key from a date string or Date object.
 *
 * @param {string|Date} date - Date input.
 * @returns {string} Week key in "YYYY-W##" format.
 */
function getWeekKey(date) {
  const d = new Date(date);
  const year = d.getFullYear();

  // ISO week number calculation.
  const jan1 = new Date(year, 0, 1);
  const dayOfYear = Math.ceil((d - jan1) / 86400000) + 1;
  const weekNumber = Math.ceil(dayOfYear / 7);

  return `${year}-W${String(weekNumber).padStart(2, '0')}`;
}

/**
 * Groups an array of records by a specified time period.
 *
 * @param {object[]} records - Array of record objects.
 * @param {string} dateField - Name of the date field on each record.
 * @param {'WEEKLY'|'MONTHLY'|'QUARTERLY'|'YEARLY'} periodType - Grouping granularity.
 * @returns {Map<string, object[]>} Map of period keys to grouped records.
 */
function groupByPeriod(records, dateField, periodType) {
  const keyFn = {
    WEEKLY: getWeekKey,
    MONTHLY: getMonthKey,
    QUARTERLY: getQuarterKey,
    YEARLY: getYearKey
  }[periodType];

  if (!keyFn) {
    throw new Error(`Unsupported period type: ${periodType}`);
  }

  const grouped = new Map();

  for (const record of records) {
    const dateValue = record[dateField];
    if (!dateValue) continue;

    const key = keyFn(dateValue);
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(record);
  }

  return grouped;
}

/**
 * Returns the start and end dates for a period key.
 *
 * @param {string} periodKey - Period key (e.g. "2026-07", "2026-Q3", "2026").
 * @returns {{ start: Date, end: Date }} Start and end dates (inclusive).
 */
function getDateRange(periodKey) {
  // Monthly: "YYYY-MM"
  if (/^\d{4}-\d{2}$/.test(periodKey)) {
    const [year, month] = periodKey.split('-').map(Number);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0); // Last day of month
    return { start, end };
  }

  // Quarterly: "YYYY-Q#"
  if (/^\d{4}-Q[1-4]$/.test(periodKey)) {
    const year = parseInt(periodKey.substring(0, 4), 10);
    const quarter = parseInt(periodKey.substring(6), 10);
    const startMonth = (quarter - 1) * 3;
    const start = new Date(year, startMonth, 1);
    const end = new Date(year, startMonth + 3, 0);
    return { start, end };
  }

  // Yearly: "YYYY"
  if (/^\d{4}$/.test(periodKey)) {
    const year = parseInt(periodKey, 10);
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    return { start, end };
  }

  throw new Error(`Unsupported period key format: ${periodKey}`);
}

module.exports = {
  getMonthKey,
  getQuarterKey,
  getYearKey,
  getWeekKey,
  groupByPeriod,
  getDateRange
};
