const prisma = require('../config/db');

exports.fetchTenants = async () => {
  const tenants = await prisma.tenants.findMany({
    include: {
      invoices: true,
      contracts: true
    },
    orderBy: { id: 'asc' }
  });

  // Attach dynamic risk profile to each tenant
  return tenants.map(tenant => {
    return { ...tenant, risk_profile: calculateRiskProfile(tenant) };
  });
};

exports.fetchTenantById = async (id) => {
  const tenant = await prisma.tenants.findUnique({
    where: { id: parseInt(id) },
    include: {
      invoices: true,
      contracts: true
    }
  });
  if (!tenant) throw new Error('Tenant not found');
  
  return { ...tenant, risk_profile: calculateRiskProfile(tenant) };
};

exports.getTenantByUserId = async (userId) => {
  const tenant = await prisma.tenants.findFirst({
    where: { user_id: parseInt(userId) }
  });
  return tenant;
};

exports.addTenant = async (tenantData) => {
  return await prisma.tenants.create({
    data: tenantData
  });
};

exports.updateTenantStatus = async (id, status_verifikasi) => {
  const updateData = { status_verifikasi };
  const existingTenant = await prisma.tenants.findUnique({ where: { id: parseInt(id) } });
  
  if (!existingTenant) throw new Error('Tenant not found');

  // STRICT VALIDATION: Tenant cannot be Verified if legalitas is incomplete
  if (status_verifikasi === 'Verified') {
    const legalitas = existingTenant.legalitas || {};
    // Wajib: akta, nib, npwp, izin_usaha, izin_operasional
    /* 
    if (!legalitas.akta || !legalitas.nib || !legalitas.npwp || !legalitas.izin_usaha || !legalitas.izin_operasional) {
      throw new Error('Tenant cannot be verified. Strict validation failed: Missing required legal documents (Akta, NIB, NPWP, Izin Usaha, Izin Operasional).');
    }
    */

    if (!existingTenant.tenant_id_str) {
      // Format: T-YYYY-ID (misal: T-2026-0015)
      const currentYear = new Date().getFullYear();
      const paddedId = String(id).padStart(4, '0');
      updateData.tenant_id_str = `T-${currentYear}-${paddedId}`;
    }
  }

  const tenant = await prisma.tenants.update({
    where: { id: parseInt(id) },
    data: updateData
  });
  return tenant;
};

// Helper function to calculate Risk Profile dynamically
function calculateRiskProfile(tenant) {
  const invoices = tenant.invoices || [];
  const contracts = tenant.contracts || [];

  const total_tagihan = invoices.reduce((sum, inv) => sum + parseFloat(inv.amount), 0);
  const tunggakan = invoices
    .filter(inv => inv.status === 'Unpaid' || inv.status === 'Overdue')
    .reduce((sum, inv) => sum + parseFloat(inv.amount), 0);

  let umur_piutang = 0;
  const overdueInvoices = invoices.filter(inv => (inv.status === 'Unpaid' || inv.status === 'Overdue') && inv.due_date);
  
  if (overdueInvoices.length > 0) {
    const now = new Date();
    let maxDays = 0;
    overdueInvoices.forEach(inv => {
      const dueDate = new Date(inv.due_date);
      if (dueDate < now) {
        const diffTime = Math.abs(now - dueDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > maxDays) maxDays = diffDays;
      }
    });
    umur_piutang = maxDays;
  }

  const activeContracts = contracts.filter(c => c.status === 'Active');
  const status_kontrak = activeContracts.length > 0 ? 'Active' : 'No Active Contracts';

  let status_pembayaran = 'Current';
  if (tunggakan > 0) {
    status_pembayaran = umur_piutang > 30 ? 'Delinquent' : 'Warning';
  }

  return {
    total_tagihan,
    tunggakan,
    umur_piutang,
    status_kontrak,
    status_pembayaran
  };
}

exports.uploadLegalitas = async (id, documentType, filePath) => {
  const tenant = await prisma.tenants.findUnique({ where: { id: parseInt(id) } });
  if (!tenant) throw new Error('Tenant not found');

  const currentLegalitas = tenant.legalitas || {};
  currentLegalitas[documentType] = filePath;

  const updatedTenant = await prisma.tenants.update({
    where: { id: parseInt(id) },
    data: { legalitas: currentLegalitas }
  });
  return updatedTenant;
};
