const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getAllTariffs = async () => {
  return await prisma.master_tariffs.findMany({
    orderBy: { id: 'asc' }
  });
};

const getTariffById = async (id) => {
  const tariff = await prisma.master_tariffs.findUnique({
    where: { id: parseInt(id) }
  });
  if (!tariff) throw new Error('Tariff not found');
  return tariff;
};

const createTariff = async (data) => {
  const { kode_tarif, jenis_layanan, objek, satuan, tarif, dasar_hukum, valid_from, valid_to, status } = data;
  
  const existing = await prisma.master_tariffs.findUnique({
    where: { kode_tarif }
  });

  if (existing) {
    throw new Error('Kode Tarif already exists');
  }

  return await prisma.master_tariffs.create({
    data: {
      kode_tarif,
      jenis_layanan,
      objek,
      satuan,
      tarif: parseFloat(tarif),
      dasar_hukum,
      valid_from: valid_from ? new Date(valid_from) : null,
      valid_to: valid_to ? new Date(valid_to) : null,
      status: status || 'Active'
    }
  });
};

const updateTariff = async (id, data) => {
  const { kode_tarif, jenis_layanan, objek, satuan, tarif, dasar_hukum, valid_from, valid_to, status } = data;

  return await prisma.master_tariffs.update({
    where: { id: parseInt(id) },
    data: {
      kode_tarif,
      jenis_layanan,
      objek,
      satuan,
      tarif: tarif ? parseFloat(tarif) : undefined,
      dasar_hukum,
      valid_from: valid_from ? new Date(valid_from) : null,
      valid_to: valid_to ? new Date(valid_to) : null,
      status,
      updated_at: new Date()
    }
  });
};

const deleteTariff = async (id) => {
  return await prisma.master_tariffs.delete({
    where: { id: parseInt(id) }
  });
};

module.exports = {
  getAllTariffs,
  getTariffById,
  createTariff,
  updateTariff,
  deleteTariff
};
