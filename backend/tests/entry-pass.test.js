const request = require('supertest');
const jwt = require('jsonwebtoken');
jest.mock('../src/lib/prisma', () => ({ user: { findUnique: jest.fn() }, booking: { findUnique: jest.fn(), updateMany: jest.fn() }, $transaction: jest.fn() }));
const prisma = require('../src/lib/prisma');
const app = require('../src/app');
const { entryPass, bookingForClient } = require('../src/lib/entry-pass');
const admin = jwt.sign({ id: 1 }, process.env.JWT_SECRET);
let booking;
beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['hrtime', 'nextTick', 'performance', 'queueMicrotask', 'setImmediate', 'clearImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  jest.setSystemTime(new Date('2026-10-25T20:00:00+05:00'));
  jest.clearAllMocks();
  booking = { id: 42, userId: 2, status: 'CONFIRMED', qrToken: 'opaque-pass', qrCode: 'old-image', slotId: 3, user: { name: 'Demo Player' }, slot: { id: 3, date: new Date('2026-10-25'), startTime: '20:00', endTime: '21:00', venue: { name: 'Demo Court' } } };
  prisma.user.findUnique.mockResolvedValue({ id: 1, role: 'ADMIN', isActive: true });
  prisma.$transaction.mockImplementation(fn => fn(prisma));
  prisma.booking.findUnique.mockImplementation(async ({ where }) => (where.id !== undefined && where.id !== booking.id) || ('qrToken' in where && where.qrToken !== booking.qrToken) ? null : structuredClone(booking));
  prisma.booking.updateMany.mockImplementation(async ({ where, data }) => {
    if (('qrToken' in where && where.qrToken !== booking.qrToken) || (where.status && where.status !== booking.status)) return { count: 0 };
    Object.assign(booking, data); return { count: 1 };
  });
});
afterEach(() => jest.useRealTimers());
const scan = code => request(app).post('/api/bookings/scan').set('Authorization', `Bearer ${admin}`).send({ qrToken: code });
const pass = () => request(app).get('/api/bookings/42/qr').set('Authorization', `Bearer ${admin}`);

test.each([
  ['2026-10-25T19:59:59.999+05:00', 'UPCOMING'],
  ['2026-10-25T20:00:00+05:00', 'VALID'],
  ['2026-10-25T20:15:00+05:00', 'VALID'],
  ['2026-10-25T20:50:00+05:00', 'VALID'],
  ['2026-10-25T20:59:59.999+05:00', 'VALID'],
  ['2026-10-25T21:00:00+05:00', 'EXPIRED'],
  ['2026-10-25T21:00:00.001+05:00', 'EXPIRED'],
])('8–9 PM pass at %s is %s', (time, status) => {
  const result = entryPass(booking, new Date(time));
  expect(result.status).toBe(status);
  expect(result.expiresAt.toISOString()).toBe('2026-10-25T16:00:00.000Z');
});
test('customer booking responses do not disclose a token or QR image', () => {
  const result = bookingForClient(booking);
  expect(result.qrToken).toBeUndefined(); expect(result.qrCode).toBeUndefined(); expect(result.entryPass.status).toBe('VALID');
});
test('confirmed customer or staff can display a generated QR and its deadline', async () => {
  const response = await pass();
  expect(response.status).toBe(200); expect(response.body.data.qrToken).toBe('opaque-pass');
  expect(response.body.data.qrCode).toMatch(/^data:image\/png;base64,/);
  expect(response.body.data.entryPass.expiresAt).toBe('2026-10-25T16:00:00.000Z');
  expect(response.body.data.booking.user.name).toBe('Demo Player');
});
test.each(['PENDING_PAYMENT', 'CANCELLED', 'SCANNED'])('%s does not expose a QR pass', async status => {
  booking.status = status;
  const response = await pass();
  expect(response.status).toBe(200); expect(response.body.data.qrToken).toBeNull(); expect(response.body.data.qrCode).toBeNull();
});
test('expired pass is hidden even if the booking still has CONFIRMED status', async () => {
  jest.setSystemTime(new Date('2026-10-25T21:00:00+05:00'));
  const response = await pass();
  expect(response.body.data.entryPass.status).toBe('EXPIRED'); expect(response.body.data.qrCode).toBeNull();
  expect((await scan('opaque-pass')).status).toBe(400); expect(booking.status).toBe('CONFIRMED');
});
test('arrival at 8:59:59.999 succeeds once; a second scan fails', async () => {
  jest.setSystemTime(new Date('2026-10-25T20:59:59.999+05:00'));
  const response = await scan('opaque-pass'); expect(response.status).toBe(200); expect(booking.status).toBe('SCANNED');
  expect((await scan('opaque-pass')).status).toBe(400);
});
test('check-in before the booked start is rejected', async () => {
  jest.setSystemTime(new Date('2026-10-25T19:59:59+05:00'));
  expect((await scan('opaque-pass')).status).toBe(400); expect(booking.status).toBe('CONFIRMED');
});
test('legacy JSON QR contents are accepted and normalized', async () => {
  expect((await scan(JSON.stringify({ token: 'opaque-pass', bookingId: 42 }))).status).toBe(200);
});
test('another customer cannot obtain the pass', async () => {
  prisma.user.findUnique.mockResolvedValue({ id: 1, role: 'CUSTOMER', isActive: true });
  expect((await pass()).status).toBe(403); expect((await scan('opaque-pass')).status).toBe(403);
});
test('a confirmed legacy booking gets a stable token on first display', async () => {
  booking.qrToken = null;
  const first = await pass(); const second = await pass();
  expect(first.body.data.qrToken).toMatch(/^[0-9a-f-]{36}$/); expect(second.body.data.qrToken).toBe(first.body.data.qrToken);
});
