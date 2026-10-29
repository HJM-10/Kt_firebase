jest.mock('../src/lib/prisma', () => ({ booking: { findMany: jest.fn() }, bookingSlot: { findMany: jest.fn() }, venueClosure: { findFirst: jest.fn() }, event: { findMany: jest.fn() }, match: { findMany: jest.fn() } }));
jest.mock('../src/lib/reservation-lifecycle', () => ({ expireReservations: jest.fn() }));
const prisma = require('../src/lib/prisma');
const { getRecommendedSlots } = require('../src/controllers/recommendations.controller');
const venue = { id: 1, name: 'Court', sportId: 1, isActive: true, sport: { isActive: true }, openingTime: '06:00', closingTime: '23:00' };
const slot = (id, time, v = venue) => ({ id, venueId: v.id, date: new Date('2026-10-29'), startTime: time, endTime: `${Number(time.slice(0, 2)) + 1}:00`, venue: v });
beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-10-29T05:00:00Z')); jest.clearAllMocks();
  prisma.booking.findMany.mockResolvedValue([]); prisma.venueClosure.findFirst.mockResolvedValue(null); prisma.event.findMany.mockResolvedValue([]); prisma.match.findMany.mockResolvedValue([]);
});
afterEach(() => jest.useRealTimers());
test('includes future sessions today, removes past sessions and blocked venues', async () => {
  prisma.bookingSlot.findMany.mockResolvedValue([slot(1, '09:00'), slot(2, '10:00'), slot(3, '11:00'), slot(4, '12:00', { ...venue, isActive: false })]);
  const res = { json: jest.fn() }, next = jest.fn();
  await getRecommendedSlots({ user: { id: 1 } }, res, next);
  expect(next).not.toHaveBeenCalled(); expect(res.json.mock.calls[0][0].data.map(s => s.id)).toEqual([3]);
  expect(prisma.bookingSlot.findMany.mock.calls[0][0].where.date.gte).toEqual(new Date('2026-10-29'));
});
test('preferences rank recommendations without hiding other available sports', async () => {
  prisma.booking.findMany.mockResolvedValue([{ slot: { venueId: 1, venue } }]);
  prisma.bookingSlot.findMany.mockResolvedValue([slot(2, '11:00', { ...venue, id: 2, sportId: 2 }), slot(1, '12:00')]);
  const res = { json: jest.fn() };
  await getRecommendedSlots({ user: { id: 1 } }, res, jest.fn());
  expect(res.json.mock.calls[0][0].data.map(s => s.id)).toEqual([1, 2]);
  expect(res.json.mock.calls[0][0].data[0].recommendationReason).toMatch(/booked before/);
});
test('excludes closures and forwards database failures', async () => {
  prisma.bookingSlot.findMany.mockResolvedValue([slot(1, '11:00')]);
  prisma.venueClosure.findFirst.mockResolvedValue({ reason: 'Maintenance' });
  const res = { json: jest.fn() }, next = jest.fn();
  await getRecommendedSlots({ user: { id: 1 } }, res, next); expect(res.json.mock.calls[0][0].data).toEqual([]);
  const outage = new Error('Database unavailable'); prisma.venueClosure.findFirst.mockRejectedValue(outage);
  await getRecommendedSlots({ user: { id: 1 } }, res, next); expect(next).toHaveBeenCalledWith(outage);
});
