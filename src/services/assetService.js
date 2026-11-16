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

exports.getHangarCapacity = async (assetId, excludeApplicationId = null) => {
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

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const whereClause = {
    asset_id: parseInt(assetId),
    status: {
      in: [
        'Aktif',
        'Active',
        'Approved',
        'Disetujui',
        'Signed',
        'Draft Kontrak',
        'Menunggu Validasi Admin',
        'Menunggu Persetujuan Kadis',
        'Menunggu TTD Kontrak Payung',
        'Menunggu Pengesahan Kadis'
      ]
    },
    OR: [
      { end_date: null },
      { end_date: { gte: today } }
    ]
  };

  if (excludeApplicationId) {
    whereClause.id = { not: parseInt(excludeApplicationId) };
  }

  // Hitung kapasitas yang sudah terpakai dari permohonan sewa (booking) aktif
  const activeApplications = await prisma.rental_applications.findMany({
    where: whereClause
  });

  let usedArea = 0;
  for (const app of activeApplications) {
    const spec = typeof app.specific_needs === 'string'
      ? JSON.parse(app.specific_needs)
      : (app.specific_needs || {});

    if (Array.isArray(spec.aircraft_details)) {
      for (const detail of spec.aircraft_details) {
        if (detail.luas_efektif_m2) {
          usedArea += parseFloat(detail.luas_efektif_m2);
        } else if (detail.aircraft_type_id) {
          const aircraftType = await prisma.aircraft_types.findUnique({
            where: { id: parseInt(detail.aircraft_type_id) }
          });
          if (aircraftType && aircraftType.luas_efektif_m2) {
            usedArea += parseFloat(aircraftType.luas_efektif_m2);
          }
        }
      }
    } else if (Array.isArray(spec.aircraft_ids)) {
      for (const acId of spec.aircraft_ids) {
        const aircraft = await prisma.aircrafts.findUnique({
          where: { id: parseInt(acId) },
          include: { aircraft_types: true }
        });
        if (aircraft && aircraft.aircraft_types && aircraft.aircraft_types.luas_efektif_m2) {
          usedArea += parseFloat(aircraft.aircraft_types.luas_efektif_m2);
        }
      }
    }
  }

  const totalArea = parseFloat(asset.luas || 0);
  const remainingArea = Math.max(0, totalArea - usedArea);

  return {
    isHangar: true,
    totalArea,
    usedArea,
    remainingArea
  };
};

exports.getAssetCapacity = exports.getHangarCapacity;

