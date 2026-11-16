const rentalService = require('../services/rentalService');
const { notifyRole, createNotification, getTenantUserId } = require('./notificationController');
const prisma = require('../config/db');
const { filterApplicationsByScope, getAdminScope, classifyApplication } = require('../utils/adminScope');

exports.createRentalApplication = async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id; // From auth middleware
    if (!tenantId) {
      return res.status(403).json({ success: false, message: 'User is not a tenant' });
    }
    const newApp = await rentalService.createApplication(tenantId, req.body, req.file);
    
    // Ambil identitas perusahaan tenant agar notifikasi jelas dan informatif
    const tenantInfo = await prisma.tenants.findUnique({
      where: { id: Number(tenantId) },
      select: { nama_perusahaan: true }
    });
    const tenantName = tenantInfo?.nama_perusahaan 
      ? `${tenantInfo.nama_perusahaan} (${req.user.username})` 
      : req.user.username;

    // 1. Notifikasi ke Kepala Dinas: Menunggu persetujuan surat permohonan
    await notifyRole(
      'kepala dinas',
      'Surat Permohonan Baru Menunggu Persetujuan Kadis',
      `Mitra ${tenantName} telah mengajukan surat permohonan sewa baru (${newApp.application_number}) dan menunggu verifikasi/persetujuan dari Kepala Dinas.`,
      'INFO',
      `/eksekutif/permohonan/${newApp.id}`
    );

    // 2. Notifikasi ke Admin Umum & Dinas Perhubungan
    await notifyRole(
      ['admin', 'dinas'],
      'Permohonan Sewa Baru Masuk',
      `Mitra ${tenantName} mengajukan permohonan sewa baru (${newApp.application_number}).`,
      'INFO',
      '/admin/permohonan'
    );

    // 3. Notifikasi ke Admin Bidang Khusus (Hanggar / Apron / Ruangan)
    const appScope = classifyApplication(newApp);
    if (appScope === 'HANGGAR') {
      await notifyRole('admin_hanggar', 'Permohonan Sewa Hanggar Baru', `Mitra ${tenantName} mengajukan permohonan sewa hanggar (${newApp.application_number}).`, 'INFO', '/admin/permohonan');
    } else if (appScope === 'APRON') {
      await notifyRole('admin_apron', 'Permohonan Sewa Apron Baru', `Mitra ${tenantName} mengajukan permohonan sewa apron (${newApp.application_number}).`, 'INFO', '/admin/permohonan');
    } else if (appScope === 'RUANGAN') {
      await notifyRole('admin_ruangan', 'Permohonan Sewa Ruangan Baru', `Mitra ${tenantName} mengajukan permohonan sewa ruangan (${newApp.application_number}).`, 'INFO', '/admin/permohonan');
    }

    // 4. Notifikasi Konfirmasi Real-Time ke Tenant Pengaju
    await createNotification(
      req.user.id,
      'Surat Permohonan Terkirim',
      `Surat permohonan sewa Anda (${newApp.application_number}) telah berhasil dikirim dan sedang menunggu verifikasi Kepala Dinas.`,
      'INFO',
      `/tenant/permohonan/${newApp.id}`
    );

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
          'Surat Permohonan Disetujui Kadis - TTD Kontrak Payung',
          `Surat permohonan sewa Anda (${app.application_number}) telah disetujui oleh Kepala Dinas. Draf Kontrak Payung telah diterbitkan, silakan tandatangani Kontrak Payung untuk melanjutkan ke pemilihan layanan.`,
          'SUCCESS',
          `/tenant/permohonan/${id}`
        );
      } else if (status === 'Surat Disetujui') {
        await createNotification(
          tenantUserId,
          'Surat Permohonan Disetujui Kadis',
          `Surat permohonan sewa Anda (${app.application_number}) telah disetujui oleh Kepala Dinas. Silakan lengkapi rincian permohonan sewa Anda.`,
          'SUCCESS',
          `/tenant/permohonan/${id}`
        );
      } else if (status === 'Ditolak') {
        await createNotification(
          tenantUserId,
          'Surat Permohonan Ditolak Kadis',
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

    // Also notify Admin & Dinas
    await notifyRole(
      ['admin', 'dinas'],
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
    const userRole = (req.user?.role || '').toLowerCase();
    const isGlobal = ['superadmin', 'kepala dinas', 'dinas'].includes(userRole);
    const isAdminMini = userRole === 'admin_mini_airport';

    let airportId = null;
    let miniAirportId = null;

    if (isGlobal) {
      airportId = null;
      miniAirportId = null;
    } else if (isAdminMini) {
      // Role admin_mini_airport: Khusus permohonan Mini Airport
      airportId = null;
      miniAirportId = req.user?.mini_airport_id || 'ALL_MINI';
    } else {
      // Role admin: Khusus permohonan Bandara Mozes Kilangin (Sewa Hanggar, Apron, Ruangan)
      airportId = req.user?.airport_id || 1;
      miniAirportId = null;
    }

    const apps = await rentalService.getAllApplications(airportId, miniAirportId);
    const scopedApps = filterApplicationsByScope(apps, req.user);
    res.status(200).json({ success: true, data: scopedApps });
  } catch (error) {
    next(error);
  }
};

exports.getApplicationById = async (req, res, next) => {
  try {
    const app = await rentalService.getApplicationById(req.params.id);
    if (!app) {
      return res.status(404).json({ success: false, message: 'Permohonan tidak ditemukan' });
    }

    const userRole = (req.user?.role || '').toLowerCase();
    const isGlobal = ['superadmin', 'kepala dinas', 'dinas', 'tenant'].includes(userRole);
    if (!isGlobal) {
      let spec = app.specific_needs;
      if (typeof spec === 'string') {
        try { spec = JSON.parse(spec); } catch (e) { spec = {}; }
      }
      const isMini = (app.application_type || '').toLowerCase().includes('mini');
      const targetMiniId = spec?.mini_airport_id || spec?.airport_id;

      if (userRole === 'admin_mini_airport' || req.user?.mini_airport_id) {
        if (!isMini || (req.user?.mini_airport_id && Number(targetMiniId) !== Number(req.user.mini_airport_id))) {
          return res.status(403).json({
            success: false,
            message: 'Anda tidak memiliki hak akses untuk permohonan di luar wilayah Mini Airport Anda.'
          });
        }
      } else {
        const userAirportId = req.user?.airport_id || 1;
        if (isMini || (app.assets?.airport_id && Number(app.assets.airport_id) !== Number(userAirportId))) {
          return res.status(403).json({
            success: false,
            message: 'Anda tidak memiliki hak akses untuk permohonan di luar bandara Anda.'
          });
        }

        // Scope check untuk admin_hanggar, admin_apron, admin_ruangan
        const scope = getAdminScope(req.user);
        if (scope === 'HANGGAR' || scope === 'APRON' || scope === 'RUANGAN') {
          const appScope = classifyApplication(app);
          if (appScope !== scope) {
            return res.status(403).json({
              success: false,
              message: `Anda tidak memiliki hak akses untuk permohonan layanan ${appScope}.`
            });
          }
        }
      }
    }

    res.status(200).json({ success: true, data: app });
  } catch (error) {
    next(error);
  }
};

exports.updateApplicationStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, asset_id, allocated_stand } = req.body;

    const existingApp = await rentalService.getApplicationById(id);
    if (!existingApp) {
      return res.status(404).json({ success: false, message: 'Permohonan tidak ditemukan' });
    }

    let spec = existingApp.specific_needs;
    if (typeof spec === 'string') {
      try { spec = JSON.parse(spec); } catch (e) { spec = {}; }
    }
    const isMini = (existingApp.application_type || '').toLowerCase().includes('mini');
    const targetMiniId = spec?.mini_airport_id || spec?.airport_id;

    const userRole = (req.user?.role || '').toLowerCase();
    const isGlobal = ['superadmin', 'kepala dinas', 'dinas'].includes(userRole);
    if (!isGlobal) {
      if (req.user?.mini_airport_id) {
        if (!isMini || Number(targetMiniId) !== Number(req.user.mini_airport_id)) {
          return res.status(403).json({
            success: false,
            message: 'Anda hanya berhak memvalidasi permohonan yang ditujukan ke Mini Airport wilayah Anda.'
          });
        }
      } else {
        const userAirportId = req.user?.airport_id || 1;
        if (isMini || (existingApp.assets?.airport_id && Number(existingApp.assets.airport_id) !== Number(userAirportId))) {
          return res.status(403).json({
            success: false,
            message: 'Anda tidak memiliki hak akses untuk memvalidasi permohonan di luar bandara Anda.'
          });
        }
      }
    }

    // Validasi apakah stand yang dipilih kosong pada tanggal landing
    if (isMini && status === 'Aktif' && allocated_stand && targetMiniId) {
      const standAvailability = await rentalService.getMiniAirportStandAvailability(
        targetMiniId,
        spec?.landing_date,
        id
      );
      const targetStand = standAvailability.find(s => s.stand === allocated_stand);
      if (targetStand && targetStand.is_occupied) {
        return res.status(400).json({
          success: false,
          message: `Stand ${allocated_stand} sedang terisi (${targetStand.occupied_by ? `oleh ${targetStand.occupied_by}` : targetStand.status}). Silakan pilih stand lain yang masih kosong.`
        });
      }
    }

    const app = await rentalService.updateApplicationStatus(id, status, asset_id, allocated_stand);
    
    // Notify the tenant about the status change
    const tenantUserId = await getTenantUserId(app.tenant_id);
    if (tenantUserId) {
      const isMiniApp = (app.application_type || '').toLowerCase().includes('mini');
      createNotification(
        tenantUserId, 
        'Status Permohonan Diperbarui', 
        `Permohonan Anda (${app.application_number}) sekarang berstatus: ${status}`, 
        status === 'Surat Disetujui' || status === 'Aktif' || status === 'Draft PKS' || status === 'Draft Kontrak' ? 'SUCCESS' : 'INFO', 
        isMiniApp ? '/tenant/mini-airport' : `/tenant/permohonan/${id}`
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

// =========================================================================
// CONTROLLER: PERPANJANGAN MASA SEWA (LEASE EXTENSION)
// =========================================================================

exports.requestExtension = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenant_id || null;
    const updatedApp = await rentalService.requestExtension(id, tenantId, req.body);

    // Notify Admin UPBU
    await notifyRole(
      'admin',
      'Pengajuan Perpanjangan Sewa',
      `Tenant ${updatedApp.tenants?.nama_perusahaan || ''} mengajukan perpanjangan masa sewa untuk ${updatedApp.application_number} hingga ${req.body.requested_end_date}.`,
      'INFO',
      '/admin/permohonan'
    );

    res.status(200).json({
      success: true,
      message: 'Pengajuan perpanjangan sewa berhasil dikirim dan menunggu verifikasi Admin UPBU',
      data: updatedApp
    });
  } catch (error) {
    next(error);
  }
};

