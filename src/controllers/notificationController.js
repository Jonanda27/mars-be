const prisma = require('../config/db');

// In-memory store for active SSE clients
// Format: { id: String, userId: Int, res: Response }
let clients = [];

/**
 * Helper terpusat untuk mencari user_id milik tenant
 */
exports.getTenantUserId = async (tenantId) => {
  if (!tenantId) return null;
  const parsedId = Number.parseInt(tenantId, 10);
  if (Number.isNaN(parsedId)) return null;

  const tenant = await prisma.tenants.findUnique({
    where: { id: parsedId },
    select: { user_id: true }
  });
  if (tenant?.user_id) return tenant.user_id;

  const user = await prisma.users.findFirst({
    where: { tenants: { some: { id: parsedId } } },
    select: { id: true }
  });
  return user?.id || null;
};

/**
 * Normalisasi dan ekspansi alias role untuk memastikan target user selalu ditemukan
 */
const resolveRoles = (roleOrRoles) => {
  const inputs = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles];
  const targetRoles = new Set();

  for (const r of inputs) {
    if (!r) continue;
    const lower = String(r).toLowerCase().trim();

    if (lower === 'kadis' || lower === 'kepala dinas' || lower === 'eksekutif') {
      targetRoles.add('kepala dinas');
      targetRoles.add('kadis');
    } else if (lower === 'superadmin' || lower === 'super_admin' || lower === 'super admin') {
      targetRoles.add('superadmin');
      targetRoles.add('super_admin');
    } else if (lower === 'admin') {
      targetRoles.add('admin');
      targetRoles.add('superadmin');
    } else if (lower === 'all_admin' || lower === 'all_admins') {
      targetRoles.add('admin');
      targetRoles.add('superadmin');
      targetRoles.add('admin_hanggar');
      targetRoles.add('admin_apron');
      targetRoles.add('admin_ruangan');
      targetRoles.add('admin_mini_airport');
    } else if (lower === 'dinas') {
      targetRoles.add('dinas');
    } else {
      targetRoles.add(lower);
    }
  }

  return Array.from(targetRoles);
};

/**
 * Endpoint for SSE connection
 * GET /api/notifications/stream
 */
exports.streamNotifications = (req, res) => {
  const userId = req.user.id;

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Send initial connected event
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', message: 'SSE Connection Established' })}\n\n`);

  // Clean up stale or dead connections
  clients = clients.filter((c) => !c.res.writableEnded && !c.res.destroyed);

  // If there are existing connections for this user, terminate older dangling ones
  const existingClients = clients.filter((c) => c.userId === Number(userId));
  if (existingClients.length > 0) {
    existingClients.forEach((oldClient) => {
      try {
        oldClient.res.end();
      } catch {
        // Ignore error
      }
    });
    clients = clients.filter((c) => !c.res.writableEnded && !c.res.destroyed);
  }

  // Add this client to the pool with unique ID
  const clientId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const newClient = {
    id: clientId,
    userId: Number(userId),
    res
  };
  clients.push(newClient);

  // Keep-alive heartbeat ping every 25s
  const pingInterval = setInterval(() => {
    try {
      if (res.writableEnded || res.destroyed) {
        clearInterval(pingInterval);
        return;
      }
      res.write(': ping\n\n');
    } catch {
      clearInterval(pingInterval);
    }
  }, 25000);

  // When client closes connection, remove them from the pool
  req.on('close', () => {
    clearInterval(pingInterval);
    clients = clients.filter((client) => client.id !== clientId);
  });
};

/**
 * Internal helper to create a notification in DB and push it via SSE
 * Can be called by other controllers/services
 */
exports.createNotification = async (userId, title, message, type = 'INFO', link_url = null) => {
  try {
    if (!userId) return null;
    const targetId = Number(userId);

    // 1. Save to database
    const notification = await prisma.notifications.create({
      data: {
        user_id: targetId,
        title,
        message,
        type,
        link_url
      }
    });

    // 2. Push to all active SSE connections for this user in real time
    clients = clients.filter((c) => !c.res.writableEnded && !c.res.destroyed);
    const userClients = clients.filter((c) => Number(c.userId) === targetId);
    userClients.forEach((client) => {
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
 * Helper to notify all users with specific role(s)
 * Accepts a role string or an array of roles
 */
exports.notifyRole = async (roles, title, message, type = 'INFO', link_url = null) => {
  try {
    const resolvedRoles = resolveRoles(roles);
    if (resolvedRoles.length === 0) return;

    const users = await prisma.users.findMany({
      where: {
        role: { in: resolvedRoles, mode: 'insensitive' }
      },
      select: { id: true, role: true }
    });

    for (const u of users) {
      await exports.createNotification(u.id, title, message, type, link_url);
    }
  } catch (error) {
    console.error(`Failed to notify role(s) ${JSON.stringify(roles)}:`, error);
  }
};

exports.getNotifications = async (req, res) => {
  try {
    const userId = Number(req.user.id);
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
    const userId = Number(req.user.id);
    const notificationId = Number.parseInt(req.params.id, 10);

    const notification = await prisma.notifications.updateMany({
      where: {
        id: notificationId,
        user_id: userId
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
    const userId = Number(req.user.id);

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
