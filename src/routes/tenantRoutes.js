const express = require('express');
const router = express.Router();
const tenantController = require('../controllers/tenantController');
const upload = require('../middlewares/upload');
const { authMiddleware, authorizeRoles } = require('../middlewares/authMiddleware');

router.use(authMiddleware);

router.get('/', authorizeRoles('admin', 'superadmin'), tenantController.getTenants);
router.get('/:id', tenantController.getTenant);
router.post('/', authorizeRoles('admin', 'superadmin'), tenantController.createTenant);
router.put('/:id/verify', authorizeRoles('superadmin'), tenantController.verifyTenant);
router.post('/:id/legalitas', upload.single('file'), tenantController.uploadLegalitas);

module.exports = router;
