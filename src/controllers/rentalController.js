const rentalService = require('../services/rentalService');
const { notifyRole, createNotification } = require('./notificationController');
const prisma = require('../config/db');

// Helper to reliably find the user ID corresponding to a tenant
const getTenantUserId = async (tenantId) => {
  if (!tenantId) return null;
  const tenant = await prisma.tenants.findUnique({
    where: { id: tenantId },
    select: { user_id: true }
  });
  if (tenant?.user_id) return tenant.user_id;

  const user = await prisma.users.findFirst({
    where: { tenants: { some: { id: tenantId } } },
    select: { id: true }
  });
  return user?.id || null;
};

exports.createRentalApplication = async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id; // From auth middleware
    if (!tenantId) {
      return res.status(403).json({ success: false, message: 'User is not a tenant' });
    }
    const newApp = await rentalService.createApplication(tenantId, req.body, req.file);
    
    // Notify Admin and Kadis
    notifyRole('admin', 'Permohonan Baru', `Tenant ${req.user.username} mengajukan permohonan sewa baru (${newApp.application_number}).`, 'INFO', '/admin/permohonan');
    notifyRole('kepala dinas', 'Permohonan Baru', `Tenant ${req.user.username} mengajukan permohonan sewa baru (${newApp.application_number}).`, 'INFO', `/eksekutif/permohonan/${newApp.id}`);

    res.status(201).json({ success: true, message: 'Application created successfully', data: newApp });
  } catch (error) {
    next(error);
  }
};

exports.verifyLetter = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const app = await rentalService.verifyLetter(id, status);

    // Notify Tenant about Kadis verification result
    const tenantUserId = await getTenantUserId(app.tenant_id);
    if (tenantUserId) {
      if (app.status === 'Menunggu TTD Kontrak Payung') {
        await createNotification(
          tenantUserId,
          'Surat Disetujui - Tanda Tangan Kontrak Payung',
          `Surat permohonan sewa Anda (${app.application_number}) telah disetujui. Draf Kontrak Payung telah diterbitkan, silakan tanda tangani Kontrak Payung untuk melanjutkan ke pemilihan layanan.`,
          'SUCCESS',
          `/tenant/permohonan/${id}`
        );
      } else if (status === 'Surat Disetujui') {
        await createNotification(
          tenantUserId,
          'Surat Permohonan Disetujui',
          `Surat permohonan sewa Anda (${app.application_number}) telah disetujui oleh Kepala Dinas. Silakan lengkapi rincian permohonan sewa.`,
          'SUCCESS',
          `/tenant/permohonan/${id}`
        );
      } else if (status === 'Ditolak') {
        await createNotification(
          tenantUserId,
          'Surat Permohonan Ditolak',
          `Surat permohonan sewa Anda (${app.application_number}) telah ditolak oleh Kepala Dinas.`,
          'WARNING',
          `/tenant/permohonan/${id}`
        );
      } else {
        await createNotification(
          tenantUserId,
          'Status Surat Permohonan Diperbarui',
          `Status permohonan sewa Anda (${app.application_number}) diperbarui menjadi: ${status}`,
          'INFO',
          `/tenant/permohonan/${id}`
        );
      }
    }

    // Also notify Admin
    await notifyRole(
      'admin',
      `Verifikasi Surat: ${status}`,
      `Kepala Dinas telah memverifikasi surat permohonan ${app.application_number} (${status}).`,
      status === 'Surat Disetujui' ? 'SUCCESS' : 'INFO',
      `/admin/permohonan`
    );

    res.status(200).json({ success: true, data: app });
  } catch (error) {
    next(error);
  }
};

exports.completeDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    const app = await rentalService.completeDetails(id, req.body);

    // Notify Admin that tenant has completed details
    await notifyRole(
      'admin',
      'Rincian Sewa Dilengkapi',
      `Tenant telah melengkapi rincian sewa untuk permohonan ${app.application_number}. Menunggu validasi admin.`,
      'INFO',
      `/admin/permohonan`
    );

    res.status(200).json({ success: true, data: app });
  } catch (error) {
    next(error);
  }
};

exports.approveByKadis = async (req, res, next) => {
  try {
    const { id } = req.params;
    // req.user has role checking in middleware already
    const app = await rentalService.approveAndDraftContract(id, req.user);

    // Notify Tenant that contract has been approved/drafted
    const tenantUserId = await getTenantUserId(app.tenant_id);
    if (tenantUserId) {
      await createNotification(
        tenantUserId,
        'Persetujuan Kontrak Sewa',
        `Permohonan sewa Anda (${app.application_number}) telah disetujui oleh Kepala Dinas. Draft kontrak telah diterbitkan, silakan unduh dan unggah dokumen kontrak bertandatangan.`,
        'SUCCESS',
        `/tenant/permohonan/${id}`
      );
    }

    // Notify Admin
    await notifyRole(
      'admin',
      'Kontrak Telah Disetujui Kadis',
      `Kepala Dinas telah menyetujui kontrak untuk permohonan ${app.application_number}.`,
      'SUCCESS',
      `/admin/kontrak`
    );

    res.status(200).json({ success: true, data: app });
  } catch (error) {
    next(error);
  }
};

