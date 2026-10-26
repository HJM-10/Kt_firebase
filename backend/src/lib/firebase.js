async function sendPush(userId, title, body, data = {}) {
  if (process.env.FIREBASE_ENABLED !== 'true') return;
  const { getApps, initializeApp, applicationDefault } = require('firebase-admin/app');
  const { getMessaging } = require('firebase-admin/messaging');
  const prisma = require('./prisma');
  if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: process.env.FIREBASE_PROJECT_ID });
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { fcmToken: true } });
  if (!user?.fcmToken) return;
  try {
    return await getMessaging().send({ token: user.fcmToken, notification: { title, body }, data, android: { priority: 'high', notification: { channelId: 'arena_updates' } } });
  } catch (error) {
    if (error.code === 'messaging/registration-token-not-registered') await prisma.user.updateMany({ where: { id: userId, fcmToken: user.fcmToken }, data: { fcmToken: null } });
    throw error;
  }
}
module.exports = { sendPush };
