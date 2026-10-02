const miniAirportLogService = require('../services/miniAirportLogService');

exports.getEligibleApplications = async (req, res, next) => {
  try {
    const apps = await miniAirportLogService.getEligibleMiniAirportApplications(req.user);
    res.status(200).json({ success: true, data: apps });
  } catch (error) {
    next(error);
  }
};

exports.createMiniAirportLog = async (req, res, next) => {
  try {
    const newLog = await miniAirportLogService.createMiniAirportLog(req.user.id, req.body, req.file);
    res.status(201).json({
      success: true,
      message: 'Realisasi pendaratan Mini Airport berhasil dicatat oleh Petugas Lapangan',
      data: newLog
    });
  } catch (error) {
    next(error);
  }
};

exports.getUnbilledLogs = async (req, res, next) => {
  try {
    const logs = await miniAirportLogService.getUnbilledMiniAirportLogs(req.user);
    res.status(200).json({ success: true, data: logs });
  } catch (error) {
    next(error);
  }
};

exports.getAllLogs = async (req, res, next) => {
  try {
    const logs = await miniAirportLogService.getAllMiniAirportLogs(req.user);
    res.status(200).json({ success: true, data: logs });
  } catch (error) {
    next(error);
  }
};

exports.checkoutMiniAirportLog = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updated = await miniAirportLogService.checkoutMiniAirportLog(id, req.user.id, req.body, req.file);
    res.status(200).json({
      success: true,
      message: 'Checkout keberangkatan berhasil dicatat. Stand apron kini kosong dan log diteruskan ke Dinas untuk penerbitan SKRD.',
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

