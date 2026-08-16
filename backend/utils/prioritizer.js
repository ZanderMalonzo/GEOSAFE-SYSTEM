/**
 * Rescue Request Prioritization Module for GeoSafe System
 * Pamantasan ng Lungsod ng Muntinlupa - Capstone Project
 * 
 * Implements multi-factor triage prioritization algorithm:
 * Priority Score = (Severity * 0.40) + (Vulnerability * 0.25) + (Time Urgency * 0.20) + (Proximity * 0.15)
 */

const { detectSeverity } = require('./severityDetector');

const VULNERABLE_KEYWORDS = [
  'infant', 'baby', 'child', 'children', 'pregnant', 'elderly', 'senior',
  'pwd', 'disabled', 'wheelchair', 'bedridden', 'oxygen', 'heart condition',
  'unconscious', 'bleeding', 'trapped'
];

/**
 * Calculates Haversine distance in kilometers between two coordinates
 */
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Computes priority rank, tier, and breakdown for a report/rescue request.
 * 
 * @param {Object} report - Incident report object
 * @param {Object} [responderLoc] - Optional responder location { latitude, longitude }
 * @returns {Object} report enriched with priorityScore, priorityTier, and priorityDetails
 */
function calculateReportPriority(report, responderLoc = null) {
  const detection = detectSeverity(report.incident_type, report.description);
  const severityScore = detection.score; // 0 - 100

  // 1. Vulnerability Assessment (0 - 100)
  const desc = (report.description || '').toLowerCase();
  let vulnMatches = [];
  for (const vkw of VULNERABLE_KEYWORDS) {
    if (desc.includes(vkw)) {
      vulnMatches.push(vkw);
    }
  }
  let vulnScore = Math.min(100, vulnMatches.length * 35);
  if (report.incident_type === 'SOS') {
    vulnScore = Math.max(vulnScore, 60);
  }

  // 2. Time Urgency Factor (0 - 100) - older pending reports increase urgency
  let timeScore = 30; // base
  if (report.created_at) {
    const ageMinutes = (Date.now() - new Date(report.created_at).getTime()) / 60000;
    if (ageMinutes > 0) {
      // Scales upward with time waiting (up to 60 mins -> +50 pts)
      timeScore = Math.min(100, Math.round(30 + Math.min(60, ageMinutes) * 0.8));
    }
  }

  // 3. Proximity Factor (0 - 100)
  let proxScore = 50; // default medium proximity
  let distanceKm = null;
  if (responderLoc && responderLoc.latitude && responderLoc.longitude && report.latitude && report.longitude) {
    distanceKm = haversineKm(
      parseFloat(responderLoc.latitude),
      parseFloat(responderLoc.longitude),
      parseFloat(report.latitude),
      parseFloat(report.longitude)
    );
    // Under 1km = 100, 2km = 80, 5km = 40, etc.
    proxScore = Math.max(10, Math.round(100 - (distanceKm * 15)));
  }

  // Composite Prioritization Formula:
  // 40% Severity + 25% Vulnerability + 20% Time Urgency + 15% Proximity
  const compositeScore = Math.round(
    (severityScore * 0.40) +
    (vulnScore * 0.25) +
    (timeScore * 0.20) +
    (proxScore * 0.15)
  );

  // Determine Priority Tier
  let priorityTier = 'Priority 3 (Standard)';
  let priorityCode = 'P3';
  let priorityColor = '#2E7D32'; // Green
  let badgeClass = 'badge-priority-low';

  if (compositeScore >= 70 || detection.severity === 'high' || report.incident_type === 'SOS') {
    priorityTier = 'Priority 1 (Critical)';
    priorityCode = 'P1';
    priorityColor = '#D32F2F'; // Red
    badgeClass = 'badge-priority-critical';
  } else if (compositeScore >= 40 || detection.severity === 'medium') {
    priorityTier = 'Priority 2 (Urgent)';
    priorityCode = 'P2';
    priorityColor = '#F57C00'; // Orange
    badgeClass = 'badge-priority-urgent';
  }

  return {
    ...report,
    severity: report.severity || detection.severity,
    priority_score: compositeScore,
    priority_code: priorityCode,
    priority_tier: priorityTier,
    priority_color: priorityColor,
    badge_class: badgeClass,
    priority_details: {
      severity_score: severityScore,
      detected_severity: detection.severity,
      vulnerability_score: vulnScore,
      vulnerable_triggers: vulnMatches,
      time_urgency_score: timeScore,
      proximity_score: proxScore,
      distance_km: distanceKm ? Number(distanceKm.toFixed(2)) : null,
      matched_keywords: detection.matchedKeywords,
      recommendation: detection.recommendation
    }
  };
}

/**
 * Sorts an array of rescue requests/reports by urgency priority (highest first)
 */
function sortReportsByPriority(reports, responderLoc = null) {
  return reports
    .map(r => calculateReportPriority(r, responderLoc))
    .sort((a, b) => {
      // Pending/responding reports first
      const statusWeight = { pending: 4, verified: 3, responding: 2, on_site: 1, resolved: 0 };
      const statusDiff = (statusWeight[b.status] || 0) - (statusWeight[a.status] || 0);
      if (statusDiff !== 0) return statusDiff;
      // Then by priority score descending
      return b.priority_score - a.priority_score;
    });
}

module.exports = {
  calculateReportPriority,
  sortReportsByPriority,
  haversineKm,
  VULNERABLE_KEYWORDS
};
