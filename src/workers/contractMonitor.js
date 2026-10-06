const cron = require('node-cron');
const prisma = require('../config/db');

const releaseContractAssetAndAircraft = async (contract) => {
  if (!contract.asset_id) return;

  // Guard clause: Check if any other non-expired contract uses this asset
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
};

const calculateExpirationThreshold = (totalDurationDays) => {
  if (totalDurationDays > 90) return 30;
  if (totalDurationDays >= 30) return 7;
  if (totalDurationDays >= 7) return 3;
  return 1;
};

const processContractExpiration = async (contract, today) => {
  const endDate = new Date(contract.end_date);
  endDate.setHours(0, 0, 0, 0);

  // Check if it's already expired
  if (endDate < today) {
    if (contract.status !== 'Expired') {
      await prisma.contracts.update({
        where: { id: contract.id },
        data: { status: 'Expired' }
      });
      await releaseContractAssetAndAircraft(contract);
      return 'Expired';
    }
    return null;
  }

  // Check dynamic expiration threshold based on total lease duration
  if (contract.start_date) {
    const startDate = new Date(contract.start_date);
    startDate.setHours(0, 0, 0, 0);

    const totalDurationMs = endDate.getTime() - startDate.getTime();
    const totalDurationDays = Math.ceil(totalDurationMs / (1000 * 60 * 60 * 24));

    const remainingMs = endDate.getTime() - today.getTime();
    const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));

    const threshold = calculateExpirationThreshold(totalDurationDays);

    if (remainingDays <= threshold && contract.status !== 'Expiring') {
      await prisma.contracts.update({
        where: { id: contract.id },
        data: { status: 'Expiring' }
      });
      return 'Expiring';
    }
  }

  return null;
};

const processInvoiceWarning = async (invoice, overdueDays) => {
  // 1. Tahap 3: Penerbitan STRD (Pasal 21 ayat 7-8 Perbup 25/2024)
  // Diterbitkan jika 7 hari setelah Surat Teguran (H+14 sejak jatuh tempo SKRD) belum dilunasi
  if (overdueDays >= 14) {
    const existingStrd = await prisma.warnings.findFirst({
      where: { invoice_id: invoice.id, type: 'STRD' }
    });

    // Hitung sanksi administratif bunga 1% per bulan (Pasal 21 ayat 8)
    const monthsOverdue = Math.max(1, Math.min(24, Math.ceil(overdueDays / 30)));
    const calculatedPenalty = Math.round(Number(invoice.amount) * 0.01 * monthsOverdue);

    if (!existingStrd) {
      await prisma.warnings.create({
        data: {
          warning_number: `STRD-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${invoice.id}`,
          tenant_id: invoice.tenant_id,
          invoice_id: invoice.id,
          type: 'STRD',
          message: `Surat Tagihan Retribusi Daerah (STRD) diterbitkan sesuai Pasal 21 ayat (7) & (8) Perbup No. 25 Tahun 2024 atas tagihan SKRD No. ${invoice.invoice_number}. Dikenakan sanksi bunga administrasi 1% per bulan.`,
          status: 'Pending'
        }
      });

      // Batasi hak pemanfaatan aset / layanan bandara jika menunggak sampai tahap STRD
      await prisma.tenants.update({
        where: { id: invoice.tenant_id },
        data: { status_pembayaran: 'Restricted' }
      });
    }

    // Pastikan sanksi denda dan status Overdue tercatat di invoice
    await prisma.invoices.update({
      where: { id: invoice.id },
      data: {
        penalty_amount: calculatedPenalty,
        status: 'Overdue'
      }
    });

    return 'STRD';
  } 
  // 2. Tahap 2: Surat Teguran (Pasal 21 ayat 4 & 6)
  // Diterbitkan apabila 7 hari setelah jatuh tempo pembayaran (H+7) belum melakukan pelunasan
  else if (overdueDays >= 7) {
    const existingTeguran = await prisma.warnings.findFirst({
      where: { invoice_id: invoice.id, type: 'Surat Teguran' }
    });

    if (!existingTeguran) {
      await prisma.warnings.create({
        data: {
          warning_number: `ST-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${invoice.id}`,
          tenant_id: invoice.tenant_id,
          invoice_id: invoice.id,
          type: 'Surat Teguran',
          message: `Surat Teguran resmi H+7 sesuai Pasal 21 ayat (4) & (6) Perbup No. 25 Tahun 2024: SKRD No. ${invoice.invoice_number} telah melewati tanggal jatuh tempo selama ${overdueDays} hari. Wajib dilunasi paling lama 7 hari kalender sebelum penagihan STRD.`,
          status: 'Pending'
        }
      });

      await prisma.invoices.update({
        where: { id: invoice.id },
        data: { status: 'Overdue' }
      });

      return 'Surat Teguran';
    }
  } 
  // 3. Tahap 1: Surat Pemberitahuan (Pasal 21 ayat 3)
  // Disampaikan dalam jangka waktu 7 hari sebelum tanggal jatuh tempo (H-7) tercantum dalam SKRD
  else if (overdueDays >= -7 && overdueDays <= 0) {
    const existingPemberitahuan = await prisma.warnings.findFirst({
      where: { invoice_id: invoice.id, type: 'Surat Pemberitahuan' }
    });

    if (!existingPemberitahuan) {
      const daysLeft = Math.abs(overdueDays);
      await prisma.warnings.create({
        data: {
          warning_number: `PB-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${invoice.id}`,
          tenant_id: invoice.tenant_id,
          invoice_id: invoice.id,
          type: 'Surat Pemberitahuan',
          message: `Surat Pemberitahuan resmi H-7 sesuai Pasal 21 ayat (3) Perbup No. 25 Tahun 2024: SKRD No. ${invoice.invoice_number} akan jatuh tempo dalam ${daysLeft} hari kalender mendatang. Harap melakukan penyetoran melalui Bank Papua sebelum tanggal jatuh tempo.`,
          status: 'Pending'
        }
      });

      return 'Surat Pemberitahuan';
    }
  }

  return null;
};

