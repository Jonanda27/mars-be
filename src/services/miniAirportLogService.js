const prisma = require('../config/db');
const { calculateMiniAirportTaxes } = require('./miniAirportBillingService');

/**
 * Service Log Realisasi Operasional Mini Airport oleh Petugas Lapangan
 */

// 1. Ambil daftar permohonan Mini Airport aktif yang siap dicatat oleh Petugas Lapangan
exports.getEligibleMiniAirportApplications = async (officerUser = null) => {
  const where = {
    application_type: 'Mini Airport',
    status: { in: ['Aktif', 'Disetujui', 'Approved', 'Signed'] },
    operational_logs: {
      none: {} // HANYA permohonan yang BELUM dicatat realisasinya di lapangan
    }
  };

  const applications = await prisma.rental_applications.findMany({
    where,
    include: {
      tenants: true,
      contracts: true
    },
    orderBy: { created_at: 'desc' }
  });

  // Filter jika petugas terikat pada mini_airport_id tertentu
  if (officerUser?.mini_airport_id) {
    const targetMiniId = Number(officerUser.mini_airport_id);
    return applications.filter(app => {
      let spec = app.specific_needs;
      if (typeof spec === 'string') {
        try { spec = JSON.parse(spec); } catch (e) { spec = {}; }
      }
      return Number(spec?.airport_id || spec?.mini_airport_id) === targetMiniId;
    });
  }

  return applications;
};

// 2. Petugas Lapangan mencatat realisasi pendaratan di Mini Airport
exports.createMiniAirportLog = async (officerId, payload, file) => {
  const appId = Number.parseInt(payload.application_id, 10);
  const app = await prisma.rental_applications.findUnique({
    where: { id: appId },
    include: {
      tenants: true,
      contracts: true
    }
  });

  if (!app) {
    throw new Error('Permohonan Mini Airport tidak ditemukan');
  }

  let spec = app.specific_needs || {};
  if (typeof spec === 'string') {
    try { spec = JSON.parse(spec); } catch (e) { spec = {}; }
  }

  const regNumber = (payload.registration_number || spec.registration_number || 'PK-UNKNOWN').trim().toUpperCase();
  const rawEntryTime = payload.entry_time ? new Date(payload.entry_time) : new Date();
  const rawExitTime = payload.exit_time ? new Date(payload.exit_time) : null;
  const isOvernight = Boolean(payload.is_overnight === 'true' || payload.is_overnight === true);
  const overnightNights = isOvernight ? Math.max(1, Number.parseInt(payload.overnight_nights, 10) || 1) : 0;
  const passengersCount = Math.max(1, Number.parseInt(payload.passengers_count, 10) || Number.parseInt(spec.passengers_count, 10) || 1);
  const stand = payload.parking_location || spec.allocated_stand || 'STAND 01';

  let evidencePhotoUrl = null;
  if (file) {
    const rawPath = file.secure_url || file.path || '';
    evidencePhotoUrl = rawPath ? rawPath.replaceAll('\\', '/') : null;
  }

  // Cari ID tipe pesawat untuk kalkulasi tax akurat
  let aircraftTypeId = null;
  if (spec.aircraft_id) {
    const aircraft = await prisma.aircrafts.findUnique({ where: { id: Number(spec.aircraft_id) } });
    if (aircraft?.aircraft_type_id) {
      aircraftTypeId = aircraft.aircraft_type_id;
    }
  }

  // Hitung simulasi tax resmi berdasarkan master_taxes
  const taxResult = await calculateMiniAirportTaxes({
    aircraft_type_id: aircraftTypeId,
    aircraft_type_name: spec.aircraft_type || '',
    passengers_count: passengersCount,
    is_overnight: isOvernight,
    overnight_nights: overnightNights
  });

  const notesData = {
    service_type: 'Mini Airport',
    application_id: app.id,
    application_number: app.application_number,
    airport_id: spec.airport_id || null,
    airport_name: spec.airport_name || 'Mini Airport Perintis',
    airport_code: spec.airport_code || '',
    airport_location: spec.airport_location || '',
    registration_number: regNumber,
    aircraft_type: spec.aircraft_type || 'Pesawat Perintis',
    aircraft_type_id: aircraftTypeId,
    passengers_count: passengersCount,
    is_overnight: isOvernight,
    overnight_nights: overnightNights,
    allocated_stand: stand,
    remarks: payload.remarks || payload.notes || '',
    estimated_taxes: taxResult.taxes,
    estimated_total: taxResult.totalAmount
  };

  // Pastikan contract_id terhubung ke Kontrak Payung tenant
  let contractId = app.contract_id;
  if (!contractId) {
    const activePayung = await prisma.contracts.findFirst({
      where: {
        tenant_id: app.tenant_id,
        contract_type: 'Payung',
        status: { in: ['Aktif', 'Active'] }
      },
      orderBy: { created_at: 'desc' }
    });
    if (activePayung) contractId = activePayung.id;
  }

  const newLog = await prisma.operational_logs.create({
    data: {
      registration_number: regNumber,
      tenant_id: app.tenant_id,
      asset_id: null,
      contract_id: contractId,
      application_id: app.id,
      entry_time: rawEntryTime,
      exit_time: rawExitTime,
      is_overnight: isOvernight,
      parking_location: `${stand} - ${spec.airport_name || 'Mini Airport'}`,
      evidence_photo: evidencePhotoUrl,
      notes: JSON.stringify(notesData),
      officer_id: Number.parseInt(officerId, 10),
      billing_status: 'Unbilled',
      amount: taxResult.totalAmount
    },
    include: {
      tenants: true,
      officer: { select: { id: true, username: true } },
      rental_applications: true,
      contracts: true
    }
  });

  // Perbarui status permohonan menjadi 'Telah Mendarat' agar keluar dari daftar rencana masuk
  await prisma.rental_applications.update({
    where: { id: app.id },
    data: { status: 'Telah Mendarat' }
  });

  return newLog;
};

