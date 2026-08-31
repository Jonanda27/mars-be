const express = require('express');
const router = express.Router();
const warningController = require('../controllers/warningController');
const { authMiddleware, authorizeRoles } = require('../middlewares/authMiddleware');

// Get all warnings (admin only)
router.get('/', authMiddleware, authorizeRoles('Admin', 'Dinas'), warningController.getAllWarnings);

// Get warnings for the logged in tenant
router.get('/tenant', authMiddleware, warningController.getTenantWarnings);

module.exports = router;
