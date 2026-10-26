const request = require('supertest');
const jwt = require('jsonwebtoken');
jest.mock('../src/lib/prisma', () => ({
  user: { findUnique: jest.fn(), create: jest.fn() },
  booking: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  payment: { findUnique: jest.fn(), update: jest.fn() },
  $transaction: jest.fn(),
}));
const app = require('../src/app');
const prisma = require('../src/lib/prisma');
beforeEach(() => prisma.$transaction.mockImplementation(fn => fn(prisma)));
const token = (role = 'CUSTOMER') => {
  prisma.user.findUnique.mockResolvedValue({ id: 1, role, isActive: true });
  return `Bearer ${jwt.sign({ id: 1, role }, process.env.JWT_SECRET)}`;
};
afterEach(() => jest.clearAllMocks());
test('public registration rejects admin privilege escalation', async () => {
  const result = await request(app).post('/api/auth/register').send({ name: 'Attacker', email: 'attacker@example.com', password: 'password123', role: 'ADMIN' });
  expect(result.status).toBe(400);
  expect(prisma.user.create).not.toHaveBeenCalled();
});
test('customers cannot read admin user listing', async () => {
  expect((await request(app).get('/api/users').set('Authorization', token())).status).toBe(403);
});
test('client cannot confirm another customer payment', async () => {
  prisma.payment.findUnique.mockResolvedValue({ id: 7, userId: 2, status: 'PENDING' });
  expect((await request(app).post('/api/payments/confirm').set('Authorization', token()).send({ paymentId: 7 })).status).toBe(403);
  expect(prisma.payment.update).not.toHaveBeenCalled();
});
test('customer cannot self-confirm payment', async () => {
  prisma.payment.findUnique.mockResolvedValue({ id: 7, userId: 1, status: 'PENDING' });
  expect((await request(app).post('/api/payments/confirm').set('Authorization', token()).send({ paymentId: 7 })).status).toBe(403);
});
test('checkout enforces payment ownership', async () => {
  prisma.payment.findUnique.mockResolvedValue({ id: 7, userId: 2, status: 'PENDING' });
  expect((await request(app).post('/api/payments/checkout').set('Authorization', token()).send({ paymentId: 7 })).status).toBe(403);
});
test('unconfigured Stripe does not pretend to collect money', async () => {
  const key = process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_SECRET_KEY;
  prisma.payment.findUnique.mockResolvedValue({ id: 7, userId: 1, status: 'PENDING', amount: 100, currency: 'PKR' });
  expect((await request(app).post('/api/payments/checkout').set('Authorization', token()).send({ paymentId: 7 })).status).toBe(503);
  if (key) process.env.STRIPE_SECRET_KEY = key;
});
test('unpaid QR code cannot check in', async () => {
  prisma.booking.findUnique.mockResolvedValue({ id: 5, status: 'PENDING_PAYMENT', slot: { date: new Date('2026-10-25'), startTime: '20:00', endTime: '21:00' } });
  expect((await request(app).post('/api/bookings/scan').set('Authorization', token('ADMIN')).send({ qrToken: 'test-token' })).status).toBe(400);
  expect(prisma.booking.update).not.toHaveBeenCalled();
});
test.each([
  { venueId: -1, date: '2026-12-10', startTime: '10:00', endTime: '11:00' },
  { venueId: 1, date: '2026-02-31', startTime: '10:00', endTime: '11:00' },
  { venueId: 1, date: '2026-12-10', startTime: '25:00', endTime: '26:00' },
  { venueId: 1, date: '2026-12-10', startTime: '12:00', endTime: '11:00' },
])('invalid slot is rejected before persistence: %j', async body => {
  expect((await request(app).post('/api/bookings/slots').set('Authorization', token('ADMIN')).send(body)).status).toBe(400);
});
test('malformed JSON returns 400 without exposing a stack', async () => {
  const result = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{');
  expect(result.status).toBe(400);
  expect(result.body.stack).toBeUndefined();
});
