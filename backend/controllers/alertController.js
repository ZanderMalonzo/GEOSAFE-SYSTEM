const { validationResult } = require('express-validator');
const pool = require('../models/db');
const { emitAlertBroadcast } = require('../socket');

async function createAlert(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { message, severity } = req.body;

  try {
    const [result] = await pool.query(
      'INSERT INTO alerts (message, severity, created_by) VALUES (?, ?, ?)',
      [message, severity, req.user.id]
    );

    const [rows] = await pool.query(
      `SELECT a.*, u.name AS created_by_name
       FROM alerts a JOIN users u ON a.created_by = u.id WHERE a.id = ?`,
      [result.insertId]
    );

    const alert = rows[0];
    emitAlertBroadcast(alert);
    res.status(201).json({ message: 'Alert broadcast', alert });
  } catch (err) {
    console.error('Create alert error:', err);
    res.status(500).json({ error: 'Failed to create alert' });
  }
}

async function getAlerts(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT a.*, u.name AS created_by_name
       FROM alerts a JOIN users u ON a.created_by = u.id
       ORDER BY a.created_at DESC LIMIT 50`
    );
    res.json({ alerts: rows });
  } catch (err) {
    console.error('Get alerts error:', err);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
}

module.exports = { createAlert, getAlerts };
