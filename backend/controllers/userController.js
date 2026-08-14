const pool = require('../models/db');

const DEMO_USERS_LIST = [
  { id: 1, name: 'BDRRMC Admin Lead', email: 'admin@geosafe.local', role: 'admin' },
  { id: 2, name: 'Responder Unit 1 (Ambulance)', email: 'responder@geosafe.local', role: 'responder' },
  { id: 3, name: 'Rescue Boat Unit 3 (Bayanan Creek)', email: 'boat@geosafe.local', role: 'responder' },
  { id: 4, name: 'Juan Dela Cruz', email: 'resident@geosafe.local', role: 'resident' }
];

async function getUsers(req, res) {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, email, role, created_at FROM users ORDER BY role, name'
    );
    return res.json({ users: rows });
  } catch (err) {
    console.warn('Database error in getUsers, returning demo user list:', err.message);
    return res.json({ users: DEMO_USERS_LIST });
  }
}

module.exports = { getUsers };
