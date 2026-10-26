const request = require('supertest');
const jwt = require('jsonwebtoken');
jest.mock('../src/lib/prisma', () => ({
  user: { findUnique: jest.fn() }, venue: { findMany: jest.fn() },
  sport: { findMany: jest.fn() }, payment: { aggregate: jest.fn() },
  match: { findMany: jest.fn() }, event: { findMany: jest.fn() },
}));
const prisma = require('../src/lib/prisma');
const app = require('../src/app');
const { pakistanDay } = require('../src/controllers/arena.controller');
const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET);
const get = date => request(app).get('/api/reports/arena-desk' + (date ? '?date=' + date : '')).set('Authorization', 'Bearer ' + token);
beforeEach(() => {
  jest.resetAllMocks();
  prisma.user.findUnique.mockResolvedValue({ id: 1, role: 'ADMIN', isActive: true });
  prisma.venue.findMany.mockResolvedValue([]);
  prisma.sport.findMany.mockResolvedValue([]);
  prisma.match.findMany.mockResolvedValue([]);
  prisma.event.findMany.mockResolvedValue([]);
  prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: null }, _count: { id: 0 } });
});
test('customer and anonymous requests cannot read admin operational data', async () => {
  expect((await request(app).get('/api/reports/arena-desk')).status).toBe(401);
  prisma.user.findUnique.mockResolvedValue({ id: 1, role: 'CUSTOMER', isActive: true });
  expect((await get('2026-10-25')).status).toBe(403);
  expect(prisma.venue.findMany).not.toHaveBeenCalled();
});
test.each(['2026-02-30', '2026-13-01', 'today', '2026-1-01'])('invalid date %s is rejected before querying data', async date => {
  expect((await get(date)).status).toBe(400);
  expect(prisma.venue.findMany).not.toHaveBeenCalled();
});
test('daily totals include all facilities, preserve cancelled history, and use Pakistan day boundaries', async () => {
  prisma.venue.findMany.mockResolvedValue([{ id: 8, name: 'Court 8', isActive: false, sport: { name: 'Padel' }, slots: [{
    id: 3, date: new Date('2026-10-25'), startTime: '18:00', endTime: '19:00', isBooked: true,
    bookings: [{ id: 1, status: 'CANCELLED' }, { id: 2, status: 'PENDING_PAYMENT' }, { id: 3, status: 'CONFIRMED' }],
  }] }]);
  prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 2500 }, _count: { id: 2 } });
  const response = await get('2026-10-25');
  expect(response.status).toBe(200);
  expect(response.body.data.summary).toEqual({ bookings: 2, pendingBookings: 1, collected: 2500, paymentCount: 2 });
  expect(response.body.data.bookings).toHaveLength(3);
  expect(response.body.data.venues[0].isActive).toBe(false);
  expect(prisma.payment.aggregate.mock.calls[0][0].where).toEqual({ status: 'PAID', updatedAt: {
    gte: new Date('2026-10-24T19:00:00Z'), lt: new Date('2026-10-25T19:00:00Z'),
  } });
  const select = prisma.venue.findMany.mock.calls[0][0].include.slots.include.bookings.select;
  expect(select.qrToken).toBeUndefined();
  expect(select.user.select).toEqual({ id: true, name: true, phone: true });
});
test('empty schedules return zero totals and Pakistan date changes at 19:00 UTC', async () => {
  const response = await get('2026-10-25');
  expect(response.body.data.summary.collected).toBe(0);
  expect(response.body.data.bookings).toEqual([]);
  expect(pakistanDay(new Date('2026-10-24T18:59:59Z'))).toBe('2026-10-24');
  expect(pakistanDay(new Date('2026-10-24T19:00:00Z'))).toBe('2026-10-25');
});
