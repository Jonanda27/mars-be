const prisma = require('../config/db');

// Helper: Generate Schedule Number: SCH/YYYY/MM/XXXX
const generateScheduleNumber = async () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');

  const countThisMonth = await prisma.flight_schedules.count({
    where: {
      created_at: {
        gte: new Date(year, date.getMonth(), 1),
        lt: new Date(year, date.getMonth() + 1, 1)
      }
    }
  });

  const nextSeq = String(countThisMonth + 1).padStart(4, '0');
  return `SCH/${year}/${month}/${nextSeq}`;
};

/**
 * 1. Pengajuan Jadwal Pemakaian Hanggar oleh Tenant (Sewaktu-waktu)
 * Syarat Mutlak: Tenant wajib memiliki Kontrak Payung aktif dan belum Expired.
 * Armada wajib dipilih dari armada resmi yang terdaftar di bawah naungan tenant.
 */
exports.createSchedule = async (tenantId, payload, fileUrl) => {
  const parsedTenantId = Number.parseInt(tenantId, 10);

  // 1. Validasi Kontrak Payung Aktif & Belum Expired
  const activePayung = await prisma.contracts.findFirst({
    where: {
      tenant_id: parsedTenantId,
      contract_type: 'Payung',
      status: { in: ['Aktif', 'Active'] }
    },
    include: {
      assets: true,
      rental_applications: {
        where: { application_type: 'Sewa Hanggar' },
        orderBy: { id: 'desc' }
      }
    },
    orderBy: { id: 'desc' }
  });

  if (!activePayung) {
    throw new Error('Anda belum memiliki Kontrak Payung (PKS Induk) yang aktif. Silakan ajukan Kontrak Payung terlebih dahulu.');
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (activePayung.end_date && new Date(activePayung.end_date) < today) {
    throw new Error(`Masa berlaku Kontrak Payung Anda telah berakhir pada ${new Date(activePayung.end_date).toLocaleDateString('id-ID')}. Silakan lakukan perpanjangan Kontrak Payung terlebih dahulu.`);
  }

  // 2. Validasi Armada Pesawat
  if (!payload.aircraft_id && !payload.registration_number) {
    throw new Error('Pilih armada pesawat terdaftar milik maskapai Anda');
  }

  let selectedAircraft = null;
  if (payload.aircraft_id) {
    selectedAircraft = await prisma.aircrafts.findFirst({
      where: {
        id: Number.parseInt(payload.aircraft_id, 10),
        tenant_id: parsedTenantId
      },
      include: {
        aircraft_types: true
      }
    });

    if (!selectedAircraft) {
      throw new Error('Armada pesawat yang dipilih tidak terdaftar di bawah naungan akun maskapai Anda');
    }
  }

  const regNumber = selectedAircraft ? selectedAircraft.registration_number : payload.registration_number.toUpperCase().trim();
  const aircraftType = selectedAircraft?.aircraft_types?.jenis_pesawat || payload.aircraft_type || 'Standar';

  // 3. Periode Layanan Sewa Hanggar (Murni dari Tanggal yang Dipilih saat Step Pilih Layanan Permohonan Sewa, BUKAN Masa Kontrak Payung 1 Tahun)
  const arrivalDate = new Date(payload.estimated_arrival);
  if (isNaN(arrivalDate.getTime())) {
    throw new Error('Format tanggal dan jam estimasi kedatangan tidak valid');
  }

  // Cari rental_application Sewa Hanggar aktif untuk tenant ini
  let hanggarApp = activePayung.rental_applications?.[0];
  if (!hanggarApp || !hanggarApp.start_date || !hanggarApp.end_date) {
    hanggarApp = await prisma.rental_applications.findFirst({
      where: {
        tenant_id: parsedTenantId,
        application_type: 'Sewa Hanggar',
        start_date: { not: null },
        end_date: { not: null }
      },
      orderBy: { id: 'desc' }
    });
  }

  if (!hanggarApp || !hanggarApp.start_date || !hanggarApp.end_date) {
    throw new Error('Periode sewa hanggar belum ditentukan pada permohonan sewa. Silakan tentukan periode sewa pada menu Permohonan Sewa terlebih dahulu.');
  }

  const serviceStartDate = hanggarApp.start_date;
  const serviceEndDate = hanggarApp.end_date;

  const serviceStart = new Date(serviceStartDate);
  serviceStart.setHours(0, 0, 0, 0);
  const serviceEnd = new Date(serviceEndDate);
  serviceEnd.setHours(23, 59, 59, 999);

  const startFormatted = serviceStart.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const endFormatted = serviceEnd.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  if (arrivalDate < serviceStart || arrivalDate > serviceEnd) {
    throw new Error(`Waktu kedatangan wajib berada dalam periode sewa hanggar yang dipilih (${startFormatted} s/d ${endFormatted})`);
  }

  let departureDate = payload.estimated_departure ? new Date(payload.estimated_departure) : null;
  let estimatedNights = 1;

  if (departureDate && !isNaN(departureDate.getTime())) {
    if (departureDate < arrivalDate) {
      throw new Error('Waktu estimasi keberangkatan harus setelah waktu kedatangan');
    }

    if (departureDate > serviceEnd) {
      throw new Error(`Waktu keberangkatan melebihi batas akhir periode sewa hanggar (${endFormatted})`);
    }

    const diffTime = Math.abs(departureDate.getTime() - arrivalDate.getTime());
    estimatedNights = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }

  const scheduleNumber = await generateScheduleNumber();

  const newSchedule = await prisma.flight_schedules.create({
    data: {
      schedule_number: scheduleNumber,
      tenant_id: parsedTenantId,
      contract_id: activePayung.id,
      aircraft_id: selectedAircraft ? selectedAircraft.id : null,
      registration_number: regNumber,
      aircraft_type: aircraftType,
      parking_location: payload.parking_location || 'Hanggar',
      purpose: payload.purpose || 'Inap Reguler / RON',
      estimated_arrival: arrivalDate,
      estimated_departure: departureDate,
      estimated_nights: estimatedNights,
      notes: payload.notes || null,
      flight_plan_url: fileUrl || null,
      status: 'Menunggu Verifikasi Petugas'
    },
    include: {
      aircraft: true,
      contract: true,
      tenant: true
    }
  });

  return newSchedule;
};

// 2. Ambil Riwayat Jadwal Milik Tenant
exports.getTenantSchedules = async (tenantId) => {
  return await prisma.flight_schedules.findMany({
    where: { tenant_id: Number.parseInt(tenantId, 10) },
    include: {
      aircraft: true,
      contract: true,
      verified_by_officer: {
        select: { username: true, role: true }
      }
    },
    orderBy: { created_at: 'desc' }
  });
};

// 3. Ambil Seluruh Jadwal (Untuk Petugas Lapangan & Admin)
exports.getAllSchedules = async (filters = {}) => {
  const where = {};
  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.tenant_id) {
    where.tenant_id = Number.parseInt(filters.tenant_id, 10);
  }
  if (filters.parking_location) {
    where.parking_location = filters.parking_location;
  }

  return await prisma.flight_schedules.findMany({
    where,
    include: {
      tenant: {
        select: { nama_perusahaan: true, tenant_id_str: true }
      },
      aircraft: true,
      contract: true,
      verified_by_officer: {
        select: { username: true }
      }
    },
    orderBy: { created_at: 'desc' }
  });
};

