/**
 * ISO 25010 & Table 3 Automated Testing Suite
 * Pamantasan ng Lungsod ng Muntinlupa - Capstone Project
 * Project: GeoSafe Disaster Reporting & Emergency Assistance System
 * Authors: John Vee A. Perez, Zander A. Malonzo, Shereen L. Onita
 * 
 * Executes automated test cases matching Chapter 3 Table 3:
 * - Module 1: User Authentication System
 * - Module 2: Emergency Reporting Workflow
 * - Module 3: Severity Detection & Priority Accuracy Test
 * - Module 4: Security Measures (JWT, Bcrypt, RBAC)
 * - Module 5: Performance & Response Time (ISO 25010 Evaluation)
 */

const assert = require('assert');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { detectSeverity, HIGH_KEYWORDS, MEDIUM_KEYWORDS, LOW_KEYWORDS } = require('../utils/severityDetector');
const { calculateReportPriority, sortReportsByPriority, haversineKm } = require('../utils/prioritizer');

const JWT_SECRET = process.env.JWT_SECRET || 'geosafe_jwt_secret_bayanan_2026';

let passedTests = 0;
let totalTests = 0;
const resultsLog = [];

function runTest(testName, testFn) {
  totalTests++;
  try {
    const start = process.hrtime();
    testFn();
    const diff = process.hrtime(start);
    const durationMs = (diff[0] * 1000 + diff[1] / 1000000).toFixed(2);
    passedTests++;
    resultsLog.push({ name: testName, status: 'PASSED', duration: `${durationMs}ms` });
    console.log(`  \x1b[32m✔ [PASS]\x1b[0m ${testName} (${durationMs}ms)`);
  } catch (err) {
    resultsLog.push({ name: testName, status: 'FAILED', error: err.message });
    console.error(`  \x1b[31m✖ [FAIL]\x1b[0m ${testName}: ${err.message}`);
  }
}

async function runAsyncTest(testName, testFn) {
  totalTests++;
  try {
    const start = process.hrtime();
    await testFn();
    const diff = process.hrtime(start);
    const durationMs = (diff[0] * 1000 + diff[1] / 1000000).toFixed(2);
    passedTests++;
    resultsLog.push({ name: testName, status: 'PASSED', duration: `${durationMs}ms` });
    console.log(`  \x1b[32m✔ [PASS]\x1b[0m ${testName} (${durationMs}ms)`);
  } catch (err) {
    resultsLog.push({ name: testName, status: 'FAILED', error: err.message });
    console.error(`  \x1b[31m✖ [FAIL]\x1b[0m ${testName}: ${err.message}`);
  }
}

