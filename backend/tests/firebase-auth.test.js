const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
jest.mock('../src/lib/prisma', () => ({ user: { findUnique: jest.fn(), create: jest.fn(), updateMany: jest.fn() } }));
jest.mock('../src/lib/firebase-auth', () => ({ enabled: jest.fn(() => true), verify: jest.fn(), sessionValid: jest.fn() }));
const prisma = require('../src/lib/prisma'), firebase = require('../src/lib/firebase-auth');
const app = require('../src/app');
beforeEach(() => { jest.clearAllMocks(); firebase.enabled.mockReturnValue(true); firebase.verify.mockResolvedValue({ uid: 'firebase-1', email: 'player@example.test', email_verified: true, auth_time: Math.floor(Date.now()/1000) }); });
test('disabled Firebase does not fall back to accepting tokens', async () => { firebase.enabled.mockReturnValue(false); expect((await request(app).post('/api/auth/firebase').send({ idToken: 'x' })).status).toBe(503); expect(firebase.verify).not.toHaveBeenCalled(); });
test('unverified Firebase email cannot create or link an account', async () => { firebase.verify.mockResolvedValue({ uid: '1', email: 'x@y.test', email_verified: false }); expect((await request(app).post('/api/auth/firebase').send({ idToken: 'x' })).status).toBe(403); expect(prisma.user.create).not.toHaveBeenCalled(); });
test('revoked identity is rejected', async () => { firebase.verify.mockRejectedValue(Object.assign(new Error('revoked'), { code: 'auth/id-token-revoked' })); expect((await request(app).post('/api/auth/firebase').send({ idToken: 'x' })).status).toBe(401); });
test('unconfigured project is a service error, not an invalid user session', async () => { firebase.verify.mockRejectedValue(Object.assign(new Error('private config detail'), { code: 'auth/configuration-not-found' })); const r = await request(app).post('/api/auth/firebase').send({ idToken: 'x' }); expect(r.status).toBe(503); expect(r.body.code).toBe('SERVICE_UNAVAILABLE'); expect(JSON.stringify(r.body)).not.toContain('private'); });
test('existing admin email cannot be taken over through Firebase', async () => {
  prisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 4, role: 'ADMIN', password: await bcrypt.hash('local-password', 4), isActive: true });
  const r = await request(app).post('/api/auth/firebase').send({ idToken: 'x', existingPassword: 'wrong' });
  expect(r.status).toBe(409); expect(prisma.user.updateMany).not.toHaveBeenCalled();
});
test('new verified identities become customers regardless of supplied role', async () => {
  prisma.user.findUnique.mockResolvedValue(null); prisma.user.create.mockImplementation(({ data }) => Promise.resolve({ ...data, id: 5, isActive: true }));
  const r = await request(app).post('/api/auth/firebase').send({ idToken: 'x', role: 'ADMIN' });
  expect(r.status).toBe(200); expect(r.body.data.user.role).toBe('CUSTOMER'); expect(r.body.data.user.password).toBeUndefined();
  expect(jwt.verify(r.body.data.token, process.env.JWT_SECRET).firebaseUid).toBe('firebase-1');
});
test('revocation after sign-in invalidates the app session', async () => {
  firebase.sessionValid.mockResolvedValue(false);
  const token = jwt.sign({ id: 5, firebaseUid: 'firebase-1', firebaseAuthTime: 1 }, process.env.JWT_SECRET);
  const r = await request(app).get('/api/auth/me').set('Authorization', 'Bearer ' + token);
  expect(r.status).toBe(401); expect(r.body.code).toBe('SESSION_INVALID');
});
test('linking an existing staff account requires its real local password and preserves its database role', async () => {
  const existing = { id: 4, role: 'ADMIN', password: await bcrypt.hash('local-password', 4), isActive: true, firebaseUid: null };
  prisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(existing); prisma.user.updateMany.mockResolvedValue({ count: 1 });
  const r = await request(app).post('/api/auth/firebase').send({ idToken: 'x', existingPassword: 'local-password', role: 'CUSTOMER' });
  expect(r.status).toBe(200); expect(r.body.data.user.role).toBe('ADMIN'); expect(r.body.data.user.password).toBeUndefined();
  expect(prisma.user.updateMany).toHaveBeenCalledWith({ where: { id: 4, firebaseUid: null, isActive: true }, data: { firebaseUid: 'firebase-1' } });
});
test('changing the database UID link invalidates an otherwise valid Firebase session', async () => {
  firebase.sessionValid.mockResolvedValue(true); prisma.user.findUnique.mockResolvedValue({ id: 5, isActive: true, role: 'CUSTOMER', firebaseUid: 'new-link' });
  const token = jwt.sign({ id: 5, firebaseUid: 'old-link', firebaseAuthTime: 1 }, process.env.JWT_SECRET);
  const r = await request(app).get('/api/auth/me').set('Authorization', 'Bearer ' + token);
  expect(r.status).toBe(401); expect(r.body.code).toBe('SESSION_INVALID');
});
