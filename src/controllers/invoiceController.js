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

exports.payInvoice = async (req, res, next) => {
  try {
    const invoice = await invoiceService.payInvoice(req.params.id);
    res.json({ success: true, data: invoice });
  } catch (error) {
    next(error);
  }
};
