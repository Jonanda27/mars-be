const express = require('express');
const router = express.Router();
const rentalController = require('../controllers/rentalController');
const { authMiddleware, authorizeRoles } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/upload');

router.post('/', authMiddleware, authorizeRoles('Tenant'), upload.single('official_letter'), rentalController.createRentalApplication);
router.get('/tenant', authMiddleware, authorizeRoles('Tenant'), rentalController.getTenantApplications);

router.get('/admin', authMiddleware, authorizeRoles('Admin', 'Kepala Dinas', 'Dinas'), rentalController.getAllApplications);
router.get('/approved', authMiddleware, rentalController.getApprovedApplications);
router.get('/:id', authMiddleware, rentalController.getApplicationById);
router.put('/:id/status', authMiddleware, authorizeRoles('Admin', 'Dinas', 'Kepala Dinas'), rentalController.updateApplicationStatus);
router.patch('/:id/verify-letter', authMiddleware, authorizeRoles('Kepala Dinas', 'Admin', 'Dinas'), rentalController.verifyLetter);
router.patch('/:id/complete-details', authMiddleware, authorizeRoles('Tenant'), rentalController.completeDetails);
router.patch('/:id/approve-kadis', authMiddleware, authorizeRoles('Kepala Dinas', 'Admin'), rentalController.approveByKadis);
router.post('/:id/upload-signature', authMiddleware, upload.single('signature_file'), rentalController.uploadSignature);
router.post('/:id/upload-payung-signature', authMiddleware, authorizeRoles('Tenant'), upload.single('signature_file'), rentalController.uploadPayungSignature);
router.post('/:id/upload-letter', authMiddleware, authorizeRoles('Tenant'), upload.single('official_letter'), rentalController.uploadOfficialLetter);

module.exports = router;
