const express = require('express');
const router = express.Router();
const logController = require('../controllers/logController');
const { authMiddleware } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/upload');

// Create entry (requires field log_evidence for the photo)
router.post('/entry', authMiddleware, upload.single('log_evidence'), logController.createLogEntry);

// Emergency checkin with PKS Pendaratan Darurat
router.post('/emergency-checkin', authMiddleware, upload.single('log_evidence'), logController.emergencyCheckin);

// Update exit
router.put('/exit/:id', authMiddleware, logController.updateLogExit);

// Get active logs (currently checked in)
router.get('/active', authMiddleware, logController.getActiveLogs);

// Get overstay logs (checked out but overstayed and unbilled)
router.get('/overstay', authMiddleware, logController.getOverstayLogs);

// Get all logs
router.get('/', authMiddleware, logController.getAllLogs);

module.exports = router;
