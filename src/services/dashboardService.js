const prisma = require('../config/db');

exports.getAdminDashboardStats = async () => {
  const now = new Date();
  const currentYear = now.getFullYear();

  // 1. FINANSIAL METRICS
  const [allInvoices, allTenants, allContracts, allAssets, unbilledLogsCount, pendingSchedulesCount] = await Promise.all([
    prisma.invoices.findMany({
      include: {
        tenants: true,
        contracts: true
      },
      orderBy: { created_at: 'desc' }
    }),
    prisma.tenants.findMany({
      orderBy: { created_at: 'desc' }
    }),
    prisma.contracts.findMany({
      include: {
        tenants: true,
        assets: true
      },
      orderBy: { created_at: 'desc' }
    }),
    prisma.assets.findMany({
      include: {
        master_tariffs: true,
        aircrafts: {
          include: { aircraft_types: true }
        },
        contracts: {
          where: { status: { in: ['Aktif', 'Active'] } },
          include: { tenants: true }
        }
      },
      orderBy: { id: 'asc' }
    }),
    prisma.operational_logs.count({
      where: { billing_status: 'Unbilled' }
    }),
    prisma.flight_schedules.count({
      where: { status: 'Pending' }
    })
  ]);

  // Financial calculations
  let realisasiPAD = 0;
  let totalPiutang = 0;
  let paidCount = 0;
  let overdueCount = 0;
  const overdueList = [];

  allInvoices.forEach(inv => {
    const amt = Number(inv.amount || 0);
    const s = (inv.status || '').toLowerCase();

    if (s === 'paid' || s === 'lunas') {
      realisasiPAD += amt;
      paidCount++;
    } else if (['unpaid', 'overdue', 'pending verification'].includes(s)) {
      totalPiutang += amt;
      
      const dueDate = inv.due_date ? new Date(inv.due_date) : null;
      if (dueDate && dueDate < now) {
        overdueCount++;
        const diffDays = Math.ceil((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        overdueList.push({
          id: inv.id,
          invoice_number: inv.invoice_number,
          tenant_name: inv.tenants?.nama_perusahaan || 'N/A',
          amount: amt,
          due_date: inv.due_date,
          days_overdue: diffDays,
          status: inv.status
        });
      }
    }
  });

  overdueList.sort((a, b) => b.days_overdue - a.days_overdue);

  const targetPAD = 15000000000; // Rp 15 Milyar (Target APBD Kab. Mimika)
  const achievementPercent = targetPAD > 0 ? (realisasiPAD / targetPAD) * 100 : 0;

  // 2. TENANT & CONTRACT METRICS
  const totalTenants = allTenants.length;
  const pendingTenants = allTenants.filter(t => (t.status_verifikasi || '').toLowerCase() === 'pending').length;
  const activeContracts = allContracts.filter(c => ['aktif', 'active'].includes((c.status || '').toLowerCase()));
  const activeContractsCount = activeContracts.length;

  // Kontrak Segera Berakhir (H-45 atau kurang)
  const expiringContracts = [];
  activeContracts.forEach(c => {
    if (c.end_date) {
      const end = new Date(c.end_date);
      const diffDays = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays <= 45 && diffDays >= 0) {
        expiringContracts.push({
          id: c.id,
          contract_number: c.contract_number,
          tenant_name: c.tenants?.nama_perusahaan || 'N/A',
          asset_name: c.assets?.nama_aset || c.jenis_pemanfaatan || 'Hanggar / Ruangan',
          end_date: c.end_date,
          days_remaining: diffDays,
          is_payung: c.contract_type === 'Payung'
        });
      }
    }
  });

  expiringContracts.sort((a, b) => a.days_remaining - b.days_remaining);

  // 3. ACTION HUB (Antrean Tugas Cepat Admin)
  const pendingPaymentReceipts = allInvoices.filter(i => (i.status || '').toLowerCase() === 'pending verification').length;
  const actionQueue = {
    pendingTenants,
    unbilledHanggarLogs: unbilledLogsCount,
    pendingPaymentReceipts,
    pendingFlightSchedules: pendingSchedulesCount
  };

  // 4. ASSET OCCUPANCY & VISUAL MAP
  let totalAreaAll = 0;
  let totalAreaUsed = 0;

  const visualAssets = allAssets.map(asset => {
    const totalLuas = Number(asset.luas || 0);
    totalAreaAll += totalLuas;

    const isHanggar = asset.jenis_aset === 'Hanggar' || (asset.kategori || '').toLowerCase().includes('hanggar');
    
    if (isHanggar) {
      // Hitung luas terpakai dari armada yang terparkir / terhubung
      let usedArea = 0;
      const parkedAircrafts = [];

      (asset.aircrafts || []).forEach(ac => {
        const acArea = Number(ac.aircraft_types?.luas_efektif_m2 || 0);
        usedArea += acArea;
        parkedAircrafts.push({
          id: ac.id,
          registration_number: ac.registration_number,
          aircraft_type: ac.aircraft_types?.tipe_pesawat || ac.aircraft_types?.jenis_pesawat || 'Standar',
          effective_area: acArea
        });
      });

      const remainingArea = Math.max(0, totalLuas - usedArea);
      totalAreaUsed += Math.min(totalLuas, usedArea);
      const occupancyPct = totalLuas > 0 ? Math.min(100, Math.round((usedArea / totalLuas) * 100)) : 0;

      // Active tenant if any linked contract
      const activeContract = asset.contracts?.[0];

      return {
        id: asset.id,
        kode_aset: asset.kode_aset,
        nama_aset: asset.nama_aset,
        jenis_aset: asset.jenis_aset,
        lokasi: asset.lokasi || 'Sisi Utara Runway',
        luas_total: totalLuas,
        luas_terpakai: usedArea,
        sisa_luas: remainingArea,
        occupancy_percent: occupancyPct,
        status: asset.status || (occupancyPct >= 100 ? 'Full' : occupancyPct > 0 ? 'Partial' : 'Available'),
        parked_aircrafts: parkedAircrafts,
        current_tenant: activeContract ? {
          nama_perusahaan: activeContract.tenants?.nama_perusahaan,
          contract_number: activeContract.contract_number,
          end_date: activeContract.end_date
        } : null
      };
    } else {
      // Ruangan / Gudang
      const activeContract = asset.contracts?.[0];
      const isOccupied = Boolean(activeContract) || asset.status === 'Occupied';
      if (isOccupied) {
        totalAreaUsed += totalLuas;
      }

      return {
        id: asset.id,
        kode_aset: asset.kode_aset,
        nama_aset: asset.nama_aset,
        jenis_aset: asset.jenis_aset,
        lokasi: asset.lokasi || 'Terminal / Gedung Administrasi',
        luas_total: totalLuas,
        luas_terpakai: isOccupied ? totalLuas : 0,
        sisa_luas: isOccupied ? 0 : totalLuas,
        occupancy_percent: isOccupied ? 100 : 0,
        status: asset.status || (isOccupied ? 'Occupied' : 'Available'),
        parked_aircrafts: [],
        current_tenant: activeContract ? {
          nama_perusahaan: activeContract.tenants?.nama_perusahaan,
          contract_number: activeContract.contract_number,
          end_date: activeContract.end_date
        } : null
      };
    }
  });

  const overallOccupancyRate = totalAreaAll > 0 ? ((totalAreaUsed / totalAreaAll) * 100).toFixed(1) : '0.0';

  // 5. MASTER TARIFFS (Tarif Perda)
  const masterTariffs = await prisma.master_tariffs.findMany({
    where: { status: 'Active' },
    orderBy: { id: 'asc' },
    take: 6
  });

  return {
    kpi: {
      realisasi_pad: realisasiPAD,
      target_pad: targetPAD,
      achievement_percent: Number(achievementPercent.toFixed(1)),
      total_piutang: totalPiutang,
      paid_invoices_count: paidCount,
      overdue_invoices_count: overdueCount,
      total_tenants: totalTenants,
      pending_tenants: pendingTenants,
      active_contracts_count: activeContractsCount,
      occupancy_rate: Number(overallOccupancyRate),
      total_area_m2: totalAreaAll,
      used_area_m2: totalAreaUsed
    },
    action_queue: actionQueue,
    visual_assets: visualAssets,
    expiring_contracts: expiringContracts,
    top_overdue_invoices: overdueList.slice(0, 5),
    master_tariffs: masterTariffs
  };
};

exports.getDinasDashboardStats = async () => {
  const now = new Date();

  const [
    allInvoices,
    allTenants,
    allContracts,
    allApplications,
    allWarnings,
    unbilledLogsCount
  ] = await Promise.all([
    prisma.invoices.findMany({
      include: {
        tenants: true,
        contracts: true
      },
      orderBy: { created_at: 'desc' }
    }),
    prisma.tenants.findMany({
      orderBy: { created_at: 'desc' }
    }),
    prisma.contracts.findMany({
      include: {
        tenants: true,
        assets: true
      },
      orderBy: { created_at: 'desc' }
    }),
    prisma.rental_applications.findMany({
      include: {
        tenants: true,
        assets: true
      },
      orderBy: { created_at: 'desc' }
    }),
    prisma.warnings.findMany({
      include: {
        tenants: true,
        invoices: true
      },
      orderBy: { created_at: 'desc' }
    }),
    prisma.operational_logs.count({
      where: { billing_status: 'Unbilled' }
    })
  ]);

  // Financial calculations
  let realisasiPAD = 0;
  let totalPiutang = 0;
  let paidCount = 0;
  let overdueCount = 0;
  const overdueList = [];

  let realisasiHanggar = 0;
  let realisasiRuangan = 0;
  let realisasiDenda = 0;

  allInvoices.forEach(inv => {
    const amt = Number(inv.amount || 0);
    const penalty = Number(inv.penalty_amount || 0);
    const s = (inv.status || '').toLowerCase();
    const isHanggar = (inv.service_category || '').toUpperCase() === 'HANGGAR' || (inv.account_code || '').includes('4.1.2.02.02');
    const isRuang = (inv.service_category || '').toUpperCase() === 'RUANGAN' || (inv.account_code || '').includes('4.1.2.02.01');
    const isDenda = (inv.service_category || '').toUpperCase() === 'DENDA' || (inv.account_code || '').includes('4.1.4.01.01');

    if (s === 'paid' || s === 'lunas') {
      realisasiPAD += (amt + penalty);
      paidCount++;
      if (isHanggar) realisasiHanggar += amt;
      else if (isRuang) realisasiRuangan += amt;
      else realisasiHanggar += amt;
      realisasiDenda += penalty;
    } else if (['unpaid', 'overdue', 'pending verification'].includes(s)) {
      totalPiutang += (amt + penalty);
      const dueDate = inv.due_date ? new Date(inv.due_date) : null;
      if (dueDate && dueDate < now) {
        overdueCount++;
        const diffDays = Math.ceil((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        let recommendedAction = 'Kirim Pengingat';
        if (diffDays >= 21) {
          recommendedAction = 'Terbitkan SP-3';
        } else if (diffDays >= 14) {
          recommendedAction = 'Terbitkan SP-2';
        } else if (diffDays >= 7) {
          recommendedAction = 'Terbitkan SP-1';
        }

        overdueList.push({
          id: inv.id,
          invoice_number: inv.invoice_number,
          tenant_name: inv.tenants?.nama_perusahaan || 'N/A',
          amount: amt + penalty,
          due_date: inv.due_date,
          days_overdue: diffDays,
          recommended_action: recommendedAction,
          status: inv.status
        });
      }
    }
  });

  overdueList.sort((a, b) => b.days_overdue - a.days_overdue);

  const targetPAD = 15000000000; // Rp 15 Milyar Target APBD
  const achievementPercent = targetPAD > 0 ? (realisasiPAD / targetPAD) * 100 : 0;

  // Applications
  const pendingApplications = allApplications.filter(a => ['pending', 'submitted', 'under review'].includes((a.status || '').toLowerCase())).length;

  // Tenants
  const pendingTenants = allTenants.filter(t => (t.status_verifikasi || '').toLowerCase() === 'pending').length;
  const verifiedTenants = allTenants.filter(t => (t.status_verifikasi || '').toLowerCase() === 'verified').length;

  // Contracts
  const activeContracts = allContracts.filter(c => ['aktif', 'active'].includes((c.status || '').toLowerCase())).length;
  const pendingKadisContracts = allContracts.filter(c => (c.status || '').toLowerCase() === 'menunggu pengesahan kadis').length;

  // Payments pending verification
  const pendingPaymentReceipts = allInvoices.filter(i => (i.status || '').toLowerCase() === 'pending verification').length;

  return {
    kpi: {
      realisasi_pad: realisasiPAD,
      target_pad: targetPAD,
      achievement_percent: Number(achievementPercent.toFixed(1)),
      total_piutang: totalPiutang,
      paid_invoices_count: paidCount,
      overdue_invoices_count: overdueCount,
      total_skrd_count: allInvoices.length,
      pending_applications_count: pendingApplications,
      total_applications_count: allApplications.length,
      pending_tenants_count: pendingTenants,
      verified_tenants_count: verifiedTenants,
      active_contracts_count: activeContracts,
      pending_kadis_contracts_count: pendingKadisContracts,
      warning_letters_count: allWarnings.length
    },
    action_queue: {
      pendingApplications,
      pendingTenants,
      unbilledHanggarLogs: unbilledLogsCount,
      pendingPaymentReceipts,
      pendingWarningLetters: overdueList.length,
      pendingKadisContracts
    },
    recent_applications: allApplications.slice(0, 5).map(app => ({
      id: app.id,
      application_number: app.application_number,
      tenant_name: app.tenants?.nama_perusahaan || 'N/A',
      asset_name: app.assets?.nama_aset || app.application_type || 'Hanggar / Ruangan',
      application_type: app.application_type || 'Sewa Hanggar',
      purpose: app.purpose || '-',
      start_date: app.start_date,
      end_date: app.end_date,
      status: app.status,
      created_at: app.created_at
    })),
    top_overdue_invoices: overdueList.slice(0, 5),
    revenue_breakdown: {
      hanggar: realisasiHanggar,
      ruangan: realisasiRuangan,
      denda: realisasiDenda,
      total: realisasiPAD
    }
  };
};

