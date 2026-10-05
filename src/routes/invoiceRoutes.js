const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');
const { authMiddleware: protect, authorizeRoles: authorize } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/upload');

router.get('/', protect, authorize('admin', 'admin_mini_airport', 'superadmin', 'dinas', 'kepala dinas'), invoiceController.getAllInvoices);
router.get('/tenant', protect, authorize('tenant'), invoiceController.getTenantInvoices);
router.get('/unbilled-hanggar', protect, authorize('admin', 'superadmin', 'dinas', 'petugas'), invoiceController.getUnbilledHanggarLogs);
router.post('/generate-hanggar-checkout', protect, authorize('admin', 'superadmin', 'dinas', 'petugas'), invoiceController.generateHanggarCheckoutInvoice);
router.post('/generate-hanggar-periodic', protect, authorize('admin', 'superadmin', 'dinas'), invoiceController.generateHanggarPeriodicInvoice);

// Mini Airport SKRD Routes
router.post('/generate-mini-airport-skrd/:logId', protect, authorize('admin', 'admin_mini_airport', 'superadmin', 'dinas', 'kepala dinas'), invoiceController.generateMiniAirportSkrd);

// Public Routes for Landing Page & Emergency Payment
router.get('/public/check', invoiceController.checkPublicInvoice);
router.get('/emergency-payment/:token', invoiceController.getEmergencyInvoiceByToken);
router.post('/emergency-payment/:token/upload', upload.single('receipt'), invoiceController.uploadEmergencyPaymentReceipt);

router.get('/:id', protect, invoiceController.getInvoiceById);
router.post('/generate-skrd/:contractId', protect, authorize('admin', 'admin_mini_airport', 'superadmin', 'dinas'), invoiceController.generateSkrd);
router.post('/generate-skrd-overstay/:logId', protect, authorize('admin', 'admin_mini_airport', 'superadmin', 'dinas'), invoiceController.generateOverstaySkrd);
router.post('/:id/upload-receipt', protect, authorize('tenant'), upload.single('receipt'), invoiceController.uploadReceipt);
router.post('/:id/verify', protect, authorize('admin', 'admin_mini_airport', 'superadmin', 'dinas', 'kepala dinas'), invoiceController.verifyPayment);
router.post('/:id/generate-penalty', protect, authorize('admin', 'admin_mini_airport', 'superadmin', 'dinas', 'kepala dinas'), invoiceController.generatePenaltyInvoice);
router.post('/:id/cancel', protect, authorize('admin', 'admin_mini_airport', 'superadmin', 'dinas', 'kepala dinas'), invoiceController.cancelInvoice);
router.post('/:id/reissue', protect, authorize('admin', 'admin_mini_airport', 'superadmin', 'dinas', 'kepala dinas'), invoiceController.reissueInvoice);

module.exports = router;
