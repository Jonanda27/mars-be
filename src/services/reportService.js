const prisma = require('../config/db');

/**
 * Helper to compute date range from period filters
 */
function resolveDateRange(params) {
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const periodType = (params.period_type || 'monthly').toLowerCase();

  let startDate;
  let endDate;
  let periodLabel = '';

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  switch (periodType) {
    case 'monthly': {
      const month = Number(params.month) || (now.getMonth() + 1); // 1-12
      startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
      endDate = new Date(year, month, 0, 23, 59, 59, 999);
      periodLabel = `Bulan ${monthNames[month - 1]} ${year}`;
      break;
    }
    case 'quarterly': {
      const quarter = Number(params.quarter) || Math.ceil((now.getMonth() + 1) / 3); // 1-4
      const startMonth = (quarter - 1) * 3;
      const endMonth = startMonth + 2;
      startDate = new Date(year, startMonth, 1, 0, 0, 0, 0);
      endDate = new Date(year, endMonth + 1, 0, 23, 59, 59, 999);
      const romanQuarters = ['I', 'II', 'III', 'IV'];
      periodLabel = `Triwulan ${romanQuarters[quarter - 1]} Tahun ${year} (${monthNames[startMonth]} - ${monthNames[endMonth]})`;
      break;
    }
    case 'semester': {
      const semester = Number(params.semester) || ((now.getMonth() + 1) <= 6 ? 1 : 2); // 1-2
      const startMonth = semester === 1 ? 0 : 6;
      const endMonth = semester === 1 ? 5 : 11;
      startDate = new Date(year, startMonth, 1, 0, 0, 0, 0);
      endDate = new Date(year, endMonth + 1, 0, 23, 59, 59, 999);
      periodLabel = `Semester ${semester === 1 ? 'I' : 'II'} Tahun ${year} (${monthNames[startMonth]} - ${monthNames[endMonth]})`;
      break;
    }
    case 'annual': {
      startDate = new Date(year, 0, 1, 0, 0, 0, 0);
      endDate = new Date(year, 11, 31, 23, 59, 59, 999);
      periodLabel = `Tahun Anggaran ${year}`;
      break;
    }
    case 'custom':
    default: {
      if (params.start_date && params.end_date) {
        startDate = new Date(params.start_date);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(params.end_date);
        endDate.setHours(23, 59, 59, 999);
        periodLabel = `Periode ${startDate.toLocaleDateString('id-ID')} s/d ${endDate.toLocaleDateString('id-ID')}`;
      } else {
        // Default to current month
        const m = now.getMonth();
        startDate = new Date(year, m, 1, 0, 0, 0, 0);
        endDate = new Date(year, m + 1, 0, 23, 59, 59, 999);
        periodLabel = `Bulan ${monthNames[m]} ${year}`;
      }
      break;
    }
  }

  return { startDate, endDate, periodLabel, year };
}

/**
 * Mengklasifikasikan kode rekening dan nama kategori untuk setiap SKRD
 */
function classifyInvoice(inv) {
  const isDenda = Boolean(
    inv.invoice_type === 'SKRD Denda' ||
    inv.invoice_number?.includes('DND') ||
    inv.details?.type === 'PENALTY_INVOICE'
  );

  if (isDenda) {
    return {
      account_code: '4.1.4.01.01',
      account_name: 'Pendapatan Denda Retribusi Daerah',
      service_category: 'DENDA'
    };
  }

  const isRuangan = Boolean(
    inv.invoice_type === 'Sewa Ruangan' ||
    inv.contracts?.jenis_pemanfaatan?.toLowerCase().includes('ruang') ||
    inv.contracts?.assets?.jenis_aset?.toLowerCase().includes('ruang') ||
    inv.contracts?.contract_number?.includes('PKS-RG')
  );

  if (isRuangan) {
    return {
      account_code: '4.1.2.02.01',
      account_name: 'Retribusi Sewa Ruangan & Lahan Terminal',
      service_category: 'RUANGAN'
    };
  }

  return {
    account_code: '4.1.2.02.02',
    account_name: 'Retribusi Sewa Hanggar & Apron Pesawat',
    service_category: 'HANGGAR'
  };
}

/**
 * Menghasilkan Laporan Rekapitulasi Realisasi Penerimaan Retribusi Daerah (Slide 6 & 7 PPT)
 */
