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
      rental_applications: true
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
      admin_signature: payload.admin_signature !== undefined ? payload.admin_signature : undefined
    }
  });
};

exports.getContractsByTenant = async (tenantId) => {
  return await prisma.contracts.findMany({
    where: { tenant_id: parseInt(tenantId) },
    include: {
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

  if (status === 'Waiting Payment' || status === 'Approved') {
    // Generate Invoice automatically when signed by tenant
    await invoiceService.generateInvoice(id);
  }

  return updatedContract;
};

exports.extendContract = async (id, tenantId, durationMonths) => {
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

  const newEndDate = new Date(newStartDate);
  newEndDate.setMonth(newEndDate.getMonth() + parseInt(durationMonths));

  const newApplication = await prisma.rental_applications.create({
    data: {
      application_number: applicationNumber,
      tenant_id: parseInt(tenantId),
      asset_id: contract.asset_id,
      purpose: `Perpanjangan Kontrak No: ${contract.contract_number}`,
      start_date: newStartDate,
      end_date: newEndDate,
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

  // Release the asset back to Available
  if (contract.asset_id) {
    await prisma.assets.update({
      where: { id: contract.asset_id },
      data: { status: 'Available' }
    });
  }

  return updatedContract;
};
