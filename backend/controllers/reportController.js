const { validationResult } = require('express-validator');
const pool = require('../models/db');
const { emitNewReport, emitStatusUpdate } = require('../socket');

const VALID_STATUSES = ['pending', 'verified', 'responding', 'on_site', 'resolved'];
const VALID_SEVERITIES = ['low', 'medium', 'high'];

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
    res.status(201).json({ message: 'Report submitted', report });
  } catch (err) {
    console.error('Create report error:', err);
    res.status(500).json({ error: 'Failed to create report' });
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
    res.json({ reports: rows });
  } catch (err) {
    console.error('Get reports error:', err);
    res.status(500).json({ error: 'Failed to fetch reports' });
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

    if (!rows.length) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const report = rows[0];

    if (req.user.role === 'resident' && report.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (req.user.role === 'responder' && report.assigned_to !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ report });
  } catch (err) {
    console.error('Get report error:', err);
    res.status(500).json({ error: 'Failed to fetch report' });
  }
}

async function updateReportStatus(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { status, severity, assigned_to } = req.body;
  const reportId = req.params.id;

  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  if (severity && !VALID_SEVERITIES.includes(severity)) {
    return res.status(400).json({ error: 'Invalid severity' });
  }

  try {
    const [existing] = await pool.query('SELECT * FROM reports WHERE id = ?', [reportId]);
    if (!existing.length) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const report = existing[0];

    if (req.user.role === 'admin') {
      // Admin can set severity, status, assign responder
    } else if (req.user.role === 'responder') {
      if (report.assigned_to !== req.user.id) {
        return res.status(403).json({ error: 'Not assigned to this incident' });
      }
      const responderStatuses = ['responding', 'on_site', 'resolved'];
      if (!status || !responderStatuses.includes(status)) {
        return res.status(400).json({ error: 'Responders can only set: responding, on_site, resolved' });
      }
    } else {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const updates = [];
    const params = [];

    if (status) {
      updates.push('status = ?');
      params.push(status);
    }
    if (severity && req.user.role === 'admin') {
      updates.push('severity = ?');
      params.push(severity);
    }
    if (assigned_to !== undefined && req.user.role === 'admin') {
      updates.push('assigned_to = ?');
      params.push(assigned_to || null);
    }

    if (!updates.length) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    params.push(reportId);
    await pool.query(`UPDATE reports SET ${updates.join(', ')} WHERE id = ?`, params);

    const [rows] = await pool.query(
      `SELECT r.*, u.name AS reporter_name, resp.name AS responder_name
       FROM reports r
       JOIN users u ON r.user_id = u.id
       LEFT JOIN users resp ON r.assigned_to = resp.id
       WHERE r.id = ?`,
      [reportId]
    );

    const updated = rows[0];
    emitStatusUpdate(updated);
    res.json({ message: 'Report updated', report: updated });
  } catch (err) {
    console.error('Update report error:', err);
    res.status(500).json({ error: 'Failed to update report' });
  }
}

module.exports = { createReport, getReports, getReportById, updateReportStatus };
