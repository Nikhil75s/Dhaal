// Karnataka state districts for DHAAL Intelligence Layer.
// Canonical list of all 31 districts grouped by administrative division.
// Used for validation, display, and analytical grouping.

const KARNATAKA_DISTRICTS = [
  // Bengaluru Division
  { name: 'Bengaluru Urban', region: 'Bengaluru' },
  { name: 'Bengaluru Rural', region: 'Bengaluru' },
  { name: 'Chikkaballapura', region: 'Bengaluru' },
  { name: 'Chitradurga', region: 'Bengaluru' },
  { name: 'Davanagere', region: 'Bengaluru' },
  { name: 'Kolar', region: 'Bengaluru' },
  { name: 'Ramanagara', region: 'Bengaluru' },
  { name: 'Tumakuru', region: 'Bengaluru' },

  // Mysuru Division
  { name: 'Chamarajanagar', region: 'Mysuru' },
  { name: 'Hassan', region: 'Mysuru' },
  { name: 'Kodagu', region: 'Mysuru' },
  { name: 'Mandya', region: 'Mysuru' },
  { name: 'Mysuru', region: 'Mysuru' },

  // Belagavi Division
  { name: 'Bagalkot', region: 'Belagavi' },
  { name: 'Belagavi', region: 'Belagavi' },
  { name: 'Dharwad', region: 'Belagavi' },
  { name: 'Gadag', region: 'Belagavi' },
  { name: 'Haveri', region: 'Belagavi' },
  { name: 'Uttara Kannada', region: 'Belagavi' },
  { name: 'Vijayapura', region: 'Belagavi' },

  // Kalaburagi Division
  { name: 'Ballari', region: 'Kalaburagi' },
  { name: 'Bidar', region: 'Kalaburagi' },
  { name: 'Kalaburagi', region: 'Kalaburagi' },
  { name: 'Koppal', region: 'Kalaburagi' },
  { name: 'Raichur', region: 'Kalaburagi' },
  { name: 'Yadgir', region: 'Kalaburagi' },

  // Coastal & Other
  { name: 'Dakshina Kannada', region: 'Coastal' },
  { name: 'Udupi', region: 'Coastal' },
  { name: 'Shivamogga', region: 'Central' },
  { name: 'Chikkamagaluru', region: 'Central' },
  { name: 'Vijayanagara', region: 'Kalaburagi' }
];

/**
 * Returns all district names as a flat array.
 *
 * @returns {string[]} Array of district name strings.
 */
function getDistrictNames() {
  return KARNATAKA_DISTRICTS.map(d => d.name);
}

/**
 * Returns districts grouped by administrative region.
 *
 * @returns {object} Map of region name to district array.
 */
function getDistrictsByRegion() {
  const grouped = {};
  for (const district of KARNATAKA_DISTRICTS) {
    if (!grouped[district.region]) {
      grouped[district.region] = [];
    }
    grouped[district.region].push(district.name);
  }
  return grouped;
}

module.exports = {
  KARNATAKA_DISTRICTS,
  getDistrictNames,
  getDistrictsByRegion
};
