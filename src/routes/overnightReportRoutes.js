const express = require('express');
const router = express.Router();
const overnightReportController = require('../controllers/overnightReportController');
const { authMiddleware, authorizeRoles } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/upload');

// Get candidate roster for today's overnight checklist (Warden / Petugas)
router.get(
  '/draft-today',
  authMiddleware,
  authorizeRoles('Warden', 'Petugas Lapangan', 'Petugas', 'Admin', 'Super Admin', 'Superadmin'),
  overnightReportController.getTodayDraftRoster
);

// Submit daily overnight report with mandatory photos (Warden / Petugas)
router.post(
  '/',
  authMiddleware,
  authorizeRoles('Warden', 'Petugas Lapangan', 'Petugas', 'Admin', 'Super Admin', 'Superadmin'),
  upload.any(),
  overnightReportController.submitDailyOvernightReport
);

// Get list of overnight reports
router.get(
  '/',
  authMiddleware,
  authorizeRoles('Warden', 'Petugas Lapangan', 'Petugas', 'Admin', 'Super Admin', 'Superadmin', 'Dinas', 'Kepala Dinas'),
  overnightReportController.getAllOvernightReports
);

// Get single overnight report detail
router.get(
  '/:id',
  authMiddleware,
  authorizeRoles('Warden', 'Petugas Lapangan', 'Petugas', 'Admin', 'Super Admin', 'Superadmin', 'Dinas', 'Kepala Dinas'),
  overnightReportController.getOvernightReportById
);

module.exports = router;
