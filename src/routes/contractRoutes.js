const express = require('express');
const router = express.Router();
const contractController = require('../controllers/contractController');
const { authMiddleware, authorizeRoles } = require('../middlewares/authMiddleware');

const upload = require('../middlewares/upload');

// Tenant Routes
router.get('/tenant', authMiddleware, authorizeRoles('Tenant'), contractController.getTenantContracts);
router.get('/tenant/:id', authMiddleware, authorizeRoles('Tenant'), contractController.getTenantContractById);
router.put('/tenant/:id/status', authMiddleware, authorizeRoles('Tenant'), contractController.updateContractStatusByTenant);
router.post('/tenant/:id/extend', authMiddleware, authorizeRoles('Tenant'), contractController.extendContract);
router.post('/tenant/:id/upload-signature', authMiddleware, authorizeRoles('Tenant'), upload.single('signature_file'), contractController.uploadSignature);

// Admin Routes
router.get('/', authMiddleware, authorizeRoles('Admin'), contractController.getAllContracts);
router.get('/:id', authMiddleware, authorizeRoles('Admin'), contractController.getContractById);
router.put('/:id', authMiddleware, authorizeRoles('Admin'), contractController.updateContract);
router.put('/:id/verify', authMiddleware, authorizeRoles('Admin'), contractController.verifyContract);
router.put('/:id/terminate', authMiddleware, authorizeRoles('Admin'), contractController.terminateContract);

module.exports = router;
