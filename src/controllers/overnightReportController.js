const overnightReportService = require('../services/overnightReportService');

exports.getTodayDraftRoster = async (req, res, next) => {
  try {
    const { date } = req.query;
    const roster = await overnightReportService.getTodayDraftRoster(date);
    res.status(200).json({ success: true, data: roster });
  } catch (error) {
    next(error);
  }
};

exports.submitDailyOvernightReport = async (req, res, next) => {
  try {
    const officerId = req.user ? req.user.id : 1;

    // Convert multer files array / object into a lookup map
    const filesMap = {};
    if (req.files) {
      if (Array.isArray(req.files)) {
        req.files.forEach((file) => {
          filesMap[file.fieldname] = file;
        });
      } else if (typeof req.files === 'object') {
        Object.entries(req.files).forEach(([fieldName, fileArr]) => {
          filesMap[fieldName] = Array.isArray(fileArr) ? fileArr[0] : fileArr;
        });
      }
    } else if (req.file) {
      filesMap[req.file.fieldname] = req.file;
    }

    const report = await overnightReportService.submitDailyOvernightReport(
      officerId,
      req.body,
      filesMap
    );

    res.status(201).json({
      success: true,
      message: 'Laporan Tutup Hari berhasil disimpan dan diverifikasi.',
      data: report
    });
  } catch (error) {
    next(error);
  }
};

exports.getAllOvernightReports = async (req, res, next) => {
  try {
    const { start_date, end_date, officer_id } = req.query;
    const reports = await overnightReportService.getAllOvernightReports({
      start_date,
      end_date,
      officer_id
    });
    res.status(200).json({ success: true, data: reports });
  } catch (error) {
    next(error);
  }
};

exports.getOvernightReportById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const report = await overnightReportService.getOvernightReportById(id);
    res.status(200).json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
};
