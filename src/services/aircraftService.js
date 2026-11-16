const prisma = require('../config/db');

exports.fetchAircrafts = async () => {
  return await prisma.aircrafts.findMany({
    orderBy: { created_at: 'desc' }
  });
};

exports.fetchAircraftTypes = async () => {
  return await prisma.aircraft_types.findMany({
    include: { master_tariffs: true }
  });
};

exports.fetchAircraftsByTenant = async (tenantId, options = {}) => {
  const { onlyAvailable = false } = options;

  const aircrafts = await prisma.aircrafts.findMany({
    where: { tenant_id: tenantId },
    include: {
      assets: true,
      aircraft_types: {
        include: { master_tariffs: true }
      }
    },
    orderBy: { created_at: 'desc' }
  });

  // Ambil permohonan sewa aktif milik tenant (selain yang ditolak/batal/selesai/expired)
  const activeApplications = await prisma.rental_applications.findMany({
    where: {
      tenant_id: tenantId,
      status: {
        notIn: ['Ditolak', 'Rejected', 'Batal', 'Cancelled', 'Selesai', 'Expired']
      }
    },
    select: {
      id: true,
      application_number: true,
      status: true,
      asset_id: true,
      specific_needs: true
    }
  });

  // Peta ID dan Registrasi armada yang terikat pada permohonan sewa / mini airport aktif
  const tiedAircraftMap = new Map();
  const tiedRegMap = new Map();

  for (const app of activeApplications) {
    let spec = app.specific_needs;
    if (typeof spec === 'string') {
      try { spec = JSON.parse(spec); } catch (e) {}
    }
    if (spec) {
      // 1. Dukungan Mini Airport (Single aircraft_id & registration_number)
      if (spec.aircraft_id) {
        const parsedId = Number.parseInt(spec.aircraft_id, 10);
        if (!Number.isNaN(parsedId)) {
          tiedAircraftMap.set(parsedId, {
            appId: app.id,
            application_number: app.application_number,
            status: app.status
          });
        }
      }
      if (spec.registration_number) {
        tiedRegMap.set(spec.registration_number.trim().toUpperCase(), {
          appId: app.id,
          application_number: app.application_number,
          status: app.status
        });
      }

      // 2. Dukungan Sewa Hanggar Mozes Kilangin (Array aircraft_ids)
      if (Array.isArray(spec.aircraft_ids)) {
        for (const aid of spec.aircraft_ids) {
          const parsedId = Number.parseInt(aid, 10);
          if (!Number.isNaN(parsedId)) {
            tiedAircraftMap.set(parsedId, {
              appId: app.id,
              application_number: app.application_number,
              status: app.status
            });
          }
        }
      }
      if (Array.isArray(spec.aircraft_details)) {
        for (const detail of spec.aircraft_details) {
          const aid = detail.aircraft_id || detail.id;
          const parsedId = Number.parseInt(aid, 10);
          if (!Number.isNaN(parsedId)) {
            tiedAircraftMap.set(parsedId, {
              appId: app.id,
              application_number: app.application_number,
              status: app.status
            });
          }
        }
      }
    }
  }

  // Cek juga operational_logs aktif yang belum checkout (pesawat fisik masih di apron)
  const activeLogs = await prisma.operational_logs.findMany({
    where: {
      tenant_id: tenantId,
      exit_time: null
    },
    select: {
      id: true,
      registration_number: true,
      application_id: true,
      parking_location: true
    }
  });

  for (const log of activeLogs) {
    if (log.registration_number) {
      tiedRegMap.set(log.registration_number.trim().toUpperCase(), {
        appId: log.application_id,
        application_number: `LOG #${log.id}`,
        status: `Sedang di Stand (${log.parking_location || 'Apron'})`
      });
    }
  }

  // Jadwal penerbangan aktif
  const activeSchedules = await prisma.flight_schedules.findMany({
    where: {
      tenant_id: tenantId,
      status: {
        in: ['Checked-In', 'Disetujui', 'Menunggu Verifikasi']
      }
    },
    select: {
      id: true,
      schedule_number: true,
      aircraft_id: true,
      registration_number: true,
      status: true
    }
  });

  const scheduledAircraftSet = new Set(
    activeSchedules
      .filter(s => s.aircraft_id)
      .map(s => s.aircraft_id)
  );

  const enrichedAircrafts = aircrafts.map(ac => {
    const regUpper = (ac.registration_number || '').trim().toUpperCase();
    const tiedToApp = tiedAircraftMap.get(ac.id) || tiedRegMap.get(regUpper) || null;
    const hasActiveAsset = Boolean(ac.asset_id);
    const hasActiveSchedule = scheduledAircraftSet.has(ac.id);
    const isStatusInUse = ['in use', 'in-use', 'sedang digunakan', 'tersewa', 'maintenance', 'perawatan'].includes((ac.status || '').toLowerCase());

    const isUsed = Boolean(tiedToApp || hasActiveAsset || hasActiveSchedule || isStatusInUse);

    return {
      ...ac,
      is_tied_to_rental: Boolean(tiedToApp || hasActiveAsset),
      rental_application: tiedToApp,
      is_in_use: isUsed,
      is_available: !isUsed
    };
  });

  if (onlyAvailable) {
    return enrichedAircrafts.filter(ac => ac.is_available);
  }

  return enrichedAircrafts;
};

