const express = require('express');
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const {
  createReport,
  getReports,
  getReportById,
  updateReportStatus,
} = require('../controllers/reportController');

const router = express.Router();

router.use(authenticate);

router.post(
  '/',
  requireRole('resident'),
  [
    body('incident_type').trim().isLength({ min: 2, max: 100 }),
    body('description').trim().isLength({ min: 10, max: 2000 }),
    body('latitude').isFloat({ min: -90, max: 90 }),
    body('longitude').isFloat({ min: -180, max: 180 }),
  ],
  createReport
);

router.get('/', getReports);

router.get('/:id', getReportById);

router.put(
  '/:id/status',
  requireRole('admin', 'responder'),
  [
    body('status').optional().isIn(['pending', 'verified', 'responding', 'on_site', 'resolved']),
    body('severity').optional().isIn(['low', 'medium', 'high']),
    body('assigned_to').optional().isInt({ min: 1 }),
  ],
  updateReportStatus
);

module.exports = router;
