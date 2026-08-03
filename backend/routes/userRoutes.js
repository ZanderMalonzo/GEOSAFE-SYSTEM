const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { getUsers } = require('../controllers/userController');

const router = express.Router();

router.use(authenticate, requireRole('admin'));
router.get('/', getUsers);

module.exports = router;
