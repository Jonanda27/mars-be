const prisma = require('../config/db');

exports.fetchAssets = async (airportId) => {
  let whereClause = {};
  if (airportId) {
    whereClause = { airport_id: parseInt(airportId) };
  }
  return await prisma.assets.findMany({
    where: whereClause,
    include: { master_tariffs: true, airports: true, zones: true },
    orderBy: { id: 'asc' }
  });
};

exports.fetchAssetById = async (id) => {
  const asset = await prisma.assets.findUnique({
    where: { id: parseInt(id) },
    include: { master_tariffs: true, airports: true, zones: true }
  });
  if (!asset) throw new Error('Asset not found');
  return asset;
};

exports.addAsset = async (assetData) => {
  return await prisma.assets.create({
    data: assetData
  });
};

exports.updateAsset = async (id, assetData) => {
  return await prisma.assets.update({
    where: { id: parseInt(id) },
    data: assetData
  });
};

exports.deleteAsset = async (id) => {
  return await prisma.assets.delete({
    where: { id: parseInt(id) }
  });
};