// 3. Ambil daftar log Mini Airport yang berstatus Unbilled (Hanya yang SUDAH CHECKOUT oleh Petugas Lapangan, Siap Diterbitkan SKRD oleh Dinas)
exports.getUnbilledMiniAirportLogs = async (user = null) => {
  const logs = await prisma.operational_logs.findMany({
    where: {
      billing_status: 'Unbilled',
      exit_time: { not: null }, // Hanya log yang sudah checkout oleh Petugas Lapangan
      OR: [
        { rental_applications: { application_type: 'Mini Airport' } },
        { notes: { contains: 'Mini Airport' } }
      ]
    },
    include: {
      tenants: true,
      officer: { select: { id: true, username: true } },
      rental_applications: true,
      contracts: true
    },
    orderBy: { entry_time: 'desc' }
  });

  const formatted = await Promise.all(logs.map(async log => {
    let parsedNotes = {};
    if (typeof log.notes === 'string') {
      try { parsedNotes = JSON.parse(log.notes); } catch (e) { parsedNotes = {}; }
    }

    // Re-calculate live tax to guarantee latest tariff values
    const taxCalc = await calculateMiniAirportTaxes({
      aircraft_type_id: parsedNotes.aircraft_type_id || null,
      aircraft_type_name: parsedNotes.aircraft_type || '',
      passengers_count: parsedNotes.passengers_count || 1,
      is_overnight: log.is_overnight,
      overnight_nights: parsedNotes.overnight_nights || 1
    });

    return {
      log_id: log.id,
      application_id: log.application_id,
      application_number: log.rental_applications?.application_number || parsedNotes.application_number || '-',
      tenant_name: log.tenants?.nama_perusahaan || 'Mitra Maskapai',
      tenant_id: log.tenant_id,
      contract_id: log.contract_id,
      contract_number: log.contracts?.contract_number || '-',
      registration_number: log.registration_number,
      aircraft_type: parsedNotes.aircraft_type || '-',
      airport_id: parsedNotes.airport_id || null,
      airport_name: parsedNotes.airport_name || 'Mini Airport Perintis',
      airport_code: parsedNotes.airport_code || '-',
      parking_location: log.parking_location,
      entry_time: log.entry_time,
      exit_time: log.exit_time,
      is_overnight: log.is_overnight,
      overnight_nights: parsedNotes.overnight_nights || (log.is_overnight ? 1 : 0),
      passengers_count: parsedNotes.passengers_count || 1,
      evidence_photo: log.evidence_photo,
      officer_name: log.officer?.username || 'Petugas Lapangan',
      remarks: parsedNotes.remarks || '',
      taxes: taxCalc.taxes,
      total_amount: taxCalc.totalAmount,
      raw_app_spec: log.rental_applications?.specific_needs
    };
  }));

  if (user?.mini_airport_id) {
    const targetMiniId = Number(user.mini_airport_id);
    return formatted.filter(item => {
      let spec = item.raw_app_spec;
      if (typeof spec === 'string') {
        try { spec = JSON.parse(spec); } catch (e) { spec = {}; }
      }
      const mId = item.airport_id || spec?.mini_airport_id || spec?.airport_id;
      return Number(mId) === targetMiniId;
    });
  }

  return formatted;
};