exports.getTenantApplications = async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id; // From auth middleware
    if (!tenantId) {
      return res.status(403).json({ success: false, message: 'User is not a tenant' });
    }
    const apps = await rentalService.getApplicationsByTenant(tenantId);
    res.status(200).json({ success: true, data: apps });
  } catch (error) {
    next(error);
  }
};

exports.getAllApplications = async (req, res, next) => {
  try {
    const airportId = req.user.role.toLowerCase() === 'superadmin' ? null : req.user.airport_id;
    const apps = await rentalService.getAllApplications(airportId);
    res.status(200).json({ success: true, data: apps });
  } catch (error) {
    next(error);
  }
};

exports.getApplicationById = async (req, res, next) => {
  try {
    const app = await rentalService.getApplicationById(req.params.id);
    res.status(200).json({ success: true, data: app });
  } catch (error) {
    next(error);
  }
};

exports.updateApplicationStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, asset_id } = req.body;
    const app = await rentalService.updateApplicationStatus(id, status, asset_id);
    
    // Notify the tenant about the status change
    const tenantUserId = await getTenantUserId(app.tenant_id);
    if (tenantUserId) {
      createNotification(
        tenantUserId, 
        'Status Permohonan Diperbarui', 
        `Permohonan sewa Anda (${app.application_number}) sekarang berstatus: ${status}`, 
        status === 'Surat Disetujui' || status === 'Draft PKS' || status === 'Draft Kontrak' ? 'SUCCESS' : 'INFO', 
        `/tenant/permohonan/${id}`
      );
    }

    // If Admin sends to Kadis for approval
    if (status === 'Menunggu Persetujuan Kadis') {
      notifyRole(
        'kepala dinas',
        'Persetujuan Kontrak Dibutuhkan',
        `Permohonan sewa ${app.application_number} telah divalidasi oleh Admin dan menunggu persetujuan Anda.`,
        'INFO',
        `/eksekutif/permohonan/${id}`
      );
    }

    res.status(200).json({ success: true, data: app });
  } catch (error) {
    next(error);
  }
};

exports.getApprovedApplications = async (req, res, next) => {
  try {
    const apps = await rentalService.getApprovedApplications();
    res.status(200).json({ success: true, data: apps });
  } catch (error) {
    next(error);
  }
};

exports.uploadSignature = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    // File is saved in uploads/ (or cloud), req.file.path contains the path
    const filePath = req.file.path.replaceAll('\\', '/'); // Normalize path for Windows
    const app = await rentalService.updateSignature(id, filePath);

    // Notify Tenant and Admin
    const tenantUserId = await getTenantUserId(app.tenant_id);
    if (tenantUserId) {
      createNotification(
        tenantUserId,
        'Kontrak Sewa Aktif',
        `Dokumen bertandatangan untuk permohonan (${app.application_number}) berhasil diunggah. Kontrak sewa Anda kini berstatus Aktif (Signed).`,
        'SUCCESS',
        `/tenant/permohonan/${id}`
      );
    }

    notifyRole(
      'admin',
      'Kontrak Bertandatangan Diunggah',
      `Dokumen bertandatangan untuk permohonan ${app.application_number} telah diunggah. Status: Signed.`,
      'SUCCESS',
      `/admin/kontrak`
    );
    
    res.status(200).json({ success: true, data: app });
  } catch (error) {
    next(error);
  }
};

exports.uploadPayungSignature = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'File tanda tangan kontrak payung wajib diunggah' });
    }

    const filePath = req.file.path.replaceAll('\\', '/');
    const app = await rentalService.uploadPayungSignature(id, filePath);

    const tenantUserId = await getTenantUserId(app.tenant_id);
    if (tenantUserId) {
      createNotification(
        tenantUserId,
        'Kontrak Payung Diunggah',
        `Kontrak Payung bertandatangan untuk permohonan (${app.application_number}) berhasil diunggah dan sedang menunggu pengesahan Kepala Dinas.`,
        'INFO',
        `/tenant/permohonan/${id}`
      );
    }

    notifyRole(
      'kepala dinas',
      'Pengesahan Kontrak Payung Dibutuhkan',
      `Tenant telah mengunggah berkas scan TTD basah Kontrak Payung untuk permohonan ${app.application_number}. Silakan lakukan verifikasi dan pengesahan.`,
      'INFO',
      `/eksekutif/kontrak`
    );

    notifyRole(
      'admin',
      'Kontrak Payung Diunggah',
      `Tenant telah mengunggah Kontrak Payung bertandatangan untuk permohonan ${app.application_number}.`,
      'SUCCESS',
      `/admin/kontrak`
    );

    res.status(200).json({ success: true, data: app });
  } catch (error) {
    next(error);
  }
};

exports.uploadOfficialLetter = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'File surat permohonan wajib diunggah' });
    }
    const rawPath = req.file.secure_url || req.file.path || '';
    const filePath = rawPath.replaceAll('\\', '/');
    const app = await rentalService.uploadOfficialLetter(id, filePath);
    res.status(200).json({ success: true, message: 'Surat permohonan berhasil diunggah', data: app });
  } catch (error) {
    next(error);
  }
};
