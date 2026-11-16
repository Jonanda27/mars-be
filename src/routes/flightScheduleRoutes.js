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

const permitsDir = path.join(__dirname, '../../public/uploads/permits');
if (!fs.existsSync(permitsDir)) {
  fs.mkdirSync(permitsDir, { recursive: true });
}

const permitStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, permitsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'ticket-' + uniqueSuffix + '.pdf');
  }
});

const permitUpload = multer({
  storage: permitStorage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Tenant routes
router.post('/', protect, authorize('tenant'), upload.single('flight_plan_doc'), flightScheduleController.createSchedule);
router.get('/tenant', protect, authorize('tenant'), flightScheduleController.getTenantSchedules);

// Officer & Admin routes
router.get('/', protect, authorize('petugas', 'admin', 'superadmin', 'dinas'), flightScheduleController.getAllSchedules);
router.get('/expected-today', protect, authorize('petugas', 'admin', 'superadmin'), flightScheduleController.getTodayExpectedArrivals);
router.put('/:id/verify', protect, authorize('petugas'), permitUpload.single('permit_pdf'), flightScheduleController.verifySchedule);
router.post('/:id/resend-ticket', protect, authorize('petugas', 'admin', 'superadmin'), flightScheduleController.resendTicket);
router.post('/:id/check-in', protect, authorize('petugas'), flightScheduleController.checkInFromSchedule);

// Public route for direct ticket view/download without auth (for WhatsApp links & QR Code scanning)
router.get('/public/ticket/:id', flightScheduleController.getPublicTicket);

module.exports = router;