exports.getRetributionReport = async (queryParams) => {
  const { startDate, endDate, periodLabel, year } = resolveDateRange(queryParams);

  // Ambil semua invoice yang relevan:
  // 1. Yang dibayar pada periode ini (payment_date between startDate & endDate)
  // 2. ATAU yang diterbitkan pada periode ini (created_at between startDate & endDate)
  const invoices = await prisma.invoices.findMany({
    where: {
      OR: [
        {
          payment_date: {
            gte: startDate,
            lte: endDate
          }
        },
        {
          created_at: {
            gte: startDate,
            lte: endDate
          }
        }
      ]
    },
    include: {
      tenants: true,
      contracts: {
        include: {
          assets: true
        }
      },
      operational_logs: true
    },
    orderBy: {
      created_at: 'desc'
    }
  });

  // Filter optional: service_type, tenant_id, status
  const filteredInvoices = invoices.filter((inv) => {
    const classification = classifyInvoice(inv);

    // Filter service_type: 'ALL' | 'HANGGAR' | 'RUANGAN' | 'DENDA'
    if (queryParams.service_type && queryParams.service_type !== 'ALL') {
      if (classification.service_category !== queryParams.service_type) {
        return false;
      }
    }

    // Filter tenant_id
    if (queryParams.tenant_id && queryParams.tenant_id !== 'ALL') {
      if (Number(inv.tenant_id) !== Number(queryParams.tenant_id)) {
        return false;
      }
    }

    // Filter status
    if (queryParams.status && queryParams.status !== 'ALL') {
      if (inv.status.toLowerCase() !== queryParams.status.toLowerCase()) {
        return false;
      }
    }

    return true;
  });

  // Struktur Akumulator untuk Rekapitulasi Kode Rekening
  const accountSummaryMap = {
    '4.1.2.02.01': {
      account_code: '4.1.2.02.01',
      account_name: 'Retribusi Sewa Ruangan & Lahan Terminal',
      realisasi_pokok: 0,
      realisasi_denda: 0,
      total_realisasi: 0,
      piutang_menunggak: 0,
      total_ketetapan_terbit: 0,
      jumlah_skrd_lunas: 0,
      jumlah_skrd_piutang: 0,
      jumlah_skrd_batal: 0
    },
    '4.1.2.02.02': {
      account_code: '4.1.2.02.02',
      account_name: 'Retribusi Sewa Hanggar & Apron Pesawat',
      realisasi_pokok: 0,
      realisasi_denda: 0,
      total_realisasi: 0,
      piutang_menunggak: 0,
      total_ketetapan_terbit: 0,
      jumlah_skrd_lunas: 0,
      jumlah_skrd_piutang: 0,
      jumlah_skrd_batal: 0
    },
    '4.1.4.01.01': {
      account_code: '4.1.4.01.01',
      account_name: 'Pendapatan Denda Retribusi Daerah',
      realisasi_pokok: 0,
      realisasi_denda: 0,
      total_realisasi: 0,
      piutang_menunggak: 0,
      total_ketetapan_terbit: 0,
      jumlah_skrd_lunas: 0,
      jumlah_skrd_piutang: 0,
      jumlah_skrd_batal: 0
    }
  };

  let grandTotalRealisasi = 0;
  let grandTotalPiutang = 0;
  let grandTotalKetetapan = 0;
  let grandTotalDenda = 0;

  const invoiceList = filteredInvoices.map((inv) => {
    const classification = classifyInvoice(inv);
    const amount = Number(inv.amount || 0);
    const penaltyAmount = Number(inv.penalty_amount || 0);
    const totalAmount = amount + penaltyAmount;

    const isPaid = inv.status === 'Paid';
    const isCancelled = inv.status === 'Cancelled' || inv.status === 'Dibatalkan';
    const isUnpaid = inv.status === 'Unpaid' || inv.status === 'Overdue' || inv.status === 'Belum Lunas';

    // Apakah pelunasan terjadi di periode laporan?
    const isPaidInPeriod = isPaid && inv.payment_date && (
      new Date(inv.payment_date) >= startDate && new Date(inv.payment_date) <= endDate
    );

    // Apakah ketetapan diterbitkan di periode laporan?
    const isCreatedInPeriod = inv.created_at && (
      new Date(inv.created_at) >= startDate && new Date(inv.created_at) <= endDate
    );

    const acc = accountSummaryMap[classification.account_code];

    if (isPaidInPeriod) {
      if (classification.account_code === '4.1.4.01.01') {
        // SKRD Denda murni
        acc.realisasi_denda += amount;
        acc.total_realisasi += amount;
        grandTotalDenda += amount;
        grandTotalRealisasi += amount;
      } else {
        acc.realisasi_pokok += amount;
        acc.realisasi_denda += penaltyAmount;
        acc.total_realisasi += totalAmount;
        grandTotalRealisasi += totalAmount;
        if (penaltyAmount > 0) {
          grandTotalDenda += penaltyAmount;
          // Akumulasi denda juga ke akun denda untuk konsistensi pembukuan PAD
          accountSummaryMap['4.1.4.01.01'].realisasi_denda += penaltyAmount;
          accountSummaryMap['4.1.4.01.01'].total_realisasi += penaltyAmount;
        }
      }
      acc.jumlah_skrd_lunas += 1;
    }

    if (isCreatedInPeriod) {
      if (!isCancelled) {
        acc.total_ketetapan_terbit += totalAmount;
        grandTotalKetetapan += totalAmount;

        if (isUnpaid) {
          acc.piutang_menunggak += totalAmount;
          grandTotalPiutang += totalAmount;
          acc.jumlah_skrd_piutang += 1;
        }
      } else {
        acc.jumlah_skrd_batal += 1;
      }
    }

    return {
      id: inv.id,
      invoice_number: inv.invoice_number,
      account_code: classification.account_code,
      account_name: classification.account_name,
      service_category: classification.service_category,
      tenant_name: inv.tenants?.nama_perusahaan || 'Tenant Umum',
      contract_number: inv.contracts?.contract_number || null,
      asset_name: inv.contracts?.assets?.nama_aset || (classification.service_category === 'HANGGAR' ? 'Hanggar & Apron' : 'Sewa Ruangan'),
      amount,
      penalty_amount: penaltyAmount,
      total_amount: totalAmount,
      status: inv.status,
      created_at: inv.created_at,
      due_date: inv.due_date,
      payment_date: inv.payment_date,
      payment_method: inv.payment_method,
      payment_receipt: inv.payment_receipt,
      details: inv.details
    };
  });

  const accountBreakdown = Object.values(accountSummaryMap);

  return {
    meta: {
      period_type: queryParams.period_type || 'monthly',
      period_label: periodLabel,
      start_date: startDate,
      end_date: endDate,
      generated_at: new Date(),
      year
    },
    summary: {
      total_realisasi_kas_masuk: grandTotalRealisasi,
      total_piutang_menunggak: grandTotalPiutang,
      total_ketetapan_terbit: grandTotalKetetapan,
      total_denda_terkumpul: grandTotalDenda,
      total_skrd_count: invoiceList.length
    },
    account_breakdown: accountBreakdown,
    invoices: invoiceList
  };
};
