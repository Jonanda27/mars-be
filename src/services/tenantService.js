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

exports.updateTenantStatus = async (id, status_verifikasi, alasan_penolakan = null) => {
  const updateData = { status_verifikasi };
  
  if (status_verifikasi === 'Rejected') {
    updateData.alasan_penolakan = alasan_penolakan;
  } else {
    updateData.alasan_penolakan = null;
  }

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

  // Auto-generate Umbrella Contract if Verified
  if (status_verifikasi === 'Verified') {
    const existingContract = await prisma.contracts.findFirst({
      where: {
        tenant_id: tenant.id,
        jenis_pemanfaatan: 'Kontrak Payung'
      }
    });

    if (!existingContract) {
      const currentYear = new Date().getFullYear();
      const startDate = new Date();
      const endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 1);

      // Fetch all active master tariffs to attach to the contract
      const masterTariffs = await prisma.master_tariffs.findMany({
        where: { status: 'Active' }
      });

      const contractCountThisYear = await prisma.contracts.count({
        where: {
          created_at: {
            gte: new Date(`${currentYear}-01-01T00:00:00.000Z`)
          }
        }
      });
      const sequenceNumber = contractCountThisYear + 1;

      await prisma.contracts.create({
        data: {
          contract_number: generateContractNumber(sequenceNumber, tenant.nama_perusahaan),
          contract_type: 'Payung',
          tenant_id: tenant.id,
          status: 'Menunggu TTD Tenant',
          start_date: startDate,
          end_date: endDate,
          jenis_pemanfaatan: 'Kontrak Payung',
          fasilitas: masterTariffs,
          periode_pembayaran: 'Tahunan'
        }
      });
    }
  }

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

exports.updateProfile = async (id, data) => {
  const tenant = await prisma.tenants.findUnique({ where: { id: parseInt(id) } });
  if (!tenant) throw new Error('Tenant not found');

  // Set status to pending if NIB or NPWP was updated
  let newStatus = tenant.status_verifikasi;
  if ((data.nib && data.nib !== tenant.nib) || (data.npwp && data.npwp !== tenant.npwp)) {
    newStatus = 'Pending';
  }

  const updatedTenant = await prisma.tenants.update({
    where: { id: parseInt(id) },
    data: {
      nib: data.nib !== undefined ? data.nib : tenant.nib,
      npwp: data.npwp !== undefined ? data.npwp : tenant.npwp,
      alamat: data.alamat !== undefined ? data.alamat : tenant.alamat,
      pic: data.pic !== undefined ? data.pic : tenant.pic,
      nomor_telepon: data.nomor_telepon !== undefined ? data.nomor_telepon : tenant.nomor_telepon,
      email: data.email !== undefined ? data.email : tenant.email,
      status_verifikasi: newStatus
    }
  });

  return updatedTenant;
};

exports.uploadLegalitas = async (id, documentType, filePath) => {
  const tenant = await prisma.tenants.findUnique({ where: { id: parseInt(id) } });
  if (!tenant) throw new Error('Tenant not found');

  const currentLegalitas = tenant.legalitas || {};
  currentLegalitas[documentType] = filePath;

  // Reset status to Pending if it was Rejected, so Admin knows they uploaded a new document
  const newStatus = tenant.status_verifikasi === 'Rejected' ? 'Pending' : tenant.status_verifikasi;
  const newAlasan = newStatus === 'Pending' ? null : tenant.alasan_penolakan;

  const updatedTenant = await prisma.tenants.update({
    where: { id: parseInt(id) },
    data: { 
      legalitas: currentLegalitas,
      status_verifikasi: newStatus,
      alasan_penolakan: newAlasan
    }
  });
  return updatedTenant;
};

// Helper function to generate formal contract number
function generateContractNumber(sequenceNumber, companyName) {
  const date = new Date();
  const year = date.getFullYear();
  const romanMonths = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  const month = romanMonths[date.getMonth()];
  
  // Pad sequence to 3 digits
  const paddedSequence = String(sequenceNumber).padStart(3, '0');
  
  // Extract company abbreviation
  let abbr = 'UNK';
  if (companyName) {
    // Hilangkan kata awalan PT, CV, UD, dll
    const cleaned = companyName.replace(/\b(PT|CV|UD|LPP)\b/gi, '').trim();
    // Ambil huruf pertama tiap kata
    const match = cleaned.match(/\b\w/g);
    if (match) {
      abbr = match.join('').toUpperCase().substring(0, 3);
    }
  }
  
  return `${paddedSequence}/KTR-${abbr}/${month}/${year}`;
}
