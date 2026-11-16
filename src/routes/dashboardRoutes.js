const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authMiddleware, authorizeRoles } = require('../middlewares/authMiddleware');

router.get('/admin', authMiddleware, authorizeRoles('Admin', 'Superadmin', 'Dinas', 'Kepala Dinas'), dashboardController.getAdminDashboardStats);
router.get('/dinas', authMiddleware, authorizeRoles('Admin', 'Superadmin', 'Dinas', 'Kepala Dinas'), dashboardController.getDinasDashboardStats);

module.exports = router;
