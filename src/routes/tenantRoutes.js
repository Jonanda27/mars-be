const express = require('express');
const router = express.Router();
const tenantController = require('../controllers/tenantController');
const upload = require('../middlewares/upload');
const { authMiddleware, authorizeRoles } = require('../middlewares/authMiddleware');

router.use(authMiddleware);

router.get('/', authorizeRoles('admin', 'superadmin', 'dinas', 'kepala dinas', 'petugas', 'petugas lapangan', 'warden'), tenantController.getTenants);
router.get('/:id', tenantController.getTenant);
router.post('/', authorizeRoles('admin', 'superadmin', 'dinas'), tenantController.createTenant);
router.put('/:id/profile', tenantController.updateProfile);
router.put('/:id/verify', authorizeRoles('admin', 'superadmin', 'dinas', 'kepala dinas'), tenantController.verifyTenant);
router.post('/:id/legalitas', upload.single('file'), tenantController.uploadLegalitas);

module.exports = router;
