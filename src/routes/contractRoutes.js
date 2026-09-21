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

// Admin, Dinas & Eksekutif (Kepala Dinas) Routes
router.get('/', authMiddleware, authorizeRoles('Admin', 'Superadmin', 'Dinas', 'Kepala Dinas'), contractController.getAllContracts);
router.get('/:id', authMiddleware, authorizeRoles('Admin', 'Superadmin', 'Dinas', 'Kepala Dinas'), contractController.getContractById);
router.put('/:id', authMiddleware, authorizeRoles('Admin', 'Superadmin', 'Dinas', 'Kepala Dinas'), contractController.updateContract);
router.patch('/:id/approve-kadis', authMiddleware, authorizeRoles('Admin', 'Superadmin', 'Dinas', 'Kepala Dinas'), contractController.approveByKadis);
router.patch('/:id/reject-kadis', authMiddleware, authorizeRoles('Admin', 'Superadmin', 'Dinas', 'Kepala Dinas'), contractController.rejectByKadis);
router.put('/:id/verify', authMiddleware, authorizeRoles('Admin', 'Superadmin', 'Dinas', 'Kepala Dinas'), contractController.verifyContract);
router.put('/:id/terminate', authMiddleware, authorizeRoles('Admin', 'Superadmin', 'Dinas', 'Kepala Dinas'), contractController.terminateContract);

module.exports = router;
