const assetService = require('../services/assetService');

exports.getAssets = async (req, res, next) => {
  try {
    const assets = await assetService.fetchAssets();
    res.status(200).json({ success: true, data: assets });
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
