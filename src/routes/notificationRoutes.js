const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authMiddleware } = require('../middlewares/authMiddleware');

// Route for SSE stream (must be authenticated)
router.get('/stream', authMiddleware, notificationController.streamNotifications);

// Route for getting past notifications
router.get('/', authMiddleware, notificationController.getNotifications);

// Route for marking all as read
router.put('/read-all', authMiddleware, notificationController.markAllAsRead);

// Route for marking one as read
router.put('/:id/read', authMiddleware, notificationController.markAsRead);

module.exports = router;
