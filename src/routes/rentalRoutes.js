const express = require('express');
const router = express.Router();
const rentalController = require('../controllers/rentalController');
const { authMiddleware, authorizeRoles } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/upload');

router.post('/', authMiddleware, authorizeRoles('tenant'), upload.single('official_letter'), rentalController.createRentalApplication);
router.get('/tenant', authMiddleware, authorizeRoles('tenant'), rentalController.getTenantApplications);

router.get('/admin', authMiddleware, authorizeRoles('admin', 'admin_mini_airport', 'superadmin', 'kepala dinas', 'dinas'), rentalController.getAllApplications);
router.get('/approved', authMiddleware, rentalController.getApprovedApplications);

// Stand Apron Availability for Mini Airport (placed before /:id)
router.get('/mini-airport/stand-availability', authMiddleware, rentalController.getMiniAirportStandAvailability);

// Lease Extension Routes (placed before /:id)
router.get('/extensions/pending', authMiddleware, authorizeRoles('admin', 'admin_mini_airport', 'superadmin', 'kepala dinas', 'dinas'), rentalController.getPendingExtensions);
router.get('/assets-availability', authMiddleware, rentalController.getAssetAvailabilityForExtension);
router.post('/:id/request-extension', authMiddleware, authorizeRoles('tenant', 'admin'), rentalController.requestExtension);
router.post('/:id/review-extension', authMiddleware, authorizeRoles('admin', 'kepala dinas'), rentalController.reviewExtension);

router.get('/:id', authMiddleware, rentalController.getApplicationById);
router.put('/:id/status', authMiddleware, authorizeRoles('admin', 'admin_mini_airport', 'superadmin', 'dinas', 'kepala dinas'), rentalController.updateApplicationStatus);
router.patch('/:id/verify-letter', authMiddleware, authorizeRoles('kepala dinas', 'admin', 'admin_mini_airport', 'superadmin', 'dinas'), rentalController.verifyLetter);
router.patch('/:id/complete-details', authMiddleware, authorizeRoles('tenant'), rentalController.completeDetails);
router.patch('/:id/approve-kadis', authMiddleware, authorizeRoles('kepala dinas', 'admin', 'superadmin'), rentalController.approveByKadis);
router.post('/:id/upload-signature', authMiddleware, upload.single('signature_file'), rentalController.uploadSignature);
router.post('/:id/upload-payung-signature', authMiddleware, authorizeRoles('tenant'), upload.single('signature_file'), rentalController.uploadPayungSignature);
router.post('/:id/upload-letter', authMiddleware, authorizeRoles('tenant'), upload.single('official_letter'), rentalController.uploadOfficialLetter);

module.exports = router;
