const handleError = require('../middleware/errorHandler');
const prisma = require('../lib/prisma');

const getMyNotifications = async (req, res) => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100 || !Number.isSafeInteger((page - 1) * limit)) return res.status(400).json({ success: false, message: 'Valid page and limit (1–100) required' });
    const skip = (page - 1) * limit;

    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    });
    
    const unreadCount = await prisma.notification.count({
      where: { userId: req.user.id, isRead: false }
    });

    const total = await prisma.notification.count({ where: { userId: req.user.id } });
    res.json({ success: true, data: notifications, unreadCount, page, limit, total, hasMore: skip + notifications.length < total });
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

const markAsRead = async (req, res) => {
  try {
    const { notificationIds } = req.body;
    if (notificationIds !== undefined && (!Array.isArray(notificationIds) || notificationIds.length > 100 || notificationIds.some(id => !Number.isSafeInteger(id) || id < 1))) return res.status(400).json({ success: false, message: 'notificationIds must contain up to 100 positive integer IDs' });
    
    if (notificationIds && Array.isArray(notificationIds)) {
      await prisma.notification.updateMany({
        where: { id: { in: notificationIds }, userId: req.user.id },
        data: { isRead: true }
      });
    } else {
      // mark all as read
      await prisma.notification.updateMany({
        where: { userId: req.user.id, isRead: false },
        data: { isRead: true }
      });
    }

    res.json({ success: true, message: 'Notifications marked as read' });
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

const registerFcmToken = async (req, res) => {
  try {
    const { fcmToken } = req.body;
    if (fcmToken !== null && (typeof fcmToken !== 'string' || !fcmToken.length || fcmToken.length > 4096)) return res.status(400).json({ success: false, message: 'Valid FCM token required' });

    await require('../lib/transaction')(async tx => {
      // A device switching accounts must stop receiving the previous user's pushes.
      if (fcmToken) await tx.user.updateMany({ where: { fcmToken, id: { not: req.user.id } }, data: { fcmToken: null } });
      await tx.user.update({ where: { id: req.user.id }, data: { fcmToken } });
    });

    res.json({ success: true, message: 'FCM Token registered' });
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

module.exports = { getMyNotifications, markAsRead, registerFcmToken };

