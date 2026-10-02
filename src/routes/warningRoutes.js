const express = require('express');
const router = express.Router();
const warningController = require('../controllers/warningController');
const { authMiddleware, authorizeRoles } = require('../middlewares/authMiddleware');

// Get all warnings (admin only)
router.get('/', authMiddleware, authorizeRoles('admin', 'admin_mini_airport', 'superadmin', 'dinas'), warningController.getAllWarnings);

// Get warnings for the logged in tenant
router.get('/tenant', authMiddleware, warningController.getTenantWarnings);

// Send warning letter email manually by Dinas / Admin
router.post('/:id/send-email', authMiddleware, authorizeRoles('admin', 'admin_mini_airport', 'superadmin', 'dinas'), warningController.sendWarningEmail);

module.exports = router;
