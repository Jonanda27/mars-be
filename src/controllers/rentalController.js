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
    const { id } = req.params;
    const { status, asset_id } = req.body;
    const app = await rentalService.updateApplicationStatus(id, status, asset_id);
    res.status(200).json({ success: true, data: app });
  } catch (error) {
    next(error);
  }
};

exports.getApprovedApplications = async (req, res, next) => {
  try {
    const apps = await rentalService.getApprovedApplications();
    res.status(200).json({ success: true, data: apps });
  } catch (error) {
    next(error);
  }
};

exports.uploadSignature = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    // File is saved in uploads/ (or cloud), req.file.path contains the path
    const filePath = req.file.path.replace(/\\/g, '/'); // Normalize path for Windows
    const app = await rentalService.updateSignature(id, filePath);
    
    res.status(200).json({ success: true, data: app });
  } catch (error) {
    next(error);
  }
};
