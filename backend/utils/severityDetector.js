/**
 * Severity Detection Module for GeoSafe System
 * Pamantasan ng Lungsod ng Muntinlupa - Capstone Project
 * 
 * Implements rule-based and keyword analysis to classify disaster reports
 * into High, Medium, or Low severity levels with transparent score breakdown.
 */

const HIGH_KEYWORDS = [
  'trapped', 'roof', 'rooftop', 'chest-deep', 'chest deep', 'neck-deep', 'neck deep',
  'drowning', 'infant', 'baby', 'pregnant', 'elderly', 'senior', 'pwd', 'disabled',
  'bleeding', 'unconscious', 'casualty', 'casualties', 'collapsed', 'collapse',
  'structural failure', 'explosion', 'live wire', 'electrocution', 'fire spreading',
  'suffocating', 'heart attack', 'critical', 'oxygen', 'urgent boat', 'immediate rescue',
  'landslide', 'buried', 'submerged'
];

const MEDIUM_KEYWORDS = [
  'waist-deep', 'waist deep', 'knee-deep', 'knee deep', 'rising water', 'rapid rise',
  'heavy smoke', 'impassable', 'blocked road', 'fracture', 'broken bone', 'wound',
  'power outage', 'blackout', 'blocked passage', 'sparks', 'overflowing', 'creek rising',
  'rising rapidly', 'minor fire', 'flood entered house', 'stranded vehicle', 'injured'
];

const LOW_KEYWORDS = [
  'gutter-deep', 'gutter deep', 'ankle-deep', 'ankle deep', 'light rain', 'drizzle',
  'minor damage', 'standing water', 'trash', 'debris', 'fallen branch', 'puddle',
  'street light', 'clogged drainage', 'slow traffic', 'advisory query', 'inquiry'
];

const BASE_SCORES_BY_TYPE = {
  'SOS': 60,
  'Fire': 40,
  'Medical': 45,
  'Earthquake': 35,
  'Flood': 30,
  'Storm': 25,
  'Other': 15
};

/**
 * Checks if a keyword is present and NOT negated (e.g. "no trapped residents", "not injured")
 */
function isKeywordPresentAndAffirmative(text, keyword) {
  const kwPattern = keyword.replace('-', '[\\-\\s]');
  const kwRegex = new RegExp(`(^|\\W)${kwPattern}(\\W|$)`, 'i');
  if (!kwRegex.test(text)) return false;

  const negatedRegex = new RegExp(`\\b(no|not|none|without|zero|0)\\s+(immediate\\s+|active\\s+|other\\s+)?${kwPattern}`, 'i');
  return !negatedRegex.test(text);
}

/**
 * Detects severity level, calculates urgency score (0-100), and provides reason triggers.
 * 
 * @param {string} incidentType - Category of disaster (e.g., 'Flood', 'Fire', 'SOS')
 * @param {string} description - Detailed incident description submitted by citizen
 * @returns {Object} { severity: 'low'|'medium'|'high', score: number, matchedKeywords: string[], breakdown: Object, recommendation: string }
 */
function detectSeverity(incidentType, description = '') {
  const normType = (incidentType || 'Other').trim();
  const text = (description || '').toLowerCase();

  let baseScore = BASE_SCORES_BY_TYPE[normType] || 20;
  let keywordScore = 0;
  const matchedHigh = [];
  const matchedMedium = [];
  const matchedLow = [];

  // Check High Keywords (each match +15 pts, cap at 45)
  for (const kw of HIGH_KEYWORDS) {
    if (isKeywordPresentAndAffirmative(text, kw)) {
      matchedHigh.push(kw);
      keywordScore += 15;
    }
  }

  // Check Medium Keywords (each match +8 pts, cap at 24)
  for (const kw of MEDIUM_KEYWORDS) {
    if (isKeywordPresentAndAffirmative(text, kw)) {
      matchedMedium.push(kw);
      keywordScore += 8;
    }
  }

  // Check Low Keywords
  for (const kw of LOW_KEYWORDS) {
    if (isKeywordPresentAndAffirmative(text, kw)) {
      matchedLow.push(kw);
    }
  }

  // If low triggers present and NO high triggers, apply mitigation
  if (matchedLow.length > 0 && matchedHigh.length === 0) {
    keywordScore = Math.max(0, keywordScore - (matchedLow.length * 5));
  }

  // Calculate composite urgency score (clamped between 0 and 100)
  const totalScore = Math.min(100, Math.max(5, baseScore + keywordScore));

  // Determine Severity Category based on threshold boundaries
  let severity = 'medium';
  if (normType.toUpperCase() === 'SOS' || matchedHigh.length >= 1 || totalScore >= 65) {
    severity = 'high';
  } else if (totalScore < 35 && matchedHigh.length === 0 && matchedMedium.length === 0) {
    severity = 'low';
  } else {
    severity = 'medium';
  }

  // Recommendations for Barangay Bayanan BDRRMC Dispatchers
  let recommendation = 'Standard verification and routine queue assignment.';
  if (severity === 'high') {
    recommendation = 'IMMEDIATE DISPATCH REQUIRED: Life-safety risk or critical vulnerability detected.';
  } else if (severity === 'medium') {
    recommendation = 'PRIORITY ACTION: Deploy field team for verification and situational monitoring.';
  }

  return {
    severity,
    score: totalScore,
    matchedKeywords: [...matchedHigh, ...matchedMedium, ...matchedLow],
    breakdown: {
      baseScore,
      keywordScore,
      highTriggers: matchedHigh,
      mediumTriggers: matchedMedium,
      lowTriggers: matchedLow
    },
    recommendation
  };
}

module.exports = {
  detectSeverity,
  HIGH_KEYWORDS,
  MEDIUM_KEYWORDS,
  LOW_KEYWORDS,
  BASE_SCORES_BY_TYPE
};
