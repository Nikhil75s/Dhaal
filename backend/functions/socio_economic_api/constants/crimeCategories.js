// Crime category classification for DHAAL Intelligence Layer.
// Groups IPC (Indian Penal Code) crime types into operational categories
// that are meaningful for police analytics and resource allocation.

const CRIME_CATEGORIES = {
  VIOLENT: {
    label: 'Violent Crimes',
    description: 'Crimes against persons involving physical harm or threat.',
    examples: ['Murder', 'Attempt to Murder', 'Culpable Homicide', 'Assault', 'Kidnapping', 'Robbery', 'Dacoity']
  },
  PROPERTY: {
    label: 'Property Crimes',
    description: 'Crimes involving theft, burglary, or destruction of property.',
    examples: ['Theft', 'Burglary', 'House Breaking', 'Motor Vehicle Theft', 'Cheating', 'Criminal Breach of Trust']
  },
  SEXUAL: {
    label: 'Sexual Offences',
    description: 'Crimes of a sexual nature.',
    examples: ['Rape', 'Sexual Harassment', 'Molestation', 'Eve Teasing', 'POCSO Cases']
  },
  CYBER: {
    label: 'Cyber Crimes',
    description: 'Crimes committed using digital technology.',
    examples: ['Online Fraud', 'Identity Theft', 'Hacking', 'Cyber Stalking', 'Social Media Offences']
  },
  ECONOMIC: {
    label: 'Economic Offences',
    description: 'Financial crimes and white-collar offences.',
    examples: ['Forgery', 'Counterfeiting', 'Fraud', 'Corruption', 'Money Laundering']
  },
  NARCOTICS: {
    label: 'Narcotics & Drug Offences',
    description: 'Crimes related to illegal substances.',
    examples: ['NDPS Act Violations', 'Drug Trafficking', 'Drug Possession']
  },
  PUBLIC_ORDER: {
    label: 'Public Order',
    description: 'Crimes affecting public peace and order.',
    examples: ['Rioting', 'Unlawful Assembly', 'Arson', 'Criminal Intimidation']
  },
  OTHER: {
    label: 'Other Crimes',
    description: 'Crimes not classified under primary categories.',
    examples: ['Dowry Death', 'Cruelty by Husband', 'Missing Persons', 'Unnatural Death']
  }
};

/**
 * Returns all category keys.
 *
 * @returns {string[]} Array of category identifiers.
 */
function getCategoryKeys() {
  return Object.keys(CRIME_CATEGORIES);
}

/**
 * Returns the label for a given category key.
 *
 * @param {string} key - Category key (e.g. 'VIOLENT').
 * @returns {string|null} Human-readable label or null if not found.
 */
function getCategoryLabel(key) {
  const category = CRIME_CATEGORIES[key];
  return category ? category.label : null;
}

module.exports = {
  CRIME_CATEGORIES,
  getCategoryKeys,
  getCategoryLabel
};