// Setup the cron job to run every day at midnight (00:00)
// '0 0 * * *'
const checkContractExpirations = async () => {
  console.log('--- CRON JOB: Checking contract expirations ---');
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of day

    // Get all contracts that are currently Active or Expiring
    const activeContracts = await prisma.contracts.findMany({
      where: {
        status: { in: ['Active', 'Expiring'] },
        end_date: { not: null }
      }
    });

    let expiredCount = 0;
    let expiringCount = 0;

    for (const contract of activeContracts) {
      const outcome = await processContractExpiration(contract, today);
      if (outcome === 'Expired') expiredCount++;
      else if (outcome === 'Expiring') expiringCount++;
    }

    console.log(`Cron Complete: Marked ${expiringCount} as Expiring, ${expiredCount} as Expired.`);
  } catch (error) {
    console.error('Error running contract monitor cron job:', error);
  }
};

const checkArrearsAndGenerateWarnings = async () => {
  console.log('--- CRON JOB: Checking arrears and generating statutory Perbup 25/2024 notices ---');
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const unpaidInvoices = await prisma.invoices.findMany({
      where: { status: { in: ['Unpaid', 'Overdue'] }, due_date: { not: null } },
      include: { contracts: true }
    });

    let pbCount = 0;
    let stCount = 0;
    let strdCount = 0;

    for (const invoice of unpaidInvoices) {
      const dueDate = new Date(invoice.due_date);
      dueDate.setHours(0, 0, 0, 0);

      // overdueDays:
      // > 0 jika sudah lewat jatuh tempo
      // < 0 jika masih sebelum jatuh tempo (H-7)
      // = 0 jika tepat hari ini jatuh tempo
      const diffTime = today.getTime() - dueDate.getTime();
      const overdueDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      const result = await processInvoiceWarning(invoice, overdueDays);
      if (result === 'Surat Pemberitahuan') pbCount++;
      else if (result === 'Surat Teguran') stCount++;
      else if (result === 'STRD') strdCount++;
    }

    console.log(`Perbup 25/2024 Check Complete: Generated ${pbCount} Surat Pemberitahuan (H-7), ${stCount} Surat Teguran (H+7), ${strdCount} STRD.`);
  } catch (error) {
    console.error('Error running arrears check cron job:', error);
  }
};

const initCronJobs = () => {
  // Run every day at 00:00
  cron.schedule('0 0 * * *', () => {
    checkContractExpirations();
    checkArrearsAndGenerateWarnings();
  });
  console.log('Cron Jobs Initialized: Contract Monitor & Risk Control (runs daily at midnight)');
};

module.exports = {
  initCronJobs,
  checkContractExpirations,
  checkArrearsAndGenerateWarnings
};
