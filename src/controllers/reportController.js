const reportService = require('../services/reportService');

/**
 * Controller untuk mengambil data Laporan Rekapitulasi Realisasi Retribusi Daerah
 */
exports.getRetributionReport = async (req, res, next) => {
  try {
    const reportData = await reportService.getRetributionReport(req.query);
    res.status(200).json({
      success: true,
      message: 'Laporan Rekapitulasi Realisasi Retribusi berhasil dimuat',
      data: reportData
    });
  } catch (error) {
    next(error);
  }
};
