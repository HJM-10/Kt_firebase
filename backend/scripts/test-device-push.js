require('dotenv').config({ quiet: true });
const prisma = require('../src/lib/prisma');
async function main() {
  const [email, phase] = process.argv.slice(2);
  if (!email || !['foreground', 'background'].includes(phase)) throw new Error('Usage: node scripts/test-device-push.js ACCOUNT_EMAIL foreground|background');
  if (process.env.FIREBASE_ENABLED !== 'true') throw new Error('Firebase must be enabled');
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, fcmToken: true } });
  if (!user?.fcmToken) throw new Error('No registered device. Sign into the Android app and allow notifications first.');
  const title = `KT Sports Hub ${phase} test`;
  const body = 'Firebase delivery test. Open Notifications to verify this saved message.';
  const notification = await prisma.notification.create({ data: { userId: user.id, title, body, type: 'GENERAL' } });
  const messageId = await require('../src/lib/firebase').sendPush(user.id, title, body, { notificationId: String(notification.id), type: 'GENERAL' });
  console.log(`PASS ${phase} notification saved as #${notification.id}; FCM accepted ${messageId}. Confirm display on the device separately.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
