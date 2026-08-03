require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcrypt');
const pool = require('../models/db');

const SEED_USERS = [
  { name: 'System Admin', email: 'admin@geosafe.local', password: 'admin123', role: 'admin' },
  { name: 'Emergency Responder', email: 'responder@geosafe.local', password: 'responder123', role: 'responder' },
];

async function seed() {
  console.log('Seeding default users...');
  for (const u of SEED_USERS) {
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [u.email]);
    const hash = await bcrypt.hash(u.password, 10);
    if (existing.length) {
      await pool.query('UPDATE users SET password_hash = ?, name = ?, role = ? WHERE email = ?', [
        hash,
        u.name,
        u.role,
        u.email,
      ]);
      console.log(`  Updated: ${u.email}`);
    } else {
      await pool.query(
        'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
        [u.name, u.email, hash, u.role]
      );
      console.log(`  Created: ${u.email}`);
    }
  }
  console.log('Done.');
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
