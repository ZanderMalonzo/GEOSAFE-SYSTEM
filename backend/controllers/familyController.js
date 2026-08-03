const crypto = require('crypto');
const { validationResult } = require('express-validator');
const pool = require('../models/db');
const { emitFamilyUpdate } = require('../socket');

const SAFETY_STATUSES = ['safe', 'need_help', 'injured', 'no_response'];

function generateInviteCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

async function getUserFamilyRow(userId) {
  const [rows] = await pool.query(
    'SELECT id, family_group_id, is_family_head, role FROM users WHERE id = ?',
    [userId]
  );
  return rows[0] || null;
}

function formatMember(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    relationship: row.family_relationship || 'Member',
    safety_status: row.safety_status,
    is_family_head: !!row.is_family_head,
    last_latitude: row.last_latitude,
    last_longitude: row.last_longitude,
    last_location_at: row.last_location_at,
    battery_level: row.battery_level,
  };
}

async function getFamilyGroup(groupId) {
  const [rows] = await pool.query('SELECT * FROM family_groups WHERE id = ?', [groupId]);
  return rows[0] || null;
}

async function getMembers(groupId) {
  const [rows] = await pool.query(
    `SELECT id, name, email, family_relationship, safety_status, is_family_head,
            last_latitude, last_longitude, last_location_at, battery_level
     FROM users WHERE family_group_id = ? ORDER BY is_family_head DESC, name`,
    [groupId]
  );
  return rows.map(formatMember);
}

async function buildDashboard(user) {
  if (!user.family_group_id) {
    return { family: null, members: [], is_head: false };
  }
  const group = await getFamilyGroup(user.family_group_id);
  const members = await getMembers(user.family_group_id);
  return {
    family: group
      ? {
          id: group.id,
          name: group.name,
          description: group.description,
          invite_code: group.invite_code,
        }
      : null,
    members,
    is_head: !!user.is_family_head,
  };
}

