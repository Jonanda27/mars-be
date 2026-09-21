const express = require('express');
const router = express.Router();
const flightScheduleController = require('../controllers/flightScheduleController');
const { authMiddleware: protect, authorizeRoles: authorize } = require('../middlewares/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../../public/uploads/flight_plans');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'fp-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// Tenant routes
router.post('/', protect, authorize('Tenant', 'tenant'), upload.single('flight_plan_doc'), flightScheduleController.createSchedule);
router.get('/tenant', protect, authorize('Tenant', 'tenant'), flightScheduleController.getTenantSchedules);

// Officer & Admin routes
router.get('/', protect, authorize('Warden', 'Petugas Lapangan', 'petugas lapangan', 'Admin', 'Super Admin', 'superadmin', 'Dinas', 'dinas'), flightScheduleController.getAllSchedules);
router.get('/expected-today', protect, authorize('Warden', 'Petugas Lapangan', 'petugas lapangan', 'Admin', 'Super Admin', 'superadmin'), flightScheduleController.getTodayExpectedArrivals);
router.put('/:id/verify', protect, authorize('Warden', 'Petugas Lapangan', 'petugas lapangan'), flightScheduleController.verifySchedule);
router.post('/:id/check-in', protect, authorize('Warden', 'Petugas Lapangan', 'petugas lapangan'), flightScheduleController.checkInFromSchedule);

module.exports = router;
