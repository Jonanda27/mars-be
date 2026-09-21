const prisma = require('../config/db');
const invoiceService = require('./invoiceService');

exports.getAllContracts = async () => {
  return await prisma.contracts.findMany({
    include: {
      tenants: true,
      assets: true,
      rental_applications: true
    },
    orderBy: { created_at: 'desc' }
  });
};

exports.getContractById = async (id) => {
  const contract = await prisma.contracts.findUnique({
    where: { id: Number.parseInt(id, 10) },
    include: {
      tenants: true,
      assets: true,
      rental_applications: true,
      invoices: true
    }
  });
  if (!contract) throw new Error('Contract not found');
  return contract;
};

exports.updateContract = async (id, payload) => {
  return await prisma.contracts.update({
    where: { id: Number.parseInt(id, 10) },
    data: {
      contract_number: payload.contract_number,
      deposit_jaminan: payload.deposit_jaminan !== undefined ? Number.parseFloat(payload.deposit_jaminan) : undefined,
      total_amount: payload.total_amount !== undefined ? Number.parseFloat(payload.total_amount) : undefined,
      status: payload.status,
      fasilitas: payload.fasilitas !== undefined ? payload.fasilitas : undefined,
      denda: payload.denda !== undefined ? payload.denda : undefined,
      periode_pembayaran: payload.periode_pembayaran !== undefined ? payload.periode_pembayaran : undefined,
      admin_signature: payload.admin_signature !== undefined ? payload.admin_signature : undefined
    }
  });
};

exports.getContractsByTenant = async (tenantId) => {
  return await prisma.contracts.findMany({
    where: { tenant_id: Number.parseInt(tenantId, 10) },
    include: {
      tenants: true,
      assets: true,
      rental_applications: true
    },
    orderBy: { id: 'desc' }
  });
};

exports.getContractByIdAndTenant = async (id, tenantId) => {
  const contract = await prisma.contracts.findFirst({
    where: { 
      id: Number.parseInt(id, 10),
      tenant_id: Number.parseInt(tenantId, 10)
    },
    include: {
      tenants: true,
      assets: true,
      rental_applications: true
    }
  });
  if (!contract) throw new Error('Contract not found or access denied');
  return contract;
};

exports.updateContractStatusByTenant = async (id, tenantId, status, tenant_signature) => {
  const contract = await this.getContractByIdAndTenant(id, tenantId);
  
  if (contract.status !== 'Review') {
    throw new Error('Only contracts in Review status can be Approved or Rejected by tenant');
  }

  const updatedContract = await prisma.contracts.update({
    where: { id: Number.parseInt(id, 10) },
    data: { 
      status,
      tenant_signature: tenant_signature !== undefined ? tenant_signature : undefined
    }
  });

  // Invoice will now be generated manually by Admin at the end of the rental period (SKRD)
  // as per the new business rules.

  return updatedContract;
};

