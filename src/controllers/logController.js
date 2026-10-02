// Emergency check-in (PKS Pendaratan Darurat)
exports.emergencyCheckin = async (req, res, next) => {
  try {
    const {
      contract_id,
      registration_number,
      aircraft_type_id,
      airline_name,
      pic_name,
      pic_phone,
      pic_email,
      parking_location,
      asset_id,
      emergency_reason,
      pic_signature
    } = req.body;

    const officer_id = req.user ? req.user.id : 1;
    let evidence_photo = null;
    if (req.file) {
      evidence_photo = req.file.path;
    }

    const result = await logService.emergencyCheckin({
      contract_id,
      registration_number,
      aircraft_type_id,
      airline_name,
      pic_name,
      pic_phone,
      pic_email,
      parking_location: parking_location || 'Hanggar',
      asset_id,
      emergency_reason,
      pic_signature,
      evidence_photo,
      officer_id
    });

    res.status(201).json({
      success: true,
      message: 'Pendaratan Darurat berhasil dicatat dan PKS Darurat telah diterbitkan.',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const logService = require('../services/logService');

// Create new log entry (pesawat masuk)
exports.createLogEntry = async (req, res, next) => {
  try {
    const { registration_number, tenant_id, asset_id, entry_time, parking_location, notes } = req.body;
    
    // Asumsikan officer_id didapat dari token login (req.user)
    const officer_id = req.user ? req.user.id : 1; 
    
    let evidence_photo = null;
    if (req.file) {
      evidence_photo = req.file.path; // Cloudinary URL
    }

    const log = await logService.createLogEntry({
      registration_number,
      tenant_id,
      asset_id,
      entry_time,
      parking_location: parking_location || 'Hanggar',
      notes,
      evidence_photo,
      officer_id
    });

    res.status(201).json({ success: true, data: log });
  } catch (error) {
    next(error);
  }
};

// Update log exit (pesawat keluar)
exports.updateLogExit = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { exit_time, notes } = req.body;

    const updatedLog = await logService.updateLogExit(id, { exit_time, notes });

    res.status(200).json({ success: true, data: updatedLog });
  } catch (error) {
    if (error.message === 'Log not found') {
      return res.status(404).json({ success: false, message: error.message });
    }
    next(error);
  }
};

exports.getAllLogs = async (req, res, next) => {
  try {
    const logs = await logService.getAllLogs();
    res.status(200).json({ success: true, data: logs });
  } catch (error) {
    next(error);
  }
};

exports.getActiveLogs = async (req, res, next) => {
  try {
    const logs = await logService.getActiveLogs();
    res.status(200).json({ success: true, data: logs });
  } catch (error) {
    next(error);
  }
};

exports.getOverstayLogs = async (req, res, next) => {
  try {
    const logs = await logService.getOverstayLogs();
    res.status(200).json({ success: true, data: logs });
  } catch (error) {
    next(error);
  }
};