exports.fetchAircraftById = async (id) => {
  const aircraft = await prisma.aircrafts.findUnique({
    where: { id: parseInt(id) }
  });
  if (!aircraft) throw new Error('Aircraft not found');
  return aircraft;
};

exports.addAircraft = async (data) => {
  const { registration_number, aircraft_type_id, custom_type_name, custom_type_area, mtow, status, tenant_id, foto, capacity } = data;
  
  let final_aircraft_type_id = aircraft_type_id ? parseInt(aircraft_type_id) : null;
  
  if (custom_type_name) {
    const newType = await prisma.aircraft_types.create({
      data: {
        jenis_pesawat: custom_type_name,
        luas_efektif_m2: custom_type_area ? parseFloat(custom_type_area) : null
      }
    });
    final_aircraft_type_id = newType.id;
  }

  return await prisma.aircrafts.create({
    data: {
      registration_number,
      aircraft_type_id: final_aircraft_type_id,
      mtow: mtow ? parseFloat(mtow) : null,
      status: status || 'aktif',
      tenant_id: tenant_id ? parseInt(tenant_id) : null,
      capacity: capacity ? parseInt(capacity) : null,
      foto: foto || null
    }
  });
};

exports.updateAircraft = async (id, tenantId, data) => {
  const aircraft = await prisma.aircrafts.findUnique({ where: { id: parseInt(id) } });
  
  if (!aircraft) {
    const err = new Error('Pesawat tidak ditemukan');
    err.statusCode = 404;
    throw err;
  }
  
  if (aircraft.tenant_id !== tenantId) {
    const err = new Error('Anda tidak memiliki akses untuk mengubah data ini');
    err.statusCode = 403;
    throw err;
  }

  const { registration_number, aircraft_type_id, custom_type_name, custom_type_area, mtow, capacity, foto } = data;
  
  let final_aircraft_type_id = aircraft_type_id ? parseInt(aircraft_type_id) : undefined;
  
  if (custom_type_name) {
    const newType = await prisma.aircraft_types.create({
      data: {
        jenis_pesawat: custom_type_name,
        luas_efektif_m2: custom_type_area ? parseFloat(custom_type_area) : null
      }
    });
    final_aircraft_type_id = newType.id;
  }
  
  const updateData = {};
  if (registration_number) updateData.registration_number = registration_number;
  if (final_aircraft_type_id !== undefined) updateData.aircraft_type_id = final_aircraft_type_id;
  if (mtow !== undefined) updateData.mtow = mtow ? parseFloat(mtow) : null;
  if (capacity !== undefined) updateData.capacity = capacity ? parseInt(capacity) : null;
  if (foto !== undefined) updateData.foto = foto || null;

  return await prisma.aircrafts.update({
    where: { id: parseInt(id) },
    data: updateData
  });
};

exports.deleteAircraft = async (id, tenantId) => {
  const aircraft = await prisma.aircrafts.findUnique({ where: { id: parseInt(id) } });
  
  if (!aircraft) {
    const err = new Error('Pesawat tidak ditemukan');
    err.statusCode = 404;
    throw err;
  }
  
  if (aircraft.tenant_id !== tenantId) {
    const err = new Error('Anda tidak memiliki akses untuk menghapus data ini');
    err.statusCode = 403;
    throw err;
  }

  return await prisma.aircrafts.delete({
    where: { id: parseInt(id) }
  });
};
