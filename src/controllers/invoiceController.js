const invoiceService = require('../services/invoiceService');
const tenantService = require('../services/tenantService');

exports.getAllInvoices = async (req, res, next) => {
  try {
    const invoices = await invoiceService.getAllInvoices(req.user);
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
    const fileUrl = req.file ? req.file.path : null;
    if (!fileUrl) {
      return res.status(400).json({ success: false, message: 'Bukti bayar diperlukan' });
    }
    const invoice = await invoiceService.uploadReceipt(req.params.id, fileUrl, method);
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

exports.generateSkrd = async (req, res, next) => {
  try {
    const contractId = req.params.contractId;
    const invoice = await invoiceService.generateInvoice(contractId);
    res.status(201).json({ success: true, data: invoice, message: 'SKRD berhasil diterbitkan' });
  } catch (error) {
    next(error);
  }
};

exports.generateOverstaySkrd = async (req, res, next) => {
  try {
    const logId = req.params.logId;
    const invoice = await invoiceService.generateOverstaySkrd(logId);
    res.status(201).json({ success: true, data: invoice, message: 'SKRD Overstay berhasil diterbitkan' });
  } catch (error) {
    next(error);
  }
};

exports.getUnbilledHanggarLogs = async (req, res, next) => {
  try {
    const logs = await invoiceService.getUnbilledHanggarLogs(req.query);
    res.json({ success: true, data: logs });
  } catch (error) {
    next(error);
  }
};

exports.generateHanggarCheckoutInvoice = async (req, res, next) => {
  try {
    const { log_id, custom_rate } = req.body;
    if (!log_id) {
      return res.status(400).json({ success: false, message: 'log_id wajib disertakan' });
    }
    const invoice = await invoiceService.generateHanggarCheckoutInvoice(log_id, custom_rate);
    res.status(201).json({ success: true, data: invoice, message: 'SKRD Sewa Hanggar (Check-Out) berhasil diterbitkan' });
  } catch (error) {
    next(error);
  }
};

exports.generateHanggarPeriodicInvoice = async (req, res, next) => {
  try {
    const invoice = await invoiceService.generateHanggarPeriodicInvoice(req.body);
    res.status(201).json({ success: true, data: invoice, message: 'SKRD Sewa Hanggar Rekapitulasi berhasil diterbitkan' });
  } catch (error) {
    next(error);
  }
};

exports.generateMiniAirportSkrd = async (req, res, next) => {
  try {
    const logId = req.params.logId;
    const issuedBy = req.user?.username ? `Dinas Perhubungan (${req.user.username})` : 'Dinas Perhubungan Papua Tengah';
    const invoice = await invoiceService.generateMiniAirportSkrd(logId, { issued_by: issuedBy });
    res.status(201).json({ success: true, data: invoice, message: 'SKRD Mini Airport berhasil diterbitkan' });
  } catch (error) {
    next(error);
  }
};

exports.generatePenaltyInvoice = async (req, res, next) => {
  try {
    const principalId = req.params.id;
    const dinasUserId = req.user ? req.user.id : 1;
    const invoice = await invoiceService.generatePenaltyInvoice(principalId, dinasUserId, req.body);
    res.status(201).json({
      success: true,
      data: invoice,
      message: 'SKRD Denda Keterlambatan berhasil diterbitkan.'
    });
  } catch (error) {
    next(error);
  }
};

exports.cancelInvoice = async (req, res, next) => {
  try {
    const invoiceId = req.params.id;
    const dinasUserId = req.user ? req.user.id : 1;
    const { reason } = req.body;
    const invoice = await invoiceService.cancelInvoice(invoiceId, dinasUserId, reason);
    res.json({
      success: true,
      data: invoice,
      message: 'Tagihan SKRD berhasil dibatalkan.'
    });
  } catch (error) {
    next(error);
  }
};

exports.reissueInvoice = async (req, res, next) => {
  try {
    const invoiceId = req.params.id;
    const dinasUserId = req.user ? req.user.id : 1;
    const newInvoice = await invoiceService.reissueCorrectedInvoice(invoiceId, dinasUserId, req.body);
    res.status(201).json({
      success: true,
      data: newInvoice,
      message: 'SKRD Pengganti berhasil diterbitkan dan SKRD lama telah dibatalkan.'
    });
  } catch (error) {
    next(error);
  }
};

exports.getEmergencyInvoiceByToken = async (req, res, next) => {
  try {
    const { token } = req.params;
    const invoice = await invoiceService.getEmergencyInvoiceByToken(token);
    res.json({ success: true, data: invoice });
  } catch (error) {
    next(error);
  }
};

exports.uploadEmergencyPaymentReceipt = async (req, res, next) => {
  try {
    const { token } = req.params;
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Bukti transfer pembayaran (file) wajib diunggah' });
    }
    const updatedInvoice = await invoiceService.uploadEmergencyPaymentReceipt(token, req.file, req.body);
    res.json({
      success: true,
      message: 'Bukti pembayaran berhasil diunggah dan sedang menunggu verifikasi admin.',
      data: updatedInvoice
    });
  } catch (error) {
    next(error);
  }
};

exports.checkPublicInvoice = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || !q.trim()) {
      return res.status(200).json({
        success: false,
        data: null,
        message: 'Silakan masukkan nomor SKRD atau Kode Invoice.'
      });
    }

    const result = await invoiceService.checkPublicInvoice(q);
    if (!result) {
      return res.status(200).json({
        success: false,
        data: null,
        message: `Tagihan atau SKRD dengan nomor/kata kunci "${q}" tidak ditemukan di sistem database.`
      });
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

