const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getAllZones = async (airport_id) => {
  const where = {};
  if (airport_id) {
    where.airport_id = parseInt(airport_id);
  }
  
  return await prisma.zones.findMany({
    where,
    include: {
      airports: true
    }
  });
};

const getZoneById = async (id) => {
  const zone = await prisma.zones.findUnique({
    where: { id: parseInt(id) },
    include: {
      airports: true
    }
  });
  if (!zone) throw new Error('Zone not found');
  return zone;
};

const createZone = async (data) => {
  const { airport_id, kode_zona, nama_zona, tipe_zona, deskripsi } = data;
  
  const existing = await prisma.zones.findUnique({
    where: { kode_zona }
  });

  if (existing) {
    throw new Error('Kode Zona already exists');
  }

  return await prisma.zones.create({
    data: {
      airport_id: parseInt(airport_id),
      kode_zona,
      nama_zona,
      tipe_zona,
      deskripsi
    }
  });
};

const updateZone = async (id, data) => {
  const { airport_id, kode_zona, nama_zona, tipe_zona, deskripsi } = data;
  return await prisma.zones.update({
    where: { id: parseInt(id) },
    data: {
      airport_id: airport_id ? parseInt(airport_id) : undefined,
      kode_zona,
      nama_zona,
      tipe_zona,
      deskripsi,
      updated_at: new Date()
    }
  });
};

const deleteZone = async (id) => {
  return await prisma.zones.delete({
    where: { id: parseInt(id) }
  });
};

module.exports = {
  getAllZones,
  getZoneById,
  createZone,
  updateZone,
  deleteZone
};
