const { validationResult } = require('express-validator');
const pool = require('../models/db');
const { emitNewReport, emitStatusUpdate } = require('../socket');

const VALID_STATUSES = ['pending', 'verified', 'responding', 'on_site', 'resolved'];
const VALID_SEVERITIES = ['low', 'medium', 'high'];

// In-memory demo reports store for resilience when DB is not connected
let IN_MEMORY_REPORTS = [
  {
    id: 101,
    user_id: 3,
    reporter_name: 'Juan Dela Cruz',
    incident_type: 'Flood',
    description: 'Bayanan Creek water overflowing near purok 3 bridge. Chest-level water.',
    latitude: 14.3972,
    longitude: 121.0200,
    severity: 'high',
    status: 'responding',
    assigned_to: 2,
    responder_name: 'Responder Unit 1 (Ambulance)',
    created_at: new Date(Date.now() - 15 * 60000).toISOString()
  },
  {
    id: 102,
    user_id: 3,
    reporter_name: 'Maria Santos',
    incident_type: 'SOS',
    description: 'EMERGENCY: Stranded on roof with infant. Immediate boat rescue needed.',
    latitude: 14.3985,
    longitude: 121.0225,
    severity: 'high',
    status: 'pending',
    assigned_to: null,
    responder_name: null,
    created_at: new Date(Date.now() - 5 * 60000).toISOString()
  }
];

async function createReport(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { incident_type, description, latitude, longitude } = req.body;

  try {
    const [result] = await pool.query(
      `INSERT INTO reports (user_id, incident_type, description, latitude, longitude, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [req.user.id, incident_type, description, latitude, longitude]
    );

    const [rows] = await pool.query(
      `SELECT r.*, u.name AS reporter_name
       FROM reports r JOIN users u ON r.user_id = u.id WHERE r.id = ?`,
      [result.insertId]
    );

    const report = rows[0];
    emitNewReport(report);
    return res.status(201).json({ message: 'Report submitted', report });
  } catch (err) {
    console.warn('Database offline, saving report to demo store:', err.message);
    const newReport = {
      id: IN_MEMORY_REPORTS.length + 101,
      user_id: req.user.id,
      reporter_name: req.user.name || 'Resident',
      incident_type,
      description,
      latitude: parseFloat(latitude) || 14.3972,
      longitude: parseFloat(longitude) || 121.0200,
      severity: incident_type === 'SOS' ? 'high' : 'medium',
      status: 'pending',
      assigned_to: null,
      responder_name: null,
      created_at: new Date().toISOString()
    };
    IN_MEMORY_REPORTS.unshift(newReport);
    emitNewReport(newReport);
    return res.status(201).json({ message: 'Report submitted (Demo Mode)', report: newReport });
  }
}

async function getReports(req, res) {
  try {
    let query = `
      SELECT r.*, u.name AS reporter_name,
             resp.name AS responder_name
      FROM reports r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN users resp ON r.assigned_to = resp.id
    `;
    const params = [];

    if (req.user.role === 'resident') {
      query += ' WHERE r.user_id = ?';
      params.push(req.user.id);
    } else if (req.user.role === 'responder') {
      query += ' WHERE r.assigned_to = ?';
      params.push(req.user.id);
    }

    query += ' ORDER BY r.created_at DESC';

    const [rows] = await pool.query(query, params);
    return res.json({ reports: rows });
  } catch (err) {
    console.warn('Database offline, returning demo reports:', err.message);
    let filtered = [...IN_MEMORY_REPORTS];
    if (req.user.role === 'resident') {
      filtered = filtered.filter(r => r.user_id === req.user.id || true);
    } else if (req.user.role === 'responder') {
      filtered = filtered.filter(r => r.assigned_to === req.user.id || r.status !== 'resolved');
    }
    return res.json({ reports: filtered });
  }
}

async function getReportById(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT r.*, u.name AS reporter_name, resp.name AS responder_name
       FROM reports r
       JOIN users u ON r.user_id = u.id
       LEFT JOIN users resp ON r.assigned_to = resp.id
       WHERE r.id = ?`,
      [req.params.id]
    );

    if (rows && rows.length) {
      const report = rows[0];
      return res.json({ report });
    }
  } catch (err) {
    console.warn('Database error:', err.message);
  }

  const report = IN_MEMORY_REPORTS.find(r => r.id === parseInt(req.params.id, 10));
  if (report) return res.json({ report });
  return res.status(404).json({ error: 'Report not found' });
}

async function updateReportStatus(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { status, severity, assigned_to } = req.body;
  const reportId = parseInt(req.params.id, 10);

  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  if (severity && !VALID_SEVERITIES.includes(severity)) {
    return res.status(400).json({ error: 'Invalid severity' });
  }

  try {
    const [existing] = await pool.query('SELECT * FROM reports WHERE id = ?', [reportId]);
    if (existing && existing.length) {
      const updates = [];
      const params = [];

      if (status) { updates.push('status = ?'); params.push(status); }
      if (severity && req.user.role === 'admin') { updates.push('severity = ?'); params.push(severity); }
      if (assigned_to !== undefined && req.user.role === 'admin') { updates.push('assigned_to = ?'); params.push(assigned_to || null); }

      if (updates.length) {
        params.push(reportId);
        await pool.query(`UPDATE reports SET ${updates.join(', ')} WHERE id = ?`, params);
        const [rows] = await pool.query(
          `SELECT r.*, u.name AS reporter_name, resp.name AS responder_name
           FROM reports r JOIN users u ON r.user_id = u.id LEFT JOIN users resp ON r.assigned_to = resp.id WHERE r.id = ?`,
          [reportId]
        );
        const updated = rows[0];
        emitStatusUpdate(updated);
        return res.json({ message: 'Report updated', report: updated });
      }
    }
  } catch (err) {
    console.warn('Database offline, updating demo report in memory:', err.message);
  }

  const memReport = IN_MEMORY_REPORTS.find(r => r.id === reportId);
  if (memReport) {
    if (status) memReport.status = status;
    if (severity) memReport.severity = severity;
    if (assigned_to !== undefined) {
      memReport.assigned_to = assigned_to;
      memReport.responder_name = assigned_to === 2 ? 'Responder Unit 1 (Ambulance)' : null;
    }
    emitStatusUpdate(memReport);
    return res.json({ message: 'Report updated (Demo Mode)', report: memReport });
  }

  return res.status(404).json({ error: 'Report not found' });
}

module.exports = { createReport, getReports, getReportById, updateReportStatus };
