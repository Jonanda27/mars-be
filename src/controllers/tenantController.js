const tenantService = require('../services/tenantService');
const { createNotification, notifyRole, getTenantUserId } = require('./notificationController');

exports.getTenants = async (req, res, next) => {
  try {
    const tenants = await tenantService.fetchTenants();
    res.status(200).json({ success: true, data: tenants });
  } catch (error) {
    next(error);
  }
};

exports.getTenant = async (req, res, next) => {
  try {
    const tenant = await tenantService.fetchTenantById(req.params.id);
    res.status(200).json({ success: true, data: tenant });
  } catch (error) {
    error.statusCode = 404;
    next(error);
  }
};

exports.createTenant = async (req, res, next) => {
  try {
    const newTenant = await tenantService.addTenant(req.body);
    res.status(201).json({ success: true, message: 'Tenant created', data: newTenant });
  } catch (error) {
    next(error);
  }
};

exports.verifyTenant = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, alasan_penolakan } = req.body;
    
    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }
    
    const updatedTenant = await tenantService.updateTenantStatus(id, status, alasan_penolakan);
    
    // Notifikasi langsung ke Tenant secara Real-Time
    const tenantUserId = await getTenantUserId(id);
    if (tenantUserId) {
      if (status === 'Verified') {
        await createNotification(
          tenantUserId,
          'Akun Mitra Berhasil Diverifikasi',
          `Selamat! Seluruh berkas legalitas perusahaan Anda (${updatedTenant.nama_perusahaan}) telah berhasil diverifikasi oleh Tim Bandara / Dinas. Akun Anda kini aktif dan siap mengajukan permohonan sewa fasilitas.`,
          'SUCCESS',
          '/tenant/profil'
        );
      } else if (status === 'Rejected') {
        await createNotification(
          tenantUserId,
          'Verifikasi Dokumen Legalitas Ditolak',
          alasan_penolakan 
            ? `Berkas legalitas perusahaan Anda (${updatedTenant.nama_perusahaan}) ditolak dengan alasan: ${alasan_penolakan}. Silakan lengkapi atau perbaiki dokumen Anda.`
            : `Berkas legalitas perusahaan Anda (${updatedTenant.nama_perusahaan}) ditolak. Silakan periksa kembali kelengkapan dokumen pada halaman profil.`,
          'DANGER',
          '/tenant/profil'
        );
      }
    }

    res.status(200).json({
      success: true,
      message: `Tenant status updated to ${status}`,
      data: updatedTenant
    });
  } catch (error) {
    next(error);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nib, npwp, alamat, pic, nomor_telepon, email } = req.body;
    
    const updatedTenant = await tenantService.updateProfile(id, { nib, npwp, alamat, pic, nomor_telepon, email });
    
    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedTenant
    });
  } catch (error) {
    next(error);
  }
};

exports.uploadLegalitas = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { documentType } = req.body; // e.g., 'nib', 'npwp', 'akta', 'aoc'
    
    if (!documentType || !req.file) {
      return res.status(400).json({ success: false, message: 'Document type and file are required' });
    }

    const filePath = req.file.path;
    const updatedTenant = await tenantService.uploadLegalitas(id, documentType, filePath);

    // Beritahu Admin dan Dinas bahwa ada dokumen baru yang diunggah
    notifyRole(
      ['admin', 'dinas'],
      'Dokumen Legalitas Mitra Diperbarui',
      `Mitra ${updatedTenant.nama_perusahaan} telah mengunggah/memperbarui dokumen legalitas (${documentType.toUpperCase()}). Harap lakukan peninjauan verifikasi.`,
      'INFO',
      '/admin/verifikasi'
    );

    res.status(200).json({
      success: true,
      message: 'Document uploaded successfully',
      data: updatedTenant
    });
  } catch (error) {
    next(error);
  }
};
