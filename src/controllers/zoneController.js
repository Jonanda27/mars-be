const zoneService = require('../services/zoneService');

const getAllZones = async (req, res, next) => {
  try {
    const { airport_id } = req.query;
    const zones = await zoneService.getAllZones(airport_id);
    res.json({
      status: 'success',
      data: zones
    });
  } catch (error) {
    next(error);
  }
};

const getZoneById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const zone = await zoneService.getZoneById(id);
    res.json({
      status: 'success',
      data: zone
    });
  } catch (error) {
    if (error.message === 'Zone not found') {
      return res.status(404).json({ status: 'error', message: error.message });
    }
    next(error);
  }
};

const createZone = async (req, res, next) => {
  try {
    const newZone = await zoneService.createZone(req.body);
    res.status(201).json({
      status: 'success',
      data: newZone
    });
  } catch (error) {
    if (error.message === 'Kode Zona already exists') {
      return res.status(400).json({ status: 'error', message: error.message });
    }
    next(error);
  }
};

const updateZone = async (req, res, next) => {
  try {
    const { id } = req.params;
    const zone = await zoneService.updateZone(id, req.body);
    res.json({
      status: 'success',
      data: zone
    });
  } catch (error) {
    next(error);
  }
};

const deleteZone = async (req, res, next) => {
  try {
    const { id } = req.params;
    await zoneService.deleteZone(id);
    res.json({
      status: 'success',
      message: 'Zone deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllZones,
  getZoneById,
  createZone,
  updateZone,
  deleteZone
};
