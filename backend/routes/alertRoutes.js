const express = require('express');
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { createAlert, getAlerts } = require('../controllers/alertController');

const router = express.Router();

router.use(authenticate);

router.post(
  '/',
  requireRole('admin'),
  [
    body('message').trim().isLength({ min: 5, max: 1000 }),
    body('severity').isIn(['low', 'medium', 'high']),
  ],
  createAlert
);

router.get('/', getAlerts);

module.exports = router;
