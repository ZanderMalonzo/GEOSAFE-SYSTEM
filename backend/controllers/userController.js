const pool = require('../models/db');

async function getUsers(req, res) {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, email, role, created_at FROM users ORDER BY role, name'
    );
    res.json({ users: rows });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
}

module.exports = { getUsers };
