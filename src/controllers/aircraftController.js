const aircraftService = require('../services/aircraftService');

exports.getAircrafts = async (req, res, next) => {
  try {
    const aircrafts = await aircraftService.fetchAircrafts();
    res.status(200).json({ success: true, data: aircrafts });
  } catch (error) {
    next(error);
  }
};

exports.getAircraft = async (req, res, next) => {
  try {
    const aircraft = await aircraftService.fetchAircraftById(req.params.id);
    res.status(200).json({ success: true, data: aircraft });
  } catch (error) {
    error.statusCode = 404;
    next(error);
  }
};

exports.createAircraft = async (req, res, next) => {
  try {
    const newAircraft = await aircraftService.addAircraft(req.body);
    res.status(201).json({ success: true, message: 'Aircraft created', data: newAircraft });
  } catch (error) {
    next(error);
  }
};
exports.getTenantAircrafts = async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id;
    if (!tenantId) {
      return res.status(403).json({ success: false, message: 'User is not a tenant' });
    }
    const aircrafts = await aircraftService.fetchAircraftsByTenant(tenantId);
    res.status(200).json({ success: true, data: aircrafts });
  } catch (error) {
    next(error);
  }
};

exports.createTenantAircraft = async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id;
    if (!tenantId) {
      return res.status(403).json({ success: false, message: 'User is not a tenant' });
    }
    const payload = { ...req.body, tenant_id: tenantId };
    const newAircraft = await aircraftService.addAircraft(payload);
    res.status(201).json({ success: true, message: 'Aircraft created successfully', data: newAircraft });
  } catch (error) {
    next(error);
  }
};

exports.updateTenantAircraft = async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id;
    if (!tenantId) {
      return res.status(403).json({ success: false, message: 'User is not a tenant' });
    }
    const updatedAircraft = await aircraftService.updateAircraft(req.params.id, tenantId, req.body);
    res.status(200).json({ success: true, message: 'Aircraft updated successfully', data: updatedAircraft });
  } catch (error) {
    next(error);
  }
};

exports.deleteTenantAircraft = async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id;
    if (!tenantId) {
      return res.status(403).json({ success: false, message: 'User is not a tenant' });
    }
    await aircraftService.deleteAircraft(req.params.id, tenantId);
    res.status(200).json({ success: true, message: 'Aircraft deleted successfully' });
  } catch (error) {
    next(error);
  }
};
