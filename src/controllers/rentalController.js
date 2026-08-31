const rentalService = require('../services/rentalService');

exports.createRentalApplication = async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id; // From auth middleware
    if (!tenantId) {
      return res.status(403).json({ success: false, message: 'User is not a tenant' });
    }
    const newApp = await rentalService.createApplication(tenantId, req.body);
    res.status(201).json({ success: true, message: 'Application created successfully', data: newApp });
  } catch (error) {
    next(error);
  }
};

exports.getTenantApplications = async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id; // From auth middleware
    if (!tenantId) {
      return res.status(403).json({ success: false, message: 'User is not a tenant' });
    }
    const apps = await rentalService.getApplicationsByTenant(tenantId);
    res.status(200).json({ success: true, data: apps });
  } catch (error) {
    next(error);
  }
};

exports.getAllApplications = async (req, res, next) => {
  try {
    const airportId = req.user.role.toLowerCase() === 'superadmin' ? null : req.user.airport_id;
    const apps = await rentalService.getAllApplications(airportId);
    res.status(200).json({ success: true, data: apps });
  } catch (error) {
    next(error);
  }
};

exports.getApplicationById = async (req, res, next) => {
  try {
    const app = await rentalService.getApplicationById(req.params.id);
    res.status(200).json({ success: true, data: app });
  } catch (error) {
    next(error);
  }
};

exports.updateApplicationStatus = async (req, res, next) => {
  try {
    const { status, asset_id } = req.body;
    const updatedApp = await rentalService.updateApplicationStatus(req.params.id, status, asset_id);
    res.status(200).json({ success: true, message: `Application ${status}`, data: updatedApp });
  } catch (error) {
    next(error);
  }
};
