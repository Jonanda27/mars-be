const tenantService = require('../services/tenantService');

exports.getTenants = async (req, res, next) => {
  try {
    const tenants = await tenantService.fetchTenants();
    res.status(200).json({ success: true, data: tenants });
  } catch (error) {
    next(error);
  }
};

exports.getTenant = async (req, res, next) => {
  try {
    const tenant = await tenantService.fetchTenantById(req.params.id);
    res.status(200).json({ success: true, data: tenant });
  } catch (error) {
    error.statusCode = 404;
    next(error);
  }
};

exports.createTenant = async (req, res, next) => {
  try {
    const newTenant = await tenantService.addTenant(req.body);
    res.status(201).json({ success: true, message: 'Tenant created', data: newTenant });
  } catch (error) {
    next(error);
  }
};

exports.verifyTenant = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }
    
    const updatedTenant = await tenantService.updateTenantStatus(id, status);
    res.status(200).json({
      success: true,
      message: `Tenant status updated to ${status}`,
      data: updatedTenant
    });
  } catch (error) {
    next(error);
  }
};

exports.uploadLegalitas = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { documentType } = req.body; // e.g., 'nib', 'npwp', 'akta', 'aoc'
    
    if (!documentType || !req.file) {
      return res.status(400).json({ success: false, message: 'Document type and file are required' });
    }

    const filePath = `/uploads/legalitas/${req.file.filename}`;
    const updatedTenant = await tenantService.uploadLegalitas(id, documentType, filePath);

    res.status(200).json({
      success: true,
      message: 'Document uploaded successfully',
      data: updatedTenant
    });
  } catch (error) {
    next(error);
  }
};
