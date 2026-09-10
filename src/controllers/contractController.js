const contractService = require('../services/contractService');

exports.getAllContracts = async (req, res, next) => {
  try {
    const contracts = await contractService.getAllContracts();
    res.status(200).json({ success: true, data: contracts });
  } catch (error) {
    next(error);
  }
};

exports.getContractById = async (req, res, next) => {
  try {
    const contract = await contractService.getContractById(req.params.id);
    res.status(200).json({ success: true, data: contract });
  } catch (error) {
    next(error);
  }
};

exports.updateContract = async (req, res, next) => {
  try {
    const updatedContract = await contractService.updateContract(req.params.id, req.body);
    res.status(200).json({ success: true, message: 'Contract updated', data: updatedContract });
  } catch (error) {
    next(error);
  }
};

exports.getTenantContracts = async (req, res, next) => {
  try {
    const contracts = await contractService.getContractsByTenant(req.user.tenant_id);
    res.status(200).json({ success: true, data: contracts });
  } catch (error) {
    next(error);
  }
};

exports.getTenantContractById = async (req, res, next) => {
  try {
    const contract = await contractService.getContractByIdAndTenant(req.params.id, req.user.tenant_id);
    res.status(200).json({ success: true, data: contract });
  } catch (error) {
    next(error);
  }
};

exports.updateContractStatusByTenant = async (req, res, next) => {
  try {
    const { status, tenant_signature } = req.body;
    // Tenant only allowed to set Approved, Rejected, or Waiting Payment
    if (!['Approved', 'Rejected', 'Waiting Payment'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status update by Tenant' });
    }
    const updatedContract = await contractService.updateContractStatusByTenant(req.params.id, req.user.tenant_id, status, tenant_signature);
    res.status(200).json({ success: true, message: 'Contract status updated', data: updatedContract });
  } catch (error) {
    next(error);
  }
};

exports.extendContract = async (req, res, next) => {
  try {
    const { new_end_date } = req.body;
    const newApplication = await contractService.extendContract(req.params.id, req.user.tenant_id, new_end_date);
    res.status(201).json({ success: true, message: 'Extension requested successfully', data: newApplication });
  } catch (error) {
    next(error);
  }
};

exports.terminateContract = async (req, res, next) => {
  try {
    const updatedContract = await contractService.terminateContract(req.params.id);
    res.status(200).json({ success: true, message: 'Contract terminated successfully', data: updatedContract });
  } catch (error) {
    next(error);
  }
};

exports.uploadSignature = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'File is required' });
    }
    // multer-storage-cloudinary provides the remote URL in req.file.path
    const fileUrl = req.file.path;
    const updatedContract = await contractService.uploadSignature(req.params.id, req.user.tenant_id, fileUrl);
    res.status(200).json({ success: true, message: 'Signature uploaded successfully', data: updatedContract });
  } catch (error) {
    next(error);
  }
};

exports.verifyContract = async (req, res, next) => {
  try {
    const updatedContract = await contractService.verifyContract(req.params.id);
    res.status(200).json({ success: true, message: 'Contract verified and activated successfully', data: updatedContract });
  } catch (error) {
    next(error);
  }
};
