const { validationResult } = require('express-validator');
const pool = require('../models/db');
const { emitAlertBroadcast } = require('../socket');

let IN_MEMORY_ALERTS = [
  {
    id: 1,
    message: 'BDRRMC ADVISORY: Continuous rainfall over Barangay Bayanan. Low-lying areas on Alert Level 2.',
    severity: 'medium',
    created_by: 1,
    created_by_name: 'BDRRMC Admin Lead',
    created_at: new Date(Date.now() - 30 * 60000).toISOString()
  }
];

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
    return res.status(201).json({ message: 'Alert broadcast', alert });
  } catch (err) {
    console.warn('Database error on alert create, saving in memory:', err.message);
    const newAlert = {
      id: IN_MEMORY_ALERTS.length + 1,
      message,
      severity: severity || 'medium',
      created_by: req.user.id,
      created_by_name: req.user.name || 'BDRRMC Admin',
      created_at: new Date().toISOString()
    };
    IN_MEMORY_ALERTS.unshift(newAlert);
    emitAlertBroadcast(newAlert);
    return res.status(201).json({ message: 'Alert broadcast (Demo Mode)', alert: newAlert });
  }
}

async function getAlerts(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT a.*, u.name AS created_by_name
       FROM alerts a JOIN users u ON a.created_by = u.id
       ORDER BY a.created_at DESC LIMIT 50`
    );
    return res.json({ alerts: rows });
  } catch (err) {
    console.warn('Database error on getAlerts, returning demo alerts:', err.message);
    return res.json({ alerts: IN_MEMORY_ALERTS });
  }
}

module.exports = { createAlert, getAlerts };
