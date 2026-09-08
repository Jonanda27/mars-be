const express = require('express');
const router = express.Router();
const rentalController = require('../controllers/rentalController');
const { authMiddleware, authorizeRoles } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/upload');

router.post('/', authMiddleware, authorizeRoles('Tenant'), rentalController.createRentalApplication);
router.get('/tenant', authMiddleware, authorizeRoles('Tenant'), rentalController.getTenantApplications);

router.get('/admin', authMiddleware, authorizeRoles('Admin'), rentalController.getAllApplications);
router.get('/approved', authMiddleware, rentalController.getApprovedApplications);
router.get('/:id', authMiddleware, rentalController.getApplicationById);
router.put('/:id/status', authMiddleware, authorizeRoles('Admin'), rentalController.updateApplicationStatus);
router.post('/:id/upload-signature', authMiddleware, upload.single('signature_file'), rentalController.uploadSignature);

module.exports = router;
