const prisma = require('../config/db');

const getAllAirports = async () => {
  return await prisma.airports.findMany({
    include: {
      zones: true
    }
  });
};

const getAirportById = async (id) => {
  const airport = await prisma.airports.findUnique({
    where: { id: Number.parseInt(id, 10) },
    include: {
      zones: true
    }
  });
  if (!airport) throw new Error('Airport not found');
  return airport;
};

const createAirport = async (data) => {
  const { kode_bandara, nama_bandara, lokasi, deskripsi } = data;
  
  const existing = await prisma.airports.findUnique({
    where: { kode_bandara }
  });

  if (existing) {
    throw new Error('Kode Bandara already exists');
  }

  return await prisma.airports.create({
    data: {
      kode_bandara,
      nama_bandara,
      lokasi,
      deskripsi
    }
  });
};

const updateAirport = async (id, data) => {
  const { kode_bandara, nama_bandara, lokasi, deskripsi } = data;
  return await prisma.airports.update({
    where: { id: Number.parseInt(id, 10) },
    data: {
      kode_bandara,
      nama_bandara,
      lokasi,
      deskripsi,
      updated_at: new Date()
    }
  });
};

const deleteAirport = async (id) => {
  return await prisma.airports.delete({
    where: { id: Number.parseInt(id, 10) }
  });
};

module.exports = {
  getAllAirports,
  getAirportById,
  createAirport,
  updateAirport,
  deleteAirport
};
