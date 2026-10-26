const prisma = require('./prisma');

/**
 * Creates an in-app notification for a user.
 * @param {number} userId
 * @param {string} title
 * @param {string} body
 * @param {string} type  e.g. 'BOOKING', 'PAYMENT', 'COMPLAINT', 'GENERAL'
 * @param {object} data  optional JSON payload
 */
const createNotification = async (userId, title, body, type = 'INFO', data = null) => {
  try {
    const notification = await prisma.notification.create({
      data: { userId, title, body, type, data }
    });
    await deliverNotification(notification);
  } catch (err) {
    console.error('[Notification] Failed to create notification:', err.message);
  }
};

async function deliverNotification(notification) {
  // Only a refresh hint is broadcast; notification contents stay behind the owner API.
  try { require('./socket').getIO().emit('resource_changed', { resource: 'notifications' }); } catch {}
  try { await require('./firebase').sendPush(notification.userId, notification.title, notification.body, { notificationId: String(notification.id), type: notification.type }); }
  catch (error) { console.error('[Push] Delivery failed:', error.message); }
}
module.exports = { createNotification, deliverNotification };
