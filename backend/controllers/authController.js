const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const pool = require('../models/db');

const JWT_SECRET = process.env.JWT_SECRET || 'geosafe_super_secret_jwt_key_2026';
const VALID_ROLES = ['resident', 'admin', 'responder'];

// Fallback Demo Users (Used when cloud database is unavailable)
const DEMO_USERS = [
  {
    id: 1,
    name: 'BDRRMC Admin Lead',
    email: 'admin@geosafe.local',
    password: 'admin123',
    role: 'admin'
  },
  {
    id: 2,
    name: 'Responder Unit 1 (Ambulance)',
    email: 'responder@geosafe.local',
    password: 'responder123',
    role: 'responder'
  },
  {
    id: 3,
    name: 'Juan Dela Cruz',
    email: 'resident@geosafe.local',
    password: 'resident123',
    role: 'resident'
  }
];

async function register(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, email, password, role } = req.body;
  const userRole = role && VALID_ROLES.includes(role) ? role : 'resident';

  if (userRole !== 'resident') {
    return res.status(400).json({ error: 'Only resident accounts can self-register' });
  }

  try {
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, password_hash, userRole]
    );

    const user = { id: result.insertId, name, email, role: userRole };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '24h' });

    return res.status(201).json({ message: 'Registration successful', token, user });
  } catch (err) {
    console.warn('Database error on register, using demo fallback:', err.message);
    // Fallback registration in demo mode
    const user = { id: Math.floor(Math.random() * 1000) + 10, name, email, role: userRole };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '24h' });
    return res.status(201).json({ message: 'Registration successful (Demo Mode)', token, user });
  }
}

async function login(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    const [rows] = await pool.query(
      'SELECT id, name, email, password_hash, role FROM users WHERE email = ?',
      [email]
    );

    if (rows && rows.length) {
      const user = rows[0];
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const payload = { id: user.id, name: user.name, email: user.email, role: user.role };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
      return res.json({ message: 'Login successful', token, user: payload });
    }
  } catch (dbErr) {
    console.warn('Database connection failed, checking demo credentials:', dbErr.message);
  }

  // Fallback to demo accounts if DB is offline or user exists in demo set
  const demoMatch = DEMO_USERS.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
  if (demoMatch) {
    const payload = { id: demoMatch.id, name: demoMatch.name, email: demoMatch.email, role: demoMatch.role };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
    return res.json({ message: 'Login successful', token, user: payload });
  }

  return res.status(401).json({ error: 'Invalid email or password' });
}

module.exports = { register, login };