exports.getPendingExtensions = async (req, res, next) => {
  try {
    const airportId = req.user?.airport_id || null;
    const pendingExtensions = await rentalService.getPendingExtensions(airportId);
    res.status(200).json({
      success: true,
      data: pendingExtensions
    });
  } catch (error) {
    next(error);
  }
};

exports.getAssetAvailabilityForExtension = async (req, res, next) => {
  try {
    const { airport_id, startDate, endDate, excludeApplicationId, category } = req.query;
    const effectiveAirportId = airport_id || req.user?.airport_id || null;
    const availability = await rentalService.getAssetAvailabilityForExtension(
      effectiveAirportId,
      startDate,
      endDate,
      excludeApplicationId,
      category
    );
    res.status(200).json({
      success: true,
      data: availability
    });
  } catch (error) {
    next(error);
  }
};

exports.reviewExtension = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updatedApp = await rentalService.reviewExtension(id, req.user, req.body);

    const isApproved = req.body.action === 'APPROVE';
    const tenantUserId = await getTenantUserId(updatedApp.tenant_id);

    if (tenantUserId) {
      if (isApproved) {
        const spec = typeof updatedApp.specific_needs === 'string'
          ? JSON.parse(updatedApp.specific_needs)
          : (updatedApp.specific_needs || {});
        const targetName = spec.extension_request?.allocated_asset_name || updatedApp.assets?.nama_aset || 'Fasilitas Bandara';
        const isRelocated = spec.extension_request?.is_relocated;

        let msg = `Pengajuan perpanjangan sewa Anda (${updatedApp.application_number}) telah DISETUJUI hingga ${spec.extension_request?.requested_end_date}.`;
        if (isRelocated) {
          msg += ` Penempatan pesawat dialokasikan ke: ${targetName}.`;
        }

        await createNotification(
          tenantUserId,
          'Perpanjangan Sewa Disetujui',
          msg,
          'SUCCESS',
          `/tenant/jadwal-hanggar`
        );
      } else {
        await createNotification(
          tenantUserId,
          'Perpanjangan Sewa Ditolak',
          `Pengajuan perpanjangan sewa Anda (${updatedApp.application_number}) ditolak oleh Admin UPBU. Catatan: ${req.body.admin_notes || 'Tidak memenuhi ketersediaan kapasitas.'}`,
          'WARNING',
          `/tenant/jadwal-hanggar`
        );
      }
    }

    res.status(200).json({
      success: true,
      message: `Perpanjangan sewa berhasil ${isApproved ? 'disetujui' : 'ditolak'}`,
      data: updatedApp
    });
  } catch (error) {
    next(error);
  }
};

exports.getMiniAirportStandAvailability = async (req, res, next) => {
  try {
    const { airport_id, date, exclude_id } = req.query;
    if (!airport_id) {
      return res.status(400).json({ success: false, message: 'airport_id query parameter is required' });
    }

    const stands = await rentalService.getMiniAirportStandAvailability(airport_id, date, exclude_id);
    res.status(200).json({ success: true, data: stands });
  } catch (error) {
    next(error);
  }
};

