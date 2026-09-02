const invoiceService = require('../services/invoiceService');
const tenantService = require('../services/tenantService');

exports.getAllInvoices = async (req, res, next) => {
  try {
    const invoices = await invoiceService.getAllInvoices();
    res.json({ success: true, data: invoices });
  } catch (error) {
    next(error);
  }
};

exports.getTenantInvoices = async (req, res, next) => {
  try {
    const tenant = await tenantService.getTenantByUserId(req.user.id);
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

    const invoices = await invoiceService.getTenantInvoices(tenant.id);
    res.json({ success: true, data: invoices });
  } catch (error) {
    next(error);
  }
};

exports.getInvoiceById = async (req, res, next) => {
  try {
    const invoice = await invoiceService.getInvoiceById(req.params.id);
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    res.json({ success: true, data: invoice });
  } catch (error) {
    next(error);
  }
};

exports.uploadReceipt = async (req, res, next) => {
  try {
    const method = req.body.payment_method;
    const filename = req.file ? req.file.filename : null;
    if (!filename) {
      return res.status(400).json({ success: false, message: 'Bukti bayar diperlukan' });
    }
    const invoice = await invoiceService.uploadReceipt(req.params.id, filename, method);
    res.json({ success: true, data: invoice, message: 'Bukti bayar berhasil diunggah' });
  } catch (error) {
    next(error);
  }
};

exports.verifyPayment = async (req, res, next) => {
  try {
    const invoice = await invoiceService.verifyPayment(req.params.id);
    res.json({ success: true, data: invoice, message: 'Pembayaran berhasil diverifikasi' });
  } catch (error) {
    next(error);
  }
};
