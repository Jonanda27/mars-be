const express = require('express');
const router = express.Router();
const contractController = require('../controllers/contractController');
const { authMiddleware, authorizeRoles } = require('../middlewares/authMiddleware');

const upload = require('../middlewares/upload');

// Tenant Routes
router.get('/tenant', authMiddleware, authorizeRoles('tenant'), contractController.getTenantContracts);
router.get('/tenant/:id', authMiddleware, authorizeRoles('tenant'), contractController.getTenantContractById);
router.put('/tenant/:id/status', authMiddleware, authorizeRoles('tenant'), contractController.updateContractStatusByTenant);
router.post('/tenant/:id/extend', authMiddleware, authorizeRoles('tenant'), contractController.extendContract);
router.post('/tenant/:id/upload-signature', authMiddleware, authorizeRoles('tenant'), upload.single('signature_file'), contractController.uploadSignature);

// Emergency Contracts (PKS Pendaratan Darurat)
router.get('/emergency-active', authMiddleware, authorizeRoles('petugas', 'petugas_mini_airport', 'admin', 'admin_mini_airport', 'superadmin', 'dinas', 'kepala dinas'), contractController.getEmergencyActiveContracts);
router.post('/emergency', authMiddleware, authorizeRoles('admin', 'admin_mini_airport', 'superadmin', 'dinas', 'kepala dinas'), contractController.createEmergencyContract);

// Admin, Dinas & Eksekutif (Kepala Dinas) Routes
router.get('/', authMiddleware, authorizeRoles('admin', 'admin_mini_airport', 'superadmin', 'dinas', 'kepala dinas'), contractController.getAllContracts);
router.get('/:id', authMiddleware, authorizeRoles('admin', 'admin_mini_airport', 'superadmin', 'dinas', 'kepala dinas'), contractController.getContractById);
router.put('/:id', authMiddleware, authorizeRoles('admin', 'admin_mini_airport', 'superadmin', 'dinas', 'kepala dinas'), contractController.updateContract);
router.patch('/:id/approve-kadis', authMiddleware, authorizeRoles('admin', 'admin_mini_airport', 'superadmin', 'dinas', 'kepala dinas'), contractController.approveByKadis);
router.patch('/:id/reject-kadis', authMiddleware, authorizeRoles('admin', 'admin_mini_airport', 'superadmin', 'dinas', 'kepala dinas'), contractController.rejectByKadis);
router.put('/:id/verify', authMiddleware, authorizeRoles('admin', 'admin_mini_airport', 'superadmin', 'dinas', 'kepala dinas'), contractController.verifyContract);
router.put('/:id/terminate', authMiddleware, authorizeRoles('admin', 'admin_mini_airport', 'superadmin', 'dinas', 'kepala dinas'), contractController.terminateContract);

module.exports = router;
