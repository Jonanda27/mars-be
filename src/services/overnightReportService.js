const prisma = require('../config/db');

/**
 * Get active checked-in aircrafts to populate today's overnight checklist (Opsi A)
 */
exports.getTodayDraftRoster = async (reportDateStr) => {
  const targetDate = reportDateStr ? new Date(reportDateStr) : new Date();

  // Find all active check-in logs where exit_time is null
  const activeLogs = await prisma.operational_logs.findMany({
    where: {
      exit_time: null
    },
    include: {
      tenants: {
        select: { id: true, nama_perusahaan: true, tenant_id_str: true }
      },
      contracts: true,
      rental_applications: {
        include: {
          assets: true
        }
      }
    },
    orderBy: { entry_time: 'desc' }
  });

  // Format into clean candidate roster
  const candidateRoster = activeLogs.map((log) => {
    let aircraftType = null;
    if (log.rental_applications?.specific_needs) {
      const spec = log.rental_applications.specific_needs;
      if (Array.isArray(spec.aircraft_details) && spec.aircraft_details.length > 0) {
        const found = spec.aircraft_details.find(
          (a) => (a.registration_number || '').toUpperCase() === log.registration_number.toUpperCase()
        );
        if (found) {
          aircraftType = found.custom_type_name || found.aircraft_types?.jenis_pesawat || found.aircraft_type;
        }
      }
    }

    return {
      operational_log_id: log.id,
      registration_number: log.registration_number,
      tenant_id: log.tenant_id,
      tenant_name: log.tenants?.nama_perusahaan || 'Maskapai / Penyewa',
      asset_id: log.asset_id,
      asset_name: log.rental_applications?.assets?.nama_aset || 'Hanggar Bandara',
      parking_location: log.parking_location || 'Hanggar',
      entry_time: log.entry_time,
      aircraft_type: aircraftType || 'Pesawat Operasional',
      is_adhoc: false,
      is_staying: true, // Default checked for active in-hangar planes
      initial_evidence_photo: log.evidence_photo || null
    };
  });

  // Check if a report for this date already exists
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const existingReport = await prisma.daily_overnight_reports.findFirst({
    where: {
      report_date: {
        gte: startOfDay,
        lte: endOfDay
      }
    },
    include: {
      officer: {
        select: { id: true, username: true, role: true }
      },
      items: {
        include: {
          tenant: true,
          asset: true
        }
      }
    }
  });

  return {
    report_date: targetDate.toISOString().split('T')[0],
    is_already_submitted: Boolean(existingReport),
    existing_report: existingReport || null,
    candidate_roster: candidateRoster
  };
};

/**
 * Submit daily overnight report with mandatory evidence photos
 */
exports.submitDailyOvernightReport = async (officerId, payload, filesMap) => {
  const { report_date, general_notes, items_json } = payload;
  const parsedItems = typeof items_json === 'string' ? JSON.parse(items_json) : (items_json || []);

  if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
    throw new Error('Minimal harus ada satu data armada pada laporan tutup hari.');
  }

  // Filter only items that are staying overnight
  const stayingItems = parsedItems.filter(item => item.is_staying !== false);

  if (stayingItems.length === 0) {
    throw new Error('Harap pilih minimal satu armada yang menginap malam ini, atau batalkan laporan jika tidak ada pesawat menginap.');
  }

  // Validate that every staying item has a photo (from filesMap or existing URL)
  for (let i = 0; i < stayingItems.length; i++) {
    const item = stayingItems[i];
    const fileKey = item.photo_key || `photo_${i}`;
    const uploadedFile = filesMap[fileKey];
    const photoUrl = uploadedFile ? (uploadedFile.path || uploadedFile.secure_url) : item.existing_photo;

    if (!photoUrl) {
      throw new Error(`Foto bukti fisik wajib diunggah untuk pesawat ${item.registration_number}.`);
    }

    item.resolved_photo_url = photoUrl;
  }

  const generalPhotoUrl = filesMap['general_photo'] ? (filesMap['general_photo'].path || filesMap['general_photo'].secure_url) : null;
  const targetDate = report_date ? new Date(report_date) : new Date();

  return await prisma.$transaction(async (tx) => {
    // 1. Create the master report
    const report = await tx.daily_overnight_reports.create({
      data: {
        report_date: targetDate,
        officer_id: Number.parseInt(officerId, 10),
        total_aircraft_staying: stayingItems.length,
        general_notes: general_notes || null,
        general_evidence_photo: generalPhotoUrl || null,
        status: 'Submitted'
      }
    });

    // 2. Create detail items
    const itemsData = stayingItems.map((item) => ({
      report_id: report.id,
      operational_log_id: item.operational_log_id ? Number.parseInt(item.operational_log_id, 10) : null,
      registration_number: item.registration_number.toUpperCase().trim(),
      tenant_id: item.tenant_id ? Number.parseInt(item.tenant_id, 10) : null,
      asset_id: item.asset_id ? Number.parseInt(item.asset_id, 10) : null,
      aircraft_type: item.aircraft_type || null,
      parking_location: item.parking_location || 'Hanggar',
      evidence_photo: item.resolved_photo_url,
      is_adhoc: Boolean(item.is_adhoc),
      notes: item.notes || null
    }));

    await tx.daily_overnight_items.createMany({
      data: itemsData
    });

    // 3. Update linked operational_logs
    for (const item of stayingItems) {
      if (item.operational_log_id) {
        await tx.operational_logs.update({
          where: { id: Number.parseInt(item.operational_log_id, 10) },
          data: {
            is_overnight: true
          }
        });
      }
    }

    // 4. Return the full report with items
    return await tx.daily_overnight_reports.findUnique({
      where: { id: report.id },
      include: {
        officer: {
          select: { id: true, username: true, role: true }
        },
        items: {
          include: {
            tenant: true,
            asset: true
          }
        }
      }
    });
  });
};

/**
 * Get all overnight reports with pagination / filters
 */
exports.getAllOvernightReports = async (filters = {}) => {
  const { start_date, end_date, officer_id } = filters;
  const whereClause = {};

  if (start_date && end_date) {
    whereClause.report_date = {
      gte: new Date(start_date),
      lte: new Date(end_date)
    };
  } else if (start_date) {
    whereClause.report_date = { gte: new Date(start_date) };
  } else if (end_date) {
    whereClause.report_date = { lte: new Date(end_date) };
  }

  if (officer_id) {
    whereClause.officer_id = Number.parseInt(officer_id, 10);
  }

  return await prisma.daily_overnight_reports.findMany({
    where: whereClause,
    include: {
      officer: {
        select: { id: true, username: true, role: true }
      },
      items: {
        include: {
          tenant: true,
          asset: true
        }
      }
    },
    orderBy: { report_date: 'desc' }
  });
};

/**
 * Get report by ID
 */
exports.getOvernightReportById = async (id) => {
  const report = await prisma.daily_overnight_reports.findUnique({
    where: { id: Number.parseInt(id, 10) },
    include: {
      officer: {
        select: { id: true, username: true, role: true }
      },
      items: {
        include: {
          tenant: true,
          asset: true,
          operational_log: true
        }
      }
    }
  });

  if (!report) {
    throw new Error('Laporan tutup hari tidak ditemukan.');
  }

  return report;
};