// 4. Verifikasi Izin Masuk oleh Petugas Lapangan
exports.verifyScheduleByOfficer = async (scheduleId, officerId, data) => {
  const sId = Number.parseInt(scheduleId, 10);
  const { status, parking_location, officer_notes } = data;

  if (!['Disetujui', 'Ditolak'].includes(status)) {
    throw new Error('Status verifikasi hanya boleh "Disetujui" atau "Ditolak"');
  }

  const schedule = await prisma.flight_schedules.findUnique({
    where: { id: sId },
    include: { tenant: true }
  });

  if (!schedule) {
    throw new Error('Data pengajuan jadwal tidak ditemukan');
  }

  const updatedSchedule = await prisma.flight_schedules.update({
    where: { id: sId },
    data: {
      status,
      parking_location: parking_location || schedule.parking_location,
      officer_notes: officer_notes || null,
      verified_by_officer_id: Number.parseInt(officerId, 10),
      verified_at: new Date()
    },
    include: {
      tenant: true,
      aircraft: true,
      verified_by_officer: { select: { username: true } }
    }
  });

  return updatedSchedule;
};

// 5. Ambil Daftar Rencana Kedatangan Hari Ini (Disetujui & Siap Check-In)
exports.getTodayExpectedArrivals = async () => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  return await prisma.flight_schedules.findMany({
    where: {
      status: 'Disetujui'
    },
    include: {
      tenant: {
        select: { nama_perusahaan: true }
      },
      aircraft: true,
      contract: true
    },
    orderBy: { estimated_arrival: 'asc' }
  });
};

// 6. Check-In Kedatangan Langsung dari Jadwal yang Disetujui
exports.checkInFromSchedule = async (scheduleId, officerId, payload = {}) => {
  const sId = Number.parseInt(scheduleId, 10);
  const schedule = await prisma.flight_schedules.findUnique({
    where: { id: sId },
    include: { tenant: true, contract: true }
  });

  if (!schedule) {
    throw new Error('Jadwal tidak ditemukan');
  }

  if (schedule.status !== 'Disetujui') {
    throw new Error(`Jadwal berstatus "${schedule.status}". Hanya jadwal yang "Disetujui" yang dapat di-check in.`);
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. Buat log operasional masuk
    const newLog = await tx.operational_logs.create({
      data: {
        registration_number: schedule.registration_number,
        tenant_id: schedule.tenant_id,
        contract_id: schedule.contract_id,
        schedule_id: schedule.id,
        parking_location: payload.parking_location || schedule.parking_location || 'Hanggar',
        entry_time: new Date(),
        officer_id: Number.parseInt(officerId, 10),
        billing_status: 'Unbilled',
        notes: payload.notes || schedule.notes || `Check-In dari Jadwal No. ${schedule.schedule_number}`
      }
    });

    // 2. Update status jadwal menjadi 'Checked-In'
    await tx.flight_schedules.update({
      where: { id: schedule.id },
      data: {
        status: 'Checked-In'
      }
    });

    return newLog;
  });

  return result;
};
