const prisma = require('../config/db');

exports.fetchAircrafts = async () => {
  return await prisma.aircrafts.findMany({
    orderBy: { created_at: 'desc' }
  });
};

exports.fetchAircraftTypes = async () => {
  return await prisma.aircraft_types.findMany();
};

exports.fetchAircraftsByTenant = async (tenantId) => {
  return await prisma.aircrafts.findMany({
    where: { tenant_id: tenantId },
    include: {
      assets: true,
      aircraft_types: true
    },
    orderBy: { created_at: 'desc' }
  });
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
