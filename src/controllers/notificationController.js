const prisma = require('../config/db');

// In-memory store for active SSE clients
// Format: { userId: Int, res: Response }
let clients = [];

/**
 * Endpoint for SSE connection
 * GET /api/notifications/stream
 */
exports.streamNotifications = (req, res) => {
  const userId = req.user.id; // From verifyToken middleware

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders(); // flush the headers to establish connection

  // Send an initial connected event
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', message: 'SSE Connection Established' })}\n\n`);

  // Add this client to the pool
  const clientId = Date.now();
  const newClient = {
    id: clientId,
    userId: userId,
    res
  };
  clients.push(newClient);

  // Keep-alive heartbeat ping every 25s
  const pingInterval = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch (e) {
      clearInterval(pingInterval);
    }
  }, 25000);

  // When client closes connection, remove them from the pool
  req.on('close', () => {
    clearInterval(pingInterval);
    clients = clients.filter(client => client.id !== clientId);
  });
};

/**
 * Internal helper to create a notification in DB and push it via SSE
 * Can be called by other controllers/services
 */
exports.createNotification = async (userId, title, message, type = 'INFO', link_url = null) => {
  try {
    // 1. Save to database
    const notification = await prisma.notifications.create({
      data: {
        user_id: userId,
        title,
        message,
        type,
        link_url
      }
    });

    // 2. Push to all active connections for this user
    const targetId = Number(userId);
    const userClients = clients.filter(c => Number(c.userId) === targetId);
    userClients.forEach(client => {
      try {
        client.res.write(`data: ${JSON.stringify(notification)}\n\n`);
      } catch (err) {
        console.error('Error writing SSE message to client:', err);
      }
    });

    return notification;
  } catch (error) {
    console.error('Failed to create notification:', error);
    return null;
  }
};

/**
 * Helper to notify all users with a specific role
 */
exports.notifyRole = async (role, title, message, type = 'INFO', link_url = null) => {
  try {
    const users = await prisma.users.findMany({ 
      where: { 
        role: { equals: role, mode: 'insensitive' } 
      } 
    });
    for (const u of users) {
      await exports.createNotification(u.id, title, message, type, link_url);
    }
  } catch (error) {
    console.error(`Failed to notify role ${role}:`, error);
  }
};

exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Number.parseInt(req.query.limit, 10) || 50;

    const notifications = await prisma.notifications.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: limit
    });

    res.json(notifications);
  } catch (error) {
    console.error('Get Notifications Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Endpoint to mark a notification as read
 * PUT /api/notifications/:id/read
 */
exports.markAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = Number.parseInt(req.params.id, 10);

    const notification = await prisma.notifications.updateMany({
      where: { 
        id: notificationId,
        user_id: userId // Ensure they only mark their own
      },
      data: { is_read: true }
    });

    res.json({ success: true, updated: notification.count });
  } catch (error) {
    console.error('Mark As Read Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Endpoint to mark all notifications as read
 * PUT /api/notifications/read-all
 */
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await prisma.notifications.updateMany({
      where: { user_id: userId, is_read: false },
      data: { is_read: true }
    });

    res.json({ success: true, updated: result.count });
  } catch (error) {
    console.error('Mark All As Read Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
