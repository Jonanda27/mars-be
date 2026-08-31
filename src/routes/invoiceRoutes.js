const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');
const { authMiddleware: protect, authorizeRoles: authorize } = require('../middlewares/authMiddleware');

router.get('/', protect, authorize('Admin', 'Super Admin'), invoiceController.getAllInvoices);
router.get('/tenant', protect, authorize('Tenant'), invoiceController.getTenantInvoices);
router.get('/:id', protect, invoiceController.getInvoiceById);
router.put('/:id/pay', protect, authorize('Tenant'), invoiceController.payInvoice);

module.exports = router;
