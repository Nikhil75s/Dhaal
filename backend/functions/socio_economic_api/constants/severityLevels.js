// Severity levels for DHAAL Intelligence Layer.
// Used by anomaly alerts, risk scoring, and intelligence reporting
// to provide consistent severity classification across all modules.

const SEVERITY_LEVELS = {
  CRITICAL: {
    value: 4,
    label: 'Critical',
    description: 'Requires immediate attention. Significant operational impact.'
  },
  HIGH: {
    value: 3,
    label: 'High',
    description: 'Urgent attention needed. Notable deviation from baseline.'
  },
  MEDIUM: {
    value: 2,
    label: 'Medium',
    description: 'Monitor closely. Moderate deviation from baseline.'
  },
  LOW: {
    value: 1,
    label: 'Low',
    description: 'Informational. Minor deviation within expected range.'
  }
};

/**
 * Returns severity keys in descending order of urgency.
 *
 * @returns {string[]} ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
 */
function getSeverityKeys() {
  return ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
}

/**
 * Compares two severity levels.
 *
 * @param {string} a - First severity key.
 * @param {string} b - Second severity key.
 * @returns {number} Positive if a > b, negative if a < b, 0 if equal.
 */
function compareSeverity(a, b) {
  const valA = SEVERITY_LEVELS[a]?.value || 0;
  const valB = SEVERITY_LEVELS[b]?.value || 0;
  return valA - valB;
}

module.exports = {
  SEVERITY_LEVELS,
  getSeverityKeys,
  compareSeverity
};
