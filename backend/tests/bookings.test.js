const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/lib/prisma');
const jwt = require('jsonwebtoken');

jest.mock('../src/lib/prisma', () => ({
  user: { findUnique: jest.fn().mockResolvedValue({ id: 1, role: 'ADMIN', isActive: true }) },
  venue: { update: jest.fn().mockResolvedValue({ id: 1, isActive: true }) },
  venueClosure: { findFirst: jest.fn().mockResolvedValue(null) },
  match: { findMany: jest.fn().mockResolvedValue([]) },
  event: { findMany: jest.fn().mockResolvedValue([]) },
  bookingSlot: {
    findMany: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
  },
  booking: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  $transaction: jest.fn()
}));

const mockToken = jwt.sign({ id: 1, role: 'ADMIN' }, process.env.JWT_SECRET || 'secret');

describe('Bookings API', () => {
  beforeEach(() => prisma.$transaction.mockImplementation(fn => fn(prisma)));
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/bookings/slots', () => {
    it('should prevent overlapping slots', async () => {
      // Mock existing slot that overlaps
      prisma.bookingSlot.findMany.mockResolvedValue([
        { id: 1, startTime: '10:00', endTime: '11:00' }
      ]);

      const res = await request(app)
        .post('/api/bookings/slots')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          venueId: 1,
          date: '2026-10-10',
          startTime: '10:30',
          endTime: '11:30'
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/overlaps/i);
    });

    it('should create slot if no overlap', async () => {
      prisma.bookingSlot.findMany.mockResolvedValue([]);
      prisma.bookingSlot.create.mockResolvedValue({ id: 2 });

      const res = await request(app)
        .post('/api/bookings/slots')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          venueId: 1,
          date: '2026-10-10',
          startTime: '11:00',
          endTime: '12:00'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });
  });
});