// 4. Ambil semua riwayat log Mini Airport (untuk monitoring Petugas & Admin)
exports.getAllMiniAirportLogs = async (user = null) => {
  const logs = await prisma.operational_logs.findMany({
    where: {
      OR: [
        { rental_applications: { application_type: { contains: 'Mini', mode: 'insensitive' } } },
        { notes: { contains: 'Mini', mode: 'insensitive' } }
      ]
    },
    include: {
      tenants: true,
      officer: { select: { id: true, username: true } },
      rental_applications: true,
      contracts: true,
      invoices: true
    },
    orderBy: { entry_time: 'desc' }
  });

  const parsed = logs.map(log => {
    let parsedNotes = {};
    if (typeof log.notes === 'string') {
      try { parsedNotes = JSON.parse(log.notes); } catch (e) { parsedNotes = {}; }
    }
    return {
      ...log,
      parsedNotes
    };
  });

  if (user?.mini_airport_id) {
    const targetMiniId = Number(user.mini_airport_id);
    return parsed.filter(l => {
      let spec = l.rental_applications?.specific_needs;
      if (typeof spec === 'string') {
        try { spec = JSON.parse(spec); } catch (e) { spec = {}; }
      }
      const mId = l.parsedNotes?.mini_airport_id || l.parsedNotes?.airport_id || spec?.mini_airport_id || spec?.airport_id;
      return Number(mId) === targetMiniId;
    });
  }

  return parsed;
};

// 5. Petugas Lapangan melakukan checkout armada (lepas landas)
exports.checkoutMiniAirportLog = async (logId, officerId, payload, file) => {
  const log = await prisma.operational_logs.findUnique({
    where: { id: Number.parseInt(logId, 10) }
  });

  if (!log) {
    throw new Error('Log pendaratan Mini Airport tidak ditemukan');
  }

  if (log.exit_time) {
    throw new Error('Armada ini sudah di-checkout sebelumnya');
  }

  let parsedNotes = {};
  if (typeof log.notes === 'string') {
    try { parsedNotes = JSON.parse(log.notes); } catch (e) { parsedNotes = {}; }
  }

  const exitTime = payload.exit_time ? new Date(payload.exit_time) : new Date();
  const entryDate = new Date(log.entry_time);

  // Aturan Batas Jam 17:00 (5 Sore):
  // Jika checkout beda hari atau checkout jam >= 17 (setelah jam 5 sore), otomatis masuk kategori Menginap (RON)
  const isDifferentDay = exitTime.toDateString() !== entryDate.toDateString();
  const isPast17 = exitTime.getHours() >= 17;
  const autoIsOvernight = isDifferentDay || isPast17;

  const isOvernight = payload.is_overnight !== undefined 
    ? Boolean(payload.is_overnight === 'true' || payload.is_overnight === true) 
    : autoIsOvernight;

  let autoNights = 0;
  if (isOvernight) {
    if (isDifferentDay) {
      const diffDays = Math.max(1, Math.round((exitTime - entryDate) / (1000 * 60 * 60 * 24)));
      autoNights = diffDays;
    } else {
      autoNights = 1;
    }
  }

  const overnightNights = isOvernight 
    ? Math.max(1, Number.parseInt(payload.overnight_nights, 10) || autoNights || 1) 
    : 0;
  const passengersCount = payload.passengers_count 
    ? Math.max(1, Number.parseInt(payload.passengers_count, 10)) 
    : (parsedNotes.passengers_count || 1);

  let exitPhotoUrl = parsedNotes.exit_photo || null;
  if (file) {
    const rawPath = file.secure_url || file.path || '';
    exitPhotoUrl = rawPath ? rawPath.replaceAll('\\', '/') : null;
  }

  // Hitung ulang simulasi tax resmi berdasarkan realisasi final saat checkout
  const taxResult = await calculateMiniAirportTaxes({
    aircraft_type_id: parsedNotes.aircraft_type_id || null,
    aircraft_type_name: parsedNotes.aircraft_type || '',
    passengers_count: passengersCount,
    is_overnight: isOvernight,
    overnight_nights: overnightNights
  });

  parsedNotes.checkout_at = exitTime.toISOString();
  parsedNotes.checkout_by = officerId;
  parsedNotes.exit_photo = exitPhotoUrl;
  parsedNotes.passengers_count = passengersCount;
  parsedNotes.is_overnight = isOvernight;
  parsedNotes.overnight_nights = overnightNights;
  parsedNotes.checkout_remarks = payload.remarks || payload.checkout_notes || '';
  parsedNotes.final_taxes = taxResult.taxes;
  parsedNotes.final_total = taxResult.totalAmount;

  const updatedLog = await prisma.operational_logs.update({
    where: { id: Number.parseInt(logId, 10) },
    data: {
      exit_time: exitTime,
      is_overnight: isOvernight,
      amount: taxResult.totalAmount,
      notes: JSON.stringify(parsedNotes)
    },
    include: {
      tenants: true,
      officer: { select: { id: true, username: true } },
      rental_applications: true,
      contracts: true
    }
  });

  return updatedLog;
};

