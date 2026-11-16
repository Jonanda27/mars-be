const express = require('express');
const router = express.Router();
const overnightReportController = require('../controllers/overnightReportController');
const { authMiddleware, authorizeRoles } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/upload');

// Get candidate roster for today's overnight checklist (Petugas)
router.get(
  '/draft-today',
  authMiddleware,
  authorizeRoles('petugas', 'admin', 'superadmin'),
  overnightReportController.getTodayDraftRoster
);

// Submit daily overnight report with mandatory photos (Petugas)
router.post(
  '/',
  authMiddleware,
  authorizeRoles('petugas', 'admin', 'superadmin'),
  upload.any(),
  overnightReportController.submitDailyOvernightReport
);

// Get list of overnight reports
router.get(
  '/',
  authMiddleware,
  authorizeRoles('petugas', 'admin', 'superadmin', 'dinas', 'kepala dinas'),
  overnightReportController.getAllOvernightReports
);

// Get single overnight report detail
router.get(
  '/:id',
  authMiddleware,
  authorizeRoles('petugas', 'admin', 'superadmin', 'dinas', 'kepala dinas'),
  overnightReportController.getOvernightReportById
);

module.exports = router;
