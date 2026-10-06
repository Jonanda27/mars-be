const prisma = require('../config/db');
const emailService = require('../services/emailService');

const getAllWarnings = async (req, res, next) => {
  try {
    const warnings = await prisma.warnings.findMany({
      include: {
        tenants: true,
        invoices: true
      },
      orderBy: { created_at: 'desc' }
    });

    res.json({
      success: true,
      data: warnings
    });
  } catch (error) {
    next(error);
  }
};

const getTenantWarnings = async (req, res, next) => {
  try {
    const userId = req.user.id; // From verifyToken middleware
    
    // Get tenant associated with user
    const tenant = await prisma.tenants.findFirst({
      where: { user_id: userId }
    });

    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found for this user' });
    }

    const warnings = await prisma.warnings.findMany({
      where: { tenant_id: tenant.id },
      include: { invoices: true },
      orderBy: { created_at: 'desc' }
    });

    res.json({
      success: true,
      data: warnings
    });
  } catch (error) {
    next(error);
  }
};

const sendWarningEmail = async (req, res, next) => {
  try {
    const { id } = req.params;
    const warning = await prisma.warnings.findUnique({
      where: { id: Number(id) },
      include: {
        tenants: {
          include: { users: true }
        },
        invoices: true
      }
    });

    if (!warning) {
      return res.status(404).json({ success: false, message: 'Surat Peringatan tidak ditemukan' });
    }

    const recipientEmail = req.body?.recipient_email || warning.tenants?.email || warning.tenants?.users?.username;
    if (!recipientEmail || !recipientEmail.includes('@')) {
      return res.status(400).json({ 
        success: false, 
        message: `Tenant ${warning.tenants?.nama_perusahaan || ''} belum memiliki alamat email yang valid di sistem.` 
      });
    }

    let pdfAttachment = null;
    if (req.body?.pdf_base64) {
      try {
        const cleanBase64 = req.body.pdf_base64.replace(/^data:application\/pdf;[^,]*,/, '');
        const filename = req.body.filename || `${(warning.type || 'Surat').replace(/\s+/g, '_')}_${(warning.warning_number || 'dokumen').replace(/[\/\\:]/g, '_')}.pdf`;
        pdfAttachment = {
          filename,
          content: Buffer.from(cleanBase64, 'base64'),
          contentType: 'application/pdf'
        };
      } catch (pdfErr) {
        console.error('Gagal memproses attachment PDF:', pdfErr);
      }
    }

    const emailResult = await emailService.sendWarningLetterEmail({
      to: recipientEmail,
      tenant: warning.tenants,
      warning,
      invoice: warning.invoices,
      pdfAttachment
    });

    if (!emailResult.success) {
      return res.status(500).json({ 
        success: false, 
        message: `Gagal mengirim email: ${emailResult.error}` 
      });
    }

    const updated = await prisma.warnings.update({
      where: { id: warning.id },
      data: { status: 'Email Sent' }
    });

    res.json({
      success: true,
      message: `Surat Peringatan ${warning.warning_number} berhasil dikirim ke email ${recipientEmail}`,
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

const triggerWarningCheck = async (req, res, next) => {
  try {
    const { checkArrearsAndGenerateWarnings } = require('../workers/contractMonitor');
    await checkArrearsAndGenerateWarnings();
    res.json({
      success: true,
      message: 'Sinkronisasi penagihan Perbup No. 25 Tahun 2024 (H-7, H+7, STRD) berhasil dijalankan.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllWarnings,
  getTenantWarnings,
  sendWarningEmail,
  triggerWarningCheck
};
