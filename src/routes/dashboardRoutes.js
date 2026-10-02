const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authMiddleware, authorizeRoles } = require('../middlewares/authMiddleware');

router.get('/admin', authMiddleware, authorizeRoles('admin', 'admin_mini_airport', 'superadmin', 'dinas', 'kepala dinas'), dashboardController.getAdminDashboardStats);
router.get('/dinas', authMiddleware, authorizeRoles('admin', 'admin_mini_airport', 'superadmin', 'dinas', 'kepala dinas'), dashboardController.getDinasDashboardStats);

module.exports = router;
