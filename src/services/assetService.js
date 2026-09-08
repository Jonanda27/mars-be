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

exports.getHangarCapacity = async (assetId) => {
  const asset = await prisma.assets.findUnique({ where: { id: parseInt(assetId) } });
  if (!asset) throw new Error('Asset not found');

  if (asset.jenis_aset !== 'Hanggar') {
    return {
      isHangar: false,
      totalArea: parseFloat(asset.luas || 0),
      usedArea: 0,
      remainingArea: parseFloat(asset.luas || 0)
    };
  }

  // Hitung kapasitas yang sudah terpakai dari permohonan sewa (booking) yang berstatus Approved
  const activeApplications = await prisma.rental_applications.findMany({
    where: {
      asset_id: parseInt(assetId),
      status: 'Approved',
      // Opsional: hanya hitung yang end_date nya masih aktif / belum lewat
      end_date: {
        gte: new Date()
      }
    }
  });

  let usedArea = 0;
  for (const app of activeApplications) {
    if (app.specific_needs && Array.isArray(app.specific_needs.aircraft_details)) {
      for (const detail of app.specific_needs.aircraft_details) {
        const aircraftType = await prisma.aircraft_types.findUnique({
          where: { id: parseInt(detail.aircraft_type_id) }
        });
        if (aircraftType) {
          usedArea += parseFloat(aircraftType.luas_efektif_m2 || 0);
        }
      }
    } else if (app.specific_needs && Array.isArray(app.specific_needs.aircraft_ids)) {
      // Fallback for old data
      for (const acId of app.specific_needs.aircraft_ids) {
        const aircraft = await prisma.aircrafts.findUnique({
          where: { id: parseInt(acId) },
          include: { aircraft_types: true }
        });
        if (aircraft && aircraft.aircraft_types) {
          usedArea += parseFloat(aircraft.aircraft_types.luas_efektif_m2 || 0);
        }
      }
    }
  }

  const totalArea = parseFloat(asset.luas || 0);
  const remainingArea = totalArea - usedArea;

  return {
    isHangar: true,
    totalArea,
    usedArea,
    remainingArea
  };
};
