const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
jest.mock('../src/lib/prisma', () => ({ user: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() }, sport: { findMany: jest.fn() } }));
const prisma = require('../src/lib/prisma');
const app = require('../src/app');
const token = jwt.sign({ id: 1, role: 'ADMIN' }, process.env.JWT_SECRET);
const get = path => request(app).get(path).set('Authorization', 'Bearer ' + token);
beforeEach(() => { jest.resetAllMocks(); prisma.user.findUnique.mockResolvedValue({ id: 1, role: 'CUSTOMER', isActive: true }); });
test('missing, malformed and expired tokens return session errors', async () => {
  expect((await request(app).get('/api/users')).status).toBe(401);
  for (const value of ['bad', jwt.sign({ id: 1 }, process.env.JWT_SECRET, { expiresIn: -1 })]) {
    const res = await request(app).get('/api/users').set('Authorization', 'Bearer ' + value);
    expect(res.status).toBe(401); expect(res.body.code).toBe('SESSION_INVALID');
  }
});
test.each(['P1001', 'P1002', 'P1017', 'P2024'])('database outage %s preserves auth classification and recovers with same token', async code => {
  prisma.user.findUnique.mockRejectedValueOnce(Object.assign(new Error('private database address'), { code }));
  const res = await get('/api/auth/me');
  expect(res.status).toBe(503); expect(res.body.code).toBe('SERVICE_UNAVAILABLE');
  expect(JSON.stringify(res.body)).not.toContain('private');
  expect((await get('/api/auth/me')).status).toBe(200);
});
test('current database role overrides an old admin JWT', async () => {
  expect((await get('/api/users')).status).toBe(403);
  prisma.user.findUnique.mockResolvedValue({ id: 1, role: 'ADMIN', isActive: true });
  prisma.sport.findMany.mockResolvedValue([]);
  expect((await get('/api/sports')).status).toBe(200);
});
test('inactive account rejects existing token', async () => {
  prisma.user.findUnique.mockResolvedValue({ id: 1, role: 'ADMIN', isActive: false });
  expect((await get('/api/users')).body.code).toBe('SESSION_INVALID');
});
test('incorrect current password is a form error and existing session remains valid', async () => {
  prisma.user.findUnique.mockResolvedValue({ id: 1, role: 'CUSTOMER', isActive: true, password: await bcrypt.hash('correct-password', 4) });
  const res = await request(app).put('/api/auth/password').set('Authorization', 'Bearer ' + token).send({ oldPassword: 'wrong-password', newPassword: 'new-password123' });
  expect(res.status).toBe(400); expect(res.body.code).toBe('INCORRECT_PASSWORD');
  expect((await get('/api/auth/me')).status).toBe(200);
});
test('login outage is 503, not incorrect credentials', async () => {
  prisma.user.findUnique.mockRejectedValue(Object.assign(new Error('database down'), { code: 'P1001' }));
  const res = await request(app).post('/api/auth/login').send({ email: 'test@example.com', password: 'password123' });
  expect(res.status).toBe(503);
});
test('database outage inside controller is also 503 and retry recovers', async () => {
  prisma.sport.findMany.mockRejectedValueOnce(Object.assign(new Error('down'), { code: 'P1001' })).mockResolvedValue([]);
  expect((await get('/api/sports')).status).toBe(503);
  expect((await get('/api/sports')).status).toBe(200);
});

test.each([['get','/api/users'],['get','/api/reports/revenue'],['get','/api/payments'],['get','/api/bookings'],['post','/api/sports'],['put','/api/users/2/role'],['delete','/api/venues/1']])('customer cannot call admin endpoint %s %s directly', async (method,path) => {
 const res = await request(app)[method](path).set('Authorization','Bearer '+token).send({});
 expect(res.status).toBe(403);
});
test('admin can read users and demotion takes effect on next request', async () => {
 prisma.user.findMany.mockResolvedValue([]);
 prisma.user.findUnique.mockResolvedValueOnce({ id: 1, role: 'ADMIN', isActive: true });
 expect((await get('/api/users')).status).toBe(200);
 expect((await get('/api/users')).status).toBe(403);
});
