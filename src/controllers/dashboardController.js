const dashboardService = require('../services/dashboardService');

exports.getAdminDashboardStats = async (req, res, next) => {
  try {
    const stats = await dashboardService.getAdminDashboardStats();
    res.status(200).json({
      success: true,
      message: 'Dashboard statistics retrieved successfully',
      data: stats
    });
  } catch (error) {
    next(error);
  }
};

exports.getDinasDashboardStats = async (req, res, next) => {
  try {
    const stats = await dashboardService.getDinasDashboardStats();
    res.status(200).json({
      success: true,
      message: 'Dinas dashboard statistics retrieved successfully',
      data: stats
    });
  } catch (error) {
    next(error);
  }
};

