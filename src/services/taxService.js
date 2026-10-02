const prisma = require('../config/db');

const getAllTaxes = async (filters = {}) => {
  const where = {};
  if (filters.kategori) {
    where.kategori = filters.kategori;
  }
  if (filters.status) {
    where.status = filters.status;
  }

  return await prisma.master_taxes.findMany({
    where,
    include: {
      aircraft_types: true
    },
    orderBy: { id: 'asc' }
  });
};

const getTaxById = async (id) => {
  const tax = await prisma.master_taxes.findUnique({
    where: { id: Number.parseInt(id, 10) },
    include: {
      aircraft_types: true
    }
  });
  if (!tax) throw new Error('Master Tax not found');
  return tax;
};

const createTax = async (data) => {
  const {
    kode_tax,
    nama_tax,
    kategori,
    aircraft_type_id,
    satuan,
    tarif,
    tipe_tarif,
    persentase,
    dasar_hukum,
    deskripsi,
    status
  } = data;

  const existing = await prisma.master_taxes.findUnique({
    where: { kode_tax }
  });

  if (existing) {
    throw new Error('Kode Tax already exists');
  }

  return await prisma.master_taxes.create({
    data: {
      kode_tax,
      nama_tax,
      kategori,
      aircraft_type_id: aircraft_type_id ? Number.parseInt(aircraft_type_id, 10) : null,
      satuan,
      tarif: Number.parseFloat(tarif),
      tipe_tarif: tipe_tarif || 'Fixed',
      persentase: persentase ? Number.parseFloat(persentase) : null,
      dasar_hukum,
      deskripsi,
      status: status || 'Active'
    }
  });
};

const updateTax = async (id, data) => {
  const {
    kode_tax,
    nama_tax,
    kategori,
    aircraft_type_id,
    satuan,
    tarif,
    tipe_tarif,
    persentase,
    dasar_hukum,
    deskripsi,
    status
  } = data;

  return await prisma.master_taxes.update({
    where: { id: Number.parseInt(id, 10) },
    data: {
      kode_tax,
      nama_tax,
      kategori,
      aircraft_type_id: aircraft_type_id ? Number.parseInt(aircraft_type_id, 10) : null,
      satuan,
      tarif: tarif !== undefined ? Number.parseFloat(tarif) : undefined,
      tipe_tarif,
      persentase: persentase !== undefined ? (persentase ? Number.parseFloat(persentase) : null) : undefined,
      dasar_hukum,
      deskripsi,
      status,
      updated_at: new Date()
    }
  });
};

const deleteTax = async (id) => {
  return await prisma.master_taxes.delete({
    where: { id: Number.parseInt(id, 10) }
  });
};

module.exports = {
  getAllTaxes,
  getTaxById,
  createTax,
  updateTax,
  deleteTax
};