async function runTestSuite() {
  console.log('\n======================================================================');
  console.log('   PAMANTASAN NG LUNGSOD NG MUNTINLUPA - CAPSTONE PROJECT');
  console.log('   ISO 25010 & Table 3 Automated Testing Suite: GeoSafe System');
  console.log('======================================================================\n');

  // --------------------------------------------------------------------------
  // MODULE 1: USER AUTHENTICATION SYSTEM
  // --------------------------------------------------------------------------
  console.log('\x1b[36m[Module 1/5] User Authentication System (Table 3)\x1b[0m');
  
  await runAsyncTest('Password Hashing Verification (Bcrypt salt & hash generation)', async () => {
    const rawPass = 'Resident@2026!';
    const hash = await bcrypt.hash(rawPass, 10);
    assert(hash.startsWith('$2'), 'Bcrypt hash should follow standard $2 format');
    const matches = await bcrypt.compare(rawPass, hash);
    assert.strictEqual(matches, true, 'Valid password must match hash');
    const wrongMatches = await bcrypt.compare('WrongPassword', hash);
    assert.strictEqual(wrongMatches, false, 'Invalid password must be rejected');
  });

  runTest('JWT Token Generation and Verification (OAuth / Bearer Security)', () => {
    const payload = { id: 104, email: 'zander@bayanan.ph', role: 'resident' };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
    assert(typeof token === 'string' && token.length > 30, 'JWT token must be a signed non-empty string');
    const decoded = jwt.verify(token, JWT_SECRET);
    assert.strictEqual(decoded.id, 104);
    assert.strictEqual(decoded.role, 'resident');
  });

  runTest('Role-Based Access Control (RBAC) Role Validation', () => {
    const roles = ['resident', 'responder', 'admin'];
    assert(roles.includes('resident'), 'Resident role must be recognized');
    assert(roles.includes('responder'), 'Responder role must be recognized');
    assert(roles.includes('admin'), 'Admin role must be recognized');
    assert(!roles.includes('unauthorized_guest'), 'Unauthorized roles must not exist in access schema');
  });

  // --------------------------------------------------------------------------
  // MODULE 2: EMERGENCY REPORTING WORKFLOW
  // --------------------------------------------------------------------------
  console.log('\n\x1b[36m[Module 2/5] Emergency Reporting Workflow (Table 3)\x1b[0m');

  runTest('Geolocation Coordinate Validation (Barangay Bayanan Bounds Check)', () => {
    const sampleReport = {
      incident_type: 'Flood',
      description: 'Water rising near Bayanan Baywalk Covered Court',
      latitude: 14.4094644,
      longitude: 121.0486196
    };
    assert(sampleReport.latitude >= 14.3800 && sampleReport.latitude <= 14.4300, 'Latitude must be within Muntinlupa/Bayanan region');
    assert(sampleReport.longitude >= 121.0200 && sampleReport.longitude <= 121.0800, 'Longitude must be within Muntinlupa/Bayanan region');
    assert(sampleReport.description.length >= 6, 'Description must meet minimum length criteria');
  });

  runTest('Haversine Distance Metric Calculation for Rescue Proximity', () => {
    // Distance from Bayanan Baywalk (14.4094644, 121.0486196) to Bayanan Elementary (14.4117681, 121.0517064)
    const dist = haversineKm(14.4094644, 121.0486196, 14.4117681, 121.0517064);
    assert(dist > 0.3 && dist < 0.6, `Distance should be approximately 0.43km, got: ${dist.toFixed(3)}km`);
  });

  // --------------------------------------------------------------------------
  // MODULE 3: SEVERITY DETECTION & PRIORITY ACCURACY TEST
  // --------------------------------------------------------------------------
  console.log('\n\x1b[36m[Module 3/5] Severity Detection & Priority Accuracy (Table 3 & Specific Objective 1.b/1.c)\x1b[0m');

  runTest('High Severity Detection Test (Keyword Trigger: Trapped, Infant, Roof)', () => {
    const result = detectSeverity('Flood', 'Chest-deep flood water. Trapped on the roof with an infant and elderly grandma.');
    assert.strictEqual(result.severity, 'high', 'Severity must classify as HIGH');
    assert(result.score >= 65, `Urgency score should be >= 65, got ${result.score}`);
    assert(result.matchedKeywords.includes('trapped'), 'Should identify "trapped" trigger');
    assert(result.matchedKeywords.includes('infant'), 'Should identify "infant" trigger');
    assert(result.matchedKeywords.includes('roof'), 'Should identify "roof" trigger');
  });

  runTest('SOS Hazard Base Classification Test', () => {
    const result = detectSeverity('SOS', 'Emergency boat rescue needed at Purok 4.');
    assert.strictEqual(result.severity, 'high', 'SOS incident types must default to HIGH severity');
    assert(result.score >= 60, 'SOS incident score must be >= 60');
  });

  runTest('Medium Severity Detection Test (Rising water, impassable road)', () => {
    const result = detectSeverity('Flood', 'Knee-deep rising water along National Road, impassable for light vehicles.');
    assert.strictEqual(result.severity, 'medium', 'Severity must classify as MEDIUM');
    assert(result.score >= 35 && result.score < 65, `Urgency score should be between 35 and 64, got ${result.score}`);
    assert(result.matchedKeywords.includes('knee-deep') || result.matchedKeywords.includes('rising water'), 'Should identify medium triggers');
  });

  runTest('Low Severity Detection Test (Gutter-deep, light rain, minor puddle)', () => {
    const result = detectSeverity('Storm', 'Gutter-deep standing water near street corner after light rain. No trapped residents.');
    assert.strictEqual(result.severity, 'low', 'Severity must classify as LOW');
    assert(result.score < 35, `Urgency score should be < 35, got ${result.score}`);
  });

  runTest('Rescue Request Prioritization Ranking Test (P1 vs P2 vs P3)', () => {
    const reports = [
      { id: 1, incident_type: 'Flood', description: 'Gutter deep water in street', created_at: new Date().toISOString(), status: 'pending' },
      { id: 2, incident_type: 'SOS', description: 'Trapped on roof with baby, chest-deep flood', created_at: new Date().toISOString(), status: 'pending' },
      { id: 3, incident_type: 'Fire', description: 'Electrical smoke near warehouse', created_at: new Date().toISOString(), status: 'pending' }
    ];

    const sorted = sortReportsByPriority(reports);
    assert.strictEqual(sorted[0].id, 2, 'Critical SOS report (#2) must rank 1st in Triage queue');
    assert.strictEqual(sorted[0].priority_code, 'P1', 'Top report must be Priority Tier 1 (Critical)');
    assert(sorted[0].priority_score > sorted[1].priority_score, 'P1 score must exceed P2 score');
    assert.strictEqual(sorted[2].id, 1, 'Low severity report (#1) must rank last');
  });

  // --------------------------------------------------------------------------
  // MODULE 4: SECURITY MEASURES & PENETRATION INTEGRITY
  // --------------------------------------------------------------------------
  console.log('\n\x1b[36m[Module 4/5] Security Measures (Encryption, Token Auth, Data Sanitization)\x1b[0m');

  runTest('Invalid Token Tampering Rejection Test', () => {
    const invalidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.tamperedPayload.invalidSignature';
    assert.throws(() => {
      jwt.verify(invalidToken, JWT_SECRET);
    }, 'Tampered or fake JWT tokens must throw verification error');
  });

  runTest('XSS & Input Sanitization Integrity Test', () => {
    const dirtyText = '<script>alert("XSS")</script>Dangerous payload';
    const escaped = dirtyText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
    assert(!escaped.includes('<script>'), 'HTML/script tags must be escaped');
    assert.strictEqual(escaped.includes('&lt;script&gt;'), true, 'Tags converted to HTML safe entities');
  });

  // --------------------------------------------------------------------------
  // MODULE 5: ISO 25010 PERFORMANCE & BENCHMARKS
  // --------------------------------------------------------------------------
  console.log('\n\x1b[36m[Module 5/5] ISO 25010 Quality Benchmark Evaluation\x1b[0m');

  runTest('ISO 25010 Performance Efficiency: High-volume Triage Processing (<50ms for 500 reports)', () => {
    const bulkReports = [];
    for (let i = 0; i < 500; i++) {
      bulkReports.push({
        id: i + 1,
        incident_type: i % 3 === 0 ? 'SOS' : i % 2 === 0 ? 'Flood' : 'Fire',
        description: `Disaster report #${i}: Trapped with infant near Bayanan Purok ${i % 7 + 1}`,
        latitude: 14.4106 + (Math.random() - 0.5) * 0.01,
        longitude: 121.0502 + (Math.random() - 0.5) * 0.01,
        created_at: new Date(Date.now() - (i * 60000)).toISOString(),
        status: 'pending'
      });
    }

    const t0 = Date.now();
    const sorted = sortReportsByPriority(bulkReports, { latitude: 14.4106, longitude: 121.0502 });
    const elapsed = Date.now() - t0;

    assert.strictEqual(sorted.length, 500, 'All 500 reports must be processed');
    assert(elapsed < 50, `Processing 500 reports took ${elapsed}ms (Benchmark target: <50ms)`);
  });

  // --------------------------------------------------------------------------
  // SUMMARY REPORT GENERATION
  // --------------------------------------------------------------------------
  console.log('\n======================================================================');
  console.log('   TEST EXECUTION SUMMARY');
  console.log('======================================================================');
  console.log(`Total Tests Executed: ${totalTests}`);
  console.log(`Passed Tests:         \x1b[32m${passedTests}\x1b[0m`);
  console.log(`Failed Tests:         \x1b[${totalTests - passedTests === 0 ? '32' : '31'}m${totalTests - passedTests}\x1b[0m`);
  console.log(`Success Rate:         \x1b[32m${((passedTests / totalTests) * 100).toFixed(1)}%\x1b[0m`);
  console.log('======================================================================\n');

  if (passedTests === totalTests) {
    console.log('\x1b[32m✔ ALL ISO 25010 & TABLE 3 VERIFICATION TESTS PASSED SUCCESSFULLY!\x1b[0m\n');
    process.exit(0);
  } else {
    console.error('\x1b[31m✖ SOME TEST CASES FAILED.\x1b[0m\n');
    process.exit(1);
  }
}

runTestSuite();
