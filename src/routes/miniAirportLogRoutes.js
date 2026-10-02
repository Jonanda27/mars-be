const express = require('express');
const router = express.Router();
const miniAirportLogController = require('../controllers/miniAirportLogController');
const { authMiddleware: protect, authorizeRoles: authorize } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/upload');

// 1. Ambil daftar permohonan Mini Airport yang aktif (untuk form input Petugas Lapangan)
router.get('/eligible-applications', protect, authorize('petugas', 'petugas_mini_airport', 'admin', 'admin_mini_airport', 'superadmin', 'dinas'), miniAirportLogController.getEligibleApplications);

// 2. Petugas Lapangan mencatat realisasi pendaratan di Mini Airport
router.post('/', protect, authorize('petugas', 'petugas_mini_airport', 'admin', 'admin_mini_airport', 'superadmin', 'dinas'), upload.single('evidence_photo'), miniAirportLogController.createMiniAirportLog);

// 3. Ambil daftar log Mini Airport yang belum terbit SKRD (untuk Dinas / Admin)
router.get('/unbilled', protect, authorize('admin', 'admin_mini_airport', 'superadmin', 'dinas', 'kepala dinas', 'petugas', 'petugas_mini_airport'), miniAirportLogController.getUnbilledLogs);

// 4. Ambil semua riwayat log Mini Airport
router.get('/', protect, authorize('admin', 'admin_mini_airport', 'superadmin', 'dinas', 'kepala dinas', 'petugas', 'petugas_mini_airport'), miniAirportLogController.getAllLogs);

// 5. Petugas Lapangan mencatat checkout (lepas landas)
router.patch('/:id/checkout', protect, authorize('petugas', 'petugas_mini_airport', 'admin', 'admin_mini_airport', 'superadmin', 'dinas'), upload.single('exit_photo'), miniAirportLogController.checkoutMiniAirportLog);

module.exports = router;

