const express = require('express');
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const {
  createFamily,
  getFamily,
  joinFamily,
  leaveFamily,
  addMember,
  removeMember,
  updateSettings,
  transferHead,
  regenerateInvite,
  updateMyProfile,
} = require('../controllers/familyController');

const router = express.Router();

router.use(authenticate, requireRole('resident'));

router.get('/', getFamily);

router.post(
  '/',
  [
    body('name').trim().isLength({ min: 2, max: 100 }),
    body('description').optional().trim().isLength({ max: 500 }),
  ],
  createFamily
);

router.post(
  '/join',
  [
    body('invite_code').trim().isLength({ min: 4, max: 12 }),
    body('relationship').optional().trim().isLength({ max: 50 }),
  ],
  joinFamily
);

router.post('/leave', leaveFamily);

router.put(
  '/settings',
  [
    body('name').trim().isLength({ min: 2, max: 100 }),
    body('description').optional().trim().isLength({ max: 500 }),
  ],
  updateSettings
);

router.put(
  '/transfer-head',
  [body('new_head_user_id').isInt({ min: 1 })],
  transferHead
);

router.post('/regenerate-invite', regenerateInvite);

router.put(
  '/me',
  [
    body('safety_status').optional().isIn(['safe', 'need_help', 'injured', 'no_response']),
    body('relationship').optional().trim().isLength({ max: 50 }),
    body('latitude').optional().isFloat({ min: -90, max: 90 }),
    body('longitude').optional().isFloat({ min: -180, max: 180 }),
    body('battery_level').optional().isInt({ min: 0, max: 100 }),
  ],
  updateMyProfile
);

router.post('/members', addMember);
router.delete('/members/:userId', removeMember);

module.exports = router;
