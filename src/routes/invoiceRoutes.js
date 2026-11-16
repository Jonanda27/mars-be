const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');
const { authMiddleware: protect, authorizeRoles: authorize } = require('../middlewares/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../../public/uploads/receipts');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'receipt-' + uniqueSuffix + ext);
  }
});
const upload = multer({ storage: storage });

router.get('/', protect, authorize('Admin', 'Super Admin', 'Dinas', 'Kepala Dinas'), invoiceController.getAllInvoices);
router.get('/tenant', protect, authorize('Tenant'), invoiceController.getTenantInvoices);
router.get('/unbilled-hanggar', protect, authorize('Admin', 'Super Admin', 'Dinas', 'Warden'), invoiceController.getUnbilledHanggarLogs);
router.post('/generate-hanggar-checkout', protect, authorize('Admin', 'Super Admin', 'Dinas', 'Warden'), invoiceController.generateHanggarCheckoutInvoice);
router.post('/generate-hanggar-periodic', protect, authorize('Admin', 'Super Admin', 'Dinas'), invoiceController.generateHanggarPeriodicInvoice);
router.get('/:id', protect, invoiceController.getInvoiceById);
router.post('/generate-skrd/:contractId', protect, authorize('Admin', 'Super Admin', 'Dinas'), invoiceController.generateSkrd);
router.post('/generate-skrd-overstay/:logId', protect, authorize('Admin', 'Super Admin', 'Dinas'), invoiceController.generateOverstaySkrd);
router.post('/:id/upload-receipt', protect, authorize('Tenant'), upload.single('receipt'), invoiceController.uploadReceipt);
router.post('/:id/verify', protect, authorize('Admin', 'Super Admin', 'Dinas', 'Kepala Dinas'), invoiceController.verifyPayment);
router.post('/:id/generate-penalty', protect, authorize('Admin', 'Super Admin', 'Dinas', 'Kepala Dinas', 'dinas', 'kepala dinas'), invoiceController.generatePenaltyInvoice);
router.post('/:id/cancel', protect, authorize('Admin', 'Super Admin', 'Dinas', 'Kepala Dinas', 'dinas', 'kepala dinas'), invoiceController.cancelInvoice);
router.post('/:id/reissue', protect, authorize('Admin', 'Super Admin', 'Dinas', 'Kepala Dinas', 'dinas', 'kepala dinas'), invoiceController.reissueInvoice);

module.exports = router;


