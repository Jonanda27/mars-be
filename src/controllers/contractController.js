const contractService = require('../services/contractService');
const { notifyRole, createNotification } = require('./notificationController');
const prisma = require('../config/db');

const getTenantUserId = async (tenantId) => {
  if (!tenantId) return null;
  const tenant = await prisma.tenants.findUnique({
    where: { id: Number.parseInt(tenantId, 10) },
    select: { user_id: true }
  });
  if (tenant?.user_id) return tenant.user_id;

  const user = await prisma.users.findFirst({
    where: { tenants: { some: { id: Number.parseInt(tenantId, 10) } } },
    select: { id: true }
  });
  return user?.id || null;
};

exports.getAllContracts = async (req, res, next) => {
  try {
    const contracts = await contractService.getAllContracts();
    res.status(200).json({ success: true, data: contracts });
  } catch (error) {
    next(error);
  }
};

exports.getContractById = async (req, res, next) => {
  try {
    const contract = await contractService.getContractById(req.params.id);
    res.status(200).json({ success: true, data: contract });
  } catch (error) {
    next(error);
  }
};

exports.updateContract = async (req, res, next) => {
  try {
    const updatedContract = await contractService.updateContract(req.params.id, req.body);
    res.status(200).json({ success: true, message: 'Contract updated', data: updatedContract });
  } catch (error) {
    next(error);
  }
};

exports.getTenantContracts = async (req, res, next) => {
  try {
    const contracts = await contractService.getContractsByTenant(req.user.tenant_id);
    res.status(200).json({ success: true, data: contracts });
  } catch (error) {
    next(error);
  }
};

exports.getTenantContractById = async (req, res, next) => {
  try {
    const contract = await contractService.getContractByIdAndTenant(req.params.id, req.user.tenant_id);
    res.status(200).json({ success: true, data: contract });
  } catch (error) {
    next(error);
  }
};

exports.updateContractStatusByTenant = async (req, res, next) => {
  try {
    const { status, tenant_signature } = req.body;
    // Tenant only allowed to set Approved, Rejected, or Waiting Payment
    if (!['Approved', 'Rejected', 'Waiting Payment'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status update by Tenant' });
    }
    const updatedContract = await contractService.updateContractStatusByTenant(req.params.id, req.user.tenant_id, status, tenant_signature);
    res.status(200).json({ success: true, message: 'Contract status updated', data: updatedContract });
  } catch (error) {
    next(error);
  }
};

exports.extendContract = async (req, res, next) => {
  try {
    const { new_end_date } = req.body;
    const newApplication = await contractService.extendContract(req.params.id, req.user.tenant_id, new_end_date);
    res.status(201).json({ success: true, message: 'Extension requested successfully', data: newApplication });
  } catch (error) {
    next(error);
  }
};

exports.terminateContract = async (req, res, next) => {
  try {
    const updatedContract = await contractService.terminateContract(req.params.id);
    res.status(200).json({ success: true, message: 'Contract terminated successfully', data: updatedContract });
  } catch (error) {
    next(error);
  }
};

exports.uploadSignature = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'File is required' });
    }
    // multer-storage-cloudinary provides the remote URL in req.file.path
    const fileUrl = req.file.path;
    const updatedContract = await contractService.uploadSignature(req.params.id, req.user.tenant_id, fileUrl);

    // Notify Kadis & Admin that a contract is waiting for endorsement
    notifyRole(
      'kepala dinas',
      'Pengesahan Kontrak Diperlukan',
      `Mitra telah mengunggah dokumen kontrak PKS ${updatedContract.contract_number}. Harap periksa dan berikan pengesahan.`,
      'INFO',
      `/eksekutif/kontrak/${updatedContract.id}`
    );
    notifyRole(
      'admin',
      'Dokumen Kontrak Diunggah',
      `Mitra telah mengunggah scan PKS untuk kontrak ${updatedContract.contract_number}.`,
      'INFO',
      `/admin/kontrak`
    );

    res.status(200).json({ success: true, message: 'Signature uploaded successfully', data: updatedContract });
  } catch (error) {
    next(error);
  }
};

exports.approveByKadis = async (req, res, next) => {
  try {
    const kadisName = req.user?.username ? `Kepala Dinas (${req.user.username})` : 'Kepala Dinas Perhubungan';
    const updatedContract = await contractService.approveContractByKadis(req.params.id, kadisName);

    // Notify Tenant
    const tenantUserId = await getTenantUserId(updatedContract.tenant_id);
    if (tenantUserId) {
      await createNotification(
        tenantUserId,
        'Kontrak / PKS Telah Disahkan',
        `Kontrak ${updatedContract.contract_number} telah disahkan dan berstatus AKTIF. Anda kini dapat menggunakan fasilitas sesuai perjanjian.`,
        'SUCCESS',
        `/tenant/kontrak-sewa`
      );
    }

    // Notify Admin
    notifyRole(
      'admin',
      'Kontrak Telah Disahkan Kadis',
      `Kepala Dinas telah mengesahkan kontrak ${updatedContract.contract_number} menjadi Aktif.`,
      'SUCCESS',
      `/admin/kontrak`
    );

    res.status(200).json({ 
      success: true, 
      message: 'Kontrak berhasil disahkan oleh Kepala Dinas dan status kini Aktif', 
      data: updatedContract 
    });
  } catch (error) {
    next(error);
  }
};

exports.rejectByKadis = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const updatedContract = await contractService.rejectContractByKadis(req.params.id, reason);

    // Notify Tenant
    const tenantUserId = await getTenantUserId(updatedContract.tenant_id);
    if (tenantUserId) {
      await createNotification(
        tenantUserId,
        'Catatan Revisi Kontrak dari Kadis',
        `Kontrak ${updatedContract.contract_number} memerlukan revisi: ${reason || 'Silakan unggah kembali dokumen yang sesuai.'}`,
        'DANGER',
        `/tenant/kontrak-sewa`
      );
    }

    res.status(200).json({ 
      success: true, 
      message: 'Kontrak ditolak / dikembalikan untuk revisi', 
      data: updatedContract 
    });
  } catch (error) {
    next(error);
  }
};

exports.verifyContract = async (req, res, next) => {
  try {
    const updatedContract = await contractService.verifyContract(req.params.id);
    res.status(200).json({ success: true, message: 'Contract verified and activated successfully', data: updatedContract });
  } catch (error) {
    next(error);
  }
};

