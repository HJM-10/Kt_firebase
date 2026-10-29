const request = require('supertest');
const jwt = require('jsonwebtoken');
const { venueLocation } = require('../src/lib/venue-location');
jest.mock('../src/lib/prisma', () => ({ user: { findUnique: jest.fn() }, venue: { create: jest.fn(), update: jest.fn() }, bookingSlot: { findMany: jest.fn() }, $transaction: jest.fn(), $queryRaw: jest.fn() }));
const prisma = require('../src/lib/prisma');
const app = require('../src/app');
const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET);
beforeEach(() => { jest.resetAllMocks(); prisma.user.findUnique.mockResolvedValue({ id: 1, role: 'ADMIN', isActive: true }); prisma.$transaction.mockImplementation(fn => fn(prisma)); });
test.each([{ latitude: null, longitude: 0 }, { latitude: 12 }, { latitude: '', longitude: '' }, { latitude: 91, longitude: 1 }, { latitude: 0, longitude: -181 }, { latitude: Infinity, longitude: 0 }, { address: 'x'.repeat(501) }])('rejects invalid or partial venue location %j', input => { expect(() => venueLocation(input)).toThrow(); });
test('zero is a valid coordinate and omitted updates preserve the pin', () => {
  expect(venueLocation({ latitude: 0, longitude: 0, address: ' Gate 2 ' })).toEqual({ latitude: 0, longitude: 0, address: 'Gate 2' });
  expect(venueLocation({ name: 'Renamed' })).toEqual({});
  expect(venueLocation({ latitude: null, longitude: null })).toEqual({ latitude: null, longitude: null });
});
test('admin location is persisted and returned on venue creation', async () => {
  prisma.venue.create.mockImplementation(({ data }) => Promise.resolve({ id: 1, ...data }));
  const r = await request(app).post('/api/venues').set('Authorization', 'Bearer ' + token).send({ name: 'Court', sportId: 1, address: 'Gate 2', latitude: 24.8, longitude: 67.1 });
  expect(r.status).toBe(201); expect(r.body.data.latitude).toBe(24.8);
});
test('invalid location is rejected before any venue writes', async () => {
  const r = await request(app).put('/api/venues/1').set('Authorization', 'Bearer ' + token).send({ latitude: 10 });
  expect(r.status).toBe(400); expect(prisma.venue.update).not.toHaveBeenCalled();
});
test('customers cannot change a venue pin', async () => {
  prisma.user.findUnique.mockResolvedValue({ id: 1, role: 'CUSTOMER', isActive: true });
  const r = await request(app).put('/api/venues/1').set('Authorization', 'Bearer ' + token).send({ latitude: 1, longitude: 2 });
  expect(r.status).toBe(403); expect(prisma.venue.update).not.toHaveBeenCalled();
});
test('readiness reports database failure without secrets and then recovers', async () => {
  prisma.$queryRaw.mockRejectedValueOnce(new Error('secret connection details')).mockResolvedValueOnce([1]);
  const down = await request(app).get('/api/ready');
  expect(down.status).toBe(503); expect(JSON.stringify(down.body)).not.toContain('secret');
  expect((await request(app).get('/api/ready')).status).toBe(200);
  expect((await request(app).get('/api/health')).status).toBe(200);
});
