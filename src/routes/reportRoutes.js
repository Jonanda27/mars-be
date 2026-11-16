const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authMiddleware: protect, authorizeRoles: authorize } = require('../middlewares/authMiddleware');

router.get(
  '/retribution',
  protect,
  authorize('admin', 'admin_mini_airport', 'superadmin', 'dinas', 'kepala dinas'),
  reportController.getRetributionReport
);

module.exports = router;
