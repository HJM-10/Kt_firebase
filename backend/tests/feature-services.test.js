jest.mock('../src/lib/prisma', () => ({
  user: { findUnique: jest.fn(), updateMany: jest.fn() },
  notification: { create: jest.fn() },
}));
jest.mock('firebase-admin/app', () => ({ getApps: jest.fn(() => []), initializeApp: jest.fn(), applicationDefault: jest.fn(() => 'credential') }));
jest.mock('firebase-admin/messaging', () => ({ getMessaging: jest.fn(() => ({ send: mockSend })) }));
jest.mock('../src/lib/socket', () => ({ getIO: jest.fn(() => ({ emit: mockEmit })) }));
const mockSend = jest.fn();
const mockEmit = jest.fn();
const prisma = require('../src/lib/prisma');
const { sendPush } = require('../src/lib/firebase');
const { createNotification } = require('../src/lib/notifications');
const { annualEnd, active } = require('../src/lib/membership');
beforeEach(() => { jest.clearAllMocks(); process.env.FIREBASE_ENABLED = 'true'; });
afterAll(() => { delete process.env.FIREBASE_ENABLED; });
test('Firebase is optional and never contacted while disabled', async () => {
  process.env.FIREBASE_ENABLED = 'false';
  await sendPush(1, 'Title', 'Body');
  expect(prisma.user.findUnique).not.toHaveBeenCalled();
  expect(mockSend).not.toHaveBeenCalled();
});
test('push uses Android high priority channel and notification reference', async () => {
  prisma.user.findUnique.mockResolvedValue({ fcmToken: 'device' });
  await sendPush(1, 'Title', 'Body', { notificationId: '12' });
  expect(mockSend).toHaveBeenCalledWith({ token: 'device', notification: { title: 'Title', body: 'Body' }, data: { notificationId: '12' }, android: { priority: 'high', notification: { channelId: 'arena_updates' } } });
});
test('stale device tokens are removed without clearing a concurrent replacement', async () => {
  prisma.user.findUnique.mockResolvedValue({ fcmToken: 'expired-device' });
  mockSend.mockRejectedValueOnce(Object.assign(new Error('Unregistered'), { code: 'messaging/registration-token-not-registered' }));
  await expect(sendPush(1, 'Title', 'Body')).rejects.toThrow('Unregistered');
  expect(prisma.user.updateMany).toHaveBeenCalledWith({ where: { id: 1, fcmToken: 'expired-device' }, data: { fcmToken: null } });
});
test('push failure preserves the in-app notification and emits no private content', async () => {
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  prisma.notification.create.mockResolvedValue({ id: 4, userId: 1, title: 'Private title', body: 'Private message', type: 'BOOKING' });
  prisma.user.findUnique.mockResolvedValue({ fcmToken: 'device' });
  mockSend.mockRejectedValueOnce(new Error('Provider unavailable'));
  await createNotification(1, 'Private title', 'Private message', 'BOOKING');
  expect(prisma.notification.create).toHaveBeenCalledTimes(1);
  expect(mockEmit).toHaveBeenCalledWith('resource_changed', { resource: 'notifications' });
  error.mockRestore();
});
test('membership expires at its exact deadline and clamps leap-day renewals', () => {
  const endDate = new Date('2028-02-29T10:00:00Z');
  expect(active({ isActive: true, endDate }, new Date(endDate - 1))).toBe(true);
  expect(active({ isActive: true, endDate }, endDate)).toBe(false);
  expect(annualEnd(endDate).toISOString()).toBe('2029-02-28T10:00:00.000Z');
});
