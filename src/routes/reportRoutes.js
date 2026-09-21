const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authMiddleware: protect, authorizeRoles: authorize } = require('../middlewares/authMiddleware');

router.get(
  '/retribution',
  protect,
  authorize('Admin', 'Super Admin', 'Dinas', 'Kepala Dinas', 'dinas', 'kepala dinas'),
  reportController.getRetributionReport
);

module.exports = router;
