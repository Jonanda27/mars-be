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
    where: { id: parseInt(id) },
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
    where: { id: parseInt(id) },
    data: {
      contract_number: payload.contract_number,
      deposit_jaminan: payload.deposit_jaminan !== undefined ? parseFloat(payload.deposit_jaminan) : undefined,
      total_amount: payload.total_amount !== undefined ? parseFloat(payload.total_amount) : undefined,
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
    where: { tenant_id: parseInt(tenantId) },
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
      id: parseInt(id),
      tenant_id: parseInt(tenantId)
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
    where: { id: parseInt(id) },
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
  if (contract.rental_applications && contract.rental_applications.specific_needs) {
    specificNeeds = contract.rental_applications.specific_needs;
  }

  const newApplication = await prisma.rental_applications.create({
    data: {
      application_number: applicationNumber,
      tenant_id: parseInt(tenantId),
      asset_id: contract.asset_id,
      purpose: `Perpanjangan Kontrak No: ${contract.contract_number}`,
      specific_needs: specificNeeds ? JSON.parse(JSON.stringify(specificNeeds)) : null,
      start_date: newStartDate,
      end_date: parsedNewEndDate,
      status: 'Pending'
    }
  });

  return newApplication;
};

exports.terminateContract = async (id) => {
  const contract = await prisma.contracts.findUnique({
    where: { id: parseInt(id) }
  });

  if (!contract) throw new Error('Contract not found');

  // Update contract status to Terminated
  const updatedContract = await prisma.contracts.update({
    where: { id: parseInt(id) },
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
  const contract = await prisma.contracts.findUnique({ where: { id: parseInt(id) } });
  if (!contract) throw new Error('Contract not found');
  if (contract.tenant_id !== parseInt(tenantId)) throw new Error('Unauthorized');
  
  if (contract.status !== 'Menunggu TTD Tenant') {
    throw new Error('Contract is not waiting for signature');
  }

  return await prisma.contracts.update({
    where: { id: parseInt(id) },
    data: {
      signed_document_url: fileUrl,
      status: 'Menunggu Verifikasi Admin'
    }
  });
};

exports.verifyContract = async (id) => {
  const contract = await prisma.contracts.findUnique({ where: { id: parseInt(id) } });
  if (!contract) throw new Error('Contract not found');

  if (contract.status !== 'Menunggu Verifikasi Admin') {
    throw new Error('Contract is not waiting for verification');
  }

  return await prisma.contracts.update({
    where: { id: parseInt(id) },
    data: {
      status: 'Aktif' // Set to Active once verified
    }
  });
};
