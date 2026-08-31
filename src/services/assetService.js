const prisma = require('../config/db');

exports.fetchAssets = async () => {
  return await prisma.assets.findMany({
    include: { master_tariffs: true },
    orderBy: { id: 'asc' }
  });
};

exports.fetchAssetById = async (id) => {
  const asset = await prisma.assets.findUnique({
    where: { id: parseInt(id) },
    include: { master_tariffs: true }
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
