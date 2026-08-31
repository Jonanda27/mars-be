const prisma = require('../config/db');

exports.fetchAircrafts = async () => {
  return await prisma.aircrafts.findMany({
    orderBy: { created_at: 'desc' }
  });
};

exports.fetchAircraftsByTenant = async (tenantId) => {
  return await prisma.aircrafts.findMany({
    where: { tenant_id: tenantId },
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
  const { registration_number, aircraft_type, mtow, status, tenant_id, foto, capacity } = data;
  return await prisma.aircrafts.create({
    data: {
      registration_number,
      aircraft_type,
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

  const { registration_number, aircraft_type, mtow, capacity, foto } = data;
  
  const updateData = {};
  if (registration_number) updateData.registration_number = registration_number;
  if (aircraft_type) updateData.aircraft_type = aircraft_type;
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
