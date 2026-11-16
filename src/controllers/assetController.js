const assetService = require('../services/assetService');
const { filterAssetsByScope } = require('../utils/adminScope');

exports.getAssets = async (req, res, next) => {
  try {
    let airportId = null;
    const role = (req.user?.role || '').toLowerCase();
    if (['admin', 'admin_hanggar', 'admin_apron', 'admin_ruangan'].includes(role)) {
      airportId = req.user.airport_id || 1;
    }
    const assets = await assetService.fetchAssets(airportId);
    const scopedAssets = filterAssetsByScope(assets, req.user);
    res.status(200).json({ success: true, data: scopedAssets });
  } catch (error) {
    next(error);
  }
};

exports.getAsset = async (req, res, next) => {
  try {
    const asset = await assetService.fetchAssetById(req.params.id);
    res.status(200).json({ success: true, data: asset });
  } catch (error) {
    error.statusCode = 404;
    next(error);
  }
};

exports.createAsset = async (req, res, next) => {
  try {
    const newAsset = await assetService.addAsset(req.body);
    res.status(201).json({ success: true, message: 'Asset created', data: newAsset });
  } catch (error) {
    next(error);
  }
};

exports.updateAsset = async (req, res, next) => {
  try {
    const updatedAsset = await assetService.updateAsset(req.params.id, req.body);
    res.status(200).json({ success: true, message: 'Asset updated', data: updatedAsset });
  } catch (error) {
    next(error);
  }
};

exports.deleteAsset = async (req, res, next) => {
  try {
    await assetService.deleteAsset(req.params.id);
    res.status(200).json({ success: true, message: 'Asset deleted' });
  } catch (error) {
    next(error);
  }
};

exports.getAssetCapacity = async (req, res, next) => {
  try {
    const { exclude_application_id } = req.query;
    const capacity = await assetService.getHangarCapacity(req.params.id, exclude_application_id);
    res.status(200).json({ success: true, data: capacity });
  } catch (error) {
    next(error);
  }
};