exports.extendContract = async (id, tenantId, newEndDate) => {
  const contract = await this.getContractByIdAndTenant(id, tenantId);
  
  if (contract.status !== 'Expiring' && contract.status !== 'Active') {
    throw new Error('Only Active or Expiring contracts can be extended');
  }

  // Generate new application number
  const count = await prisma.rental_applications.count();
  const applicationNumber = `EXT-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

  // Calculate new dates
  const oldEndDate = contract.end_date ? new Date(contract.end_date) : new Date();
  const newStartDate = new Date(oldEndDate);
  newStartDate.setDate(newStartDate.getDate() + 1);

  const parsedNewEndDate = new Date(newEndDate);
  if (parsedNewEndDate <= newStartDate) {
    throw new Error('New end date must be after the start date of the extension');
  }

  // Preserve specific needs from original application if available
  let specificNeeds = null;
  if (contract.rental_applications?.specific_needs) {
    specificNeeds = contract.rental_applications.specific_needs;
  }

  const newApplication = await prisma.rental_applications.create({
    data: {
      application_number: applicationNumber,
      tenant_id: Number.parseInt(tenantId, 10),
      asset_id: contract.asset_id,
      purpose: `Perpanjangan Kontrak No: ${contract.contract_number}`,
      specific_needs: specificNeeds ? structuredClone(specificNeeds) : null,
      start_date: newStartDate,
      end_date: parsedNewEndDate,
      status: 'Pending'
    }
  });

  return newApplication;
};

exports.terminateContract = async (id) => {
  const contract = await prisma.contracts.findUnique({
    where: { id: Number.parseInt(id, 10) }
  });

  if (!contract) throw new Error('Contract not found');

  // Update contract status to Terminated
  const updatedContract = await prisma.contracts.update({
    where: { id: Number.parseInt(id, 10) },
    data: { status: 'Terminated' }
  });

  // Guard clause: Check if any other non-expired contract uses this asset
  if (contract.asset_id) {
    const otherActiveContracts = await prisma.contracts.count({
      where: {
        asset_id: contract.asset_id,
        id: { not: contract.id },
        status: { notIn: ['Expired', 'Terminated', 'Rejected'] }
      }
    });

    if (otherActiveContracts === 0) {
      // Release the asset back to Available
      await prisma.assets.update({
        where: { id: contract.asset_id },
        data: { status: 'Available' }
      });
    }

    // Guard clause for aircraft: Check if THIS tenant has another active contract for this asset
    const sameTenantOtherContracts = await prisma.contracts.count({
      where: {
        asset_id: contract.asset_id,
        tenant_id: contract.tenant_id,
        id: { not: contract.id },
        status: { notIn: ['Expired', 'Terminated', 'Rejected'] }
      }
    });

    if (sameTenantOtherContracts === 0) {
      // Release tied aircraft for this tenant
      await prisma.aircrafts.updateMany({
        where: { 
          asset_id: contract.asset_id,
          tenant_id: contract.tenant_id
        },
        data: { 
          asset_id: null,
          status: 'Active' 
        }
      });
    }
  }

  return updatedContract;
};

exports.uploadSignature = async (id, tenantId, fileUrl) => {
  const contract = await prisma.contracts.findUnique({ where: { id: Number.parseInt(id, 10) } });
  if (!contract) throw new Error('Contract not found');
  if (contract.tenant_id !== Number.parseInt(tenantId, 10)) throw new Error('Unauthorized');
  
  if (contract.status !== 'Menunggu TTD Tenant' && contract.status !== 'Draft' && contract.status !== 'Review') {
    throw new Error('Contract is not waiting for signature');
  }

  // Update the contract: signed document uploaded, waiting for Kadis endorsement
  const updatedContract = await prisma.contracts.update({
    where: { id: Number.parseInt(id, 10) },
    data: {
      signed_document_url: fileUrl,
      tenant_signature: new Date().toISOString(),
      status: 'Menunggu Pengesahan Kadis'
    }
  });

  return updatedContract;
};

exports.approveContractByKadis = async (id, kadisName = 'Kepala Dinas') => {
  const contractId = Number.parseInt(id, 10);
  const contract = await prisma.contracts.findUnique({ 
    where: { id: contractId },
    include: { rental_applications: true, assets: true, tenants: true }
  });
  if (!contract) throw new Error('Contract not found');

  const updatedContract = await prisma.$transaction(async (tx) => {
    // 1. Update contract status to Aktif and record Kadis signature timestamp / name
    const updated = await tx.contracts.update({
      where: { id: contractId },
      data: {
        status: 'Aktif',
        admin_signature: `Disahkan oleh ${kadisName} pada ${new Date().toLocaleString('id-ID')}`
      }
    });

    // 2. Also update the linked rental_application status
    // For Payung contract: status permohonan menjadi 'Surat Disetujui' (sehingga tenant bisa lanjut memilih detail aset / armada)
    // For regular/room contract: status permohonan menjadi 'Signed'
    const isPayung = contract.contract_type === 'Payung';
    const appTargetStatus = isPayung ? 'Surat Disetujui' : 'Signed';

    await tx.rental_applications.updateMany({
      where: { contract_id: contractId },
      data: { status: appTargetStatus }
    });

    // 3. Link aircrafts to this asset if they were selected in the application
    if (contract.rental_applications && contract.rental_applications.length > 0) {
      const app = contract.rental_applications[0];
      if (app.specific_needs && Array.isArray(app.specific_needs.aircraft_ids)) {
        const aircraftIds = app.specific_needs.aircraft_ids
          .map(aid => Number.parseInt(aid, 10))
          .filter(aid => !Number.isNaN(aid));
        if (aircraftIds.length > 0) {
          await tx.aircrafts.updateMany({
            where: { id: { in: aircraftIds } },
            data: { asset_id: contract.asset_id }
          });
        }
      }
    }

    return updated;
  });

  // Untuk sewa ruangan: terbitkan penetapan SKRD di awal secara otomatis saat kontrak aktif
  const isRuangan = Boolean(
    (contract.assets?.jenis_aset || '').toLowerCase().includes('ruang') ||
    contract.contract_type !== 'Payung'
  );
  if (isRuangan) {
    try {
      await invoiceService.generateInvoice(contract.id);
    } catch (invErr) {
      console.error('Auto generate SKRD for room rental error:', invErr);
    }
  }

  return updatedContract;
};

exports.rejectContractByKadis = async (id, reason = 'Dokumen PKS belum lengkap atau perlu revisi') => {
  const contractId = Number.parseInt(id, 10);
  const contract = await prisma.contracts.findUnique({ 
    where: { id: contractId },
    include: { rental_applications: true, tenants: true }
  });
  if (!contract) throw new Error('Contract not found');

  const updatedContract = await prisma.$transaction(async (tx) => {
    const updated = await tx.contracts.update({
      where: { id: contractId },
      data: {
        status: 'Perlu Revisi',
        admin_signature: `Catatan Revisi: ${reason} (${new Date().toLocaleString('id-ID')})`
      }
    });

    await tx.rental_applications.updateMany({
      where: { contract_id: contractId },
      data: { status: 'Perlu Revisi' }
    });

    return updated;
  });

  return updatedContract;
};

exports.verifyContract = async (id) => {
  return await exports.approveContractByKadis(id, 'Admin / Dinas');
};