async function createFamily(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, description } = req.body;
  const user = await getUserFamilyRow(req.user.id);

  if (!user || user.role !== 'resident') {
    return res.status(403).json({ error: 'Only residents can create a family group' });
  }
  if (user.family_group_id) {
    return res.status(400).json({ error: 'You already belong to a family group' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const inviteCode = generateInviteCode();
    const [groupResult] = await connection.query(
      'INSERT INTO family_groups (name, description, invite_code, head_user_id) VALUES (?, ?, ?, ?)',
      [name, description || null, inviteCode, req.user.id]
    );
    const groupId = groupResult.insertId;

    await connection.query(
      `UPDATE users SET family_group_id = ?, is_family_head = 1, family_relationship = 'Head'
       WHERE id = ?`,
      [groupId, req.user.id]
    );

    await connection.commit();
    const dashboard = await buildDashboard({
      family_group_id: groupId,
      is_family_head: 1,
    });
    emitFamilyUpdate(groupId, dashboard);
    res.status(201).json({ message: 'Family group created', ...dashboard });
  } catch (err) {
    await connection.rollback();
    console.error('Create family error:', err);
    res.status(500).json({ error: 'Failed to create family group' });
  } finally {
    connection.release();
  }
}

async function getFamily(req, res) {
  try {
    const user = await getUserFamilyRow(req.user.id);
    if (!user || user.role !== 'resident') {
      return res.status(403).json({ error: 'Only residents can access family tracker' });
    }
    const full = await pool.query(
      'SELECT family_group_id, is_family_head FROM users WHERE id = ?',
      [req.user.id]
    );
    const dashboard = await buildDashboard(full[0][0] || user);
    res.json(dashboard);
  } catch (err) {
    console.error('Get family error:', err);
    res.status(500).json({ error: 'Failed to load family' });
  }
}

async function joinFamily(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { invite_code, relationship } = req.body;
  const user = await getUserFamilyRow(req.user.id);

  if (!user || user.role !== 'resident') {
    return res.status(403).json({ error: 'Only residents can join a family group' });
  }
  if (user.family_group_id) {
    return res.status(400).json({ error: 'You already belong to a family group. Leave first to join another.' });
  }

  const [groups] = await pool.query(
    'SELECT id FROM family_groups WHERE invite_code = ?',
    [invite_code.trim().toUpperCase()]
  );
  if (!groups.length) {
    return res.status(404).json({ error: 'Invalid invite code' });
  }

  const groupId = groups[0].id;
  await pool.query(
    `UPDATE users SET family_group_id = ?, is_family_head = 0, family_relationship = ?
     WHERE id = ?`,
    [groupId, relationship || 'Member', req.user.id]
  );

  const dashboard = await buildDashboard({ family_group_id: groupId, is_family_head: 0 });
  emitFamilyUpdate(groupId, dashboard);
  res.json({ message: 'Joined family group', ...dashboard });
}

async function leaveFamily(req, res) {
  const user = await getUserFamilyRow(req.user.id);

  if (!user?.family_group_id) {
    return res.status(400).json({ error: 'You are not in a family group' });
  }

  const groupId = user.family_group_id;

  if (user.is_family_head) {
    const [members] = await pool.query(
      'SELECT COUNT(*) AS cnt FROM users WHERE family_group_id = ?',
      [groupId]
    );
    if (members[0].cnt > 1) {
      return res.status(400).json({
        error: 'Transfer family head ownership before leaving',
      });
    }
    await pool.query(
      `UPDATE users SET family_group_id = NULL, is_family_head = 0, family_relationship = 'Member'
       WHERE id = ?`,
      [req.user.id]
    );
    await pool.query('DELETE FROM family_groups WHERE id = ?', [groupId]);
  } else {
    await pool.query(
      `UPDATE users SET family_group_id = NULL, is_family_head = 0, family_relationship = 'Member'
       WHERE id = ?`,
      [req.user.id]
    );
  }

  emitFamilyUpdate(groupId, { left: true, user_id: req.user.id });
  res.json({ message: 'Left family group' });
}

async function removeMember(req, res) {
  const memberId = parseInt(req.params.userId, 10);
  const head = await getUserFamilyRow(req.user.id);

  if (!head?.is_family_head || !head.family_group_id) {
    return res.status(403).json({ error: 'Only the family head can remove members' });
  }
  if (memberId === req.user.id) {
    return res.status(400).json({ error: 'Cannot remove yourself. Transfer head or leave the group.' });
  }

  const [target] = await pool.query(
    'SELECT id, family_group_id FROM users WHERE id = ?',
    [memberId]
  );
  if (!target.length || target[0].family_group_id !== head.family_group_id) {
    return res.status(404).json({ error: 'Member not found in your family' });
  }

  await pool.query(
    `UPDATE users SET family_group_id = NULL, is_family_head = 0, family_relationship = 'Member'
     WHERE id = ?`,
    [memberId]
  );

  const dashboard = await buildDashboard(head);
  emitFamilyUpdate(head.family_group_id, dashboard);
  res.json({ message: 'Member removed', ...dashboard });
}

async function updateSettings(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const head = await getUserFamilyRow(req.user.id);
  if (!head?.family_group_id || !head.is_family_head) {
    return res.status(403).json({ error: 'Only the family head can update group settings' });
  }

  const { name, description } = req.body;
  await pool.query('UPDATE family_groups SET name = ?, description = ? WHERE id = ?', [
    name,
    description || null,
    head.family_group_id,
  ]);

  const dashboard = await buildDashboard(head);
  emitFamilyUpdate(head.family_group_id, dashboard);
  res.json({ message: 'Settings updated', ...dashboard });
}

async function transferHead(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { new_head_user_id } = req.body;
  const current = await getUserFamilyRow(req.user.id);

  if (!current?.is_family_head) {
    return res.status(403).json({ error: 'Only the family head can transfer ownership' });
  }

  const [member] = await pool.query(
    'SELECT id FROM users WHERE id = ? AND family_group_id = ?',
    [new_head_user_id, current.family_group_id]
  );
  if (!member.length) {
    return res.status(404).json({ error: 'User is not a member of your family group' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('UPDATE users SET is_family_head = 0 WHERE family_group_id = ?', [
      current.family_group_id,
    ]);
    await connection.query(
      `UPDATE users SET is_family_head = 1, family_relationship = 'Head' WHERE id = ?`,
      [new_head_user_id]
    );
    await connection.query('UPDATE family_groups SET head_user_id = ? WHERE id = ?', [
      new_head_user_id,
      current.family_group_id,
    ]);
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  const dashboard = await buildDashboard({
    family_group_id: current.family_group_id,
    is_family_head: 0,
  });
  emitFamilyUpdate(current.family_group_id, dashboard);
  res.json({ message: 'Family head transferred', ...dashboard });
}

async function regenerateInvite(req, res) {
  const head = await getUserFamilyRow(req.user.id);
  if (!head?.is_family_head) {
    return res.status(403).json({ error: 'Only the family head can regenerate invite code' });
  }

  const code = generateInviteCode();
  await pool.query('UPDATE family_groups SET invite_code = ? WHERE id = ?', [
    code,
    head.family_group_id,
  ]);

  res.json({ invite_code: code });
}

async function updateMyProfile(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const user = await getUserFamilyRow(req.user.id);
  if (!user?.family_group_id) {
    return res.status(400).json({ error: 'Join a family group first' });
  }

  const { safety_status, relationship, latitude, longitude, battery_level } = req.body;
  const updates = [];
  const params = [];

  if (safety_status !== undefined) {
    if (!SAFETY_STATUSES.includes(safety_status)) {
      return res.status(400).json({ error: 'Invalid safety status' });
    }
    updates.push('safety_status = ?');
    params.push(safety_status);
  }
  if (relationship !== undefined) {
    updates.push('family_relationship = ?');
    params.push(relationship);
  }
  if (latitude !== undefined && longitude !== undefined) {
    updates.push('last_latitude = ?', 'last_longitude = ?', 'last_location_at = NOW()');
    params.push(latitude, longitude);
  }
  if (battery_level !== undefined) {
    updates.push('battery_level = ?');
    params.push(battery_level);
  }

  if (!updates.length) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  params.push(req.user.id);
  await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

  const dashboard = await buildDashboard(user);
  emitFamilyUpdate(user.family_group_id, dashboard);
  res.json({ message: 'Profile updated', ...dashboard });
}

module.exports = {
  createFamily,
  getFamily,
  joinFamily,
  leaveFamily,
  removeMember,
  updateSettings,
  transferHead,
  regenerateInvite,
  updateMyProfile,
};
