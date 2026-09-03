const express = require('express');
const router = express.Router();
const parkingController = require('../controllers/parkingController');
const { authMiddleware, authorizeRoles } = require('../middlewares/authMiddleware');

// Semua rute parkir manual membutuhkan autentikasi & otorisasi staf internal UPBU/Dishub
router.use(authMiddleware);
router.use(authorizeRoles('admin', 'superadmin', 'dishub', 'eksekutif'));

// --- 1. Manajemen Buku Karcis ---
router
  .route('/books')
  .get(parkingController.getAllBooks)
  .post(authorizeRoles('admin', 'superadmin'), parkingController.createBook);

router.get('/books/available', parkingController.getAvailableBooks);

// --- 2. Manajemen Serah Terima & Rekonsiliasi Juru Parkir ---
router
  .route('/handovers')
  .post(authorizeRoles('admin', 'superadmin'), parkingController.dispatchBooklet);

router.get('/handovers/active', parkingController.getActiveHandovers);
router.get('/handovers/history', parkingController.getHandoverHistory);

router.put('/handovers/:id/settle', authorizeRoles('admin', 'superadmin'), parkingController.settleHandover);

// --- 3. Laporan Rekonsiliasi Keuangan & Deteksi Kebocoran PAD ---
router.get('/reports/reconciliation', parkingController.getReconciliationReport);

module.exports = router;
