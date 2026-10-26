// Repeatable acceptance checks against ONLY the isolated local demo database.
require('dotenv').config({ quiet: true });
process.env.FIREBASE_ENABLED = 'false'; // Automated QA never sends real notifications.
const assert = require('node:assert/strict');
const database = new URL(process.env.DATABASE_URL);
if (process.env.NODE_ENV === 'production' || database.hostname !== '127.0.0.1' || database.port !== '3307' || database.pathname !== '/smart_sports_hub_demo') throw new Error('Requires isolated local demo database');
const providerCalls = { sessions: 0, refunds: new Set() };
let providerFails = false;
require('../src/lib/stripe').getStripe = () => ({
  checkout: { sessions: { create: async () => { providerCalls.sessions++; return { id: 'cs_checklist', url: 'https://example.test/demo-checkout', status: 'open' }; }, retrieve: async () => ({ id: 'cs_checklist', url: 'https://example.test/demo-checkout', status: 'open' }) } },
  refunds: { create: async (data, options) => { if (providerFails) throw new Error('Simulated provider outage'); providerCalls.refunds.add(options.idempotencyKey); return { id: `re_${options.idempotencyKey}`, status: 'succeeded' }; } },
});
const request = require('supertest');
const jwt = require('jsonwebtoken');
const prisma = require('../src/lib/prisma');
const app = require('../src/app');
const lifecycle = require('../src/lib/reservation-lifecycle');
const { settle } = require('../src/controllers/checkout.controller');
const prefix = `Checklist QA ${Date.now()}`;
let sport, venue;
const users = [], results = [];
let admin, customer, other;
const token = user => `Bearer ${jwt.sign({ id: user.id }, process.env.JWT_SECRET)}`;
const api = (method, path, body, user = admin) => request(app)[method](`/api${path}`).set('Authorization', token(user)).send(body);
const date = offset => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
const time = (day, hour = '10:00') => `${date(day)}T${hour}:00+05:00`;
async function ok(label, fn) { await fn(); results.push(label); console.log(`PASS ${label}`); }
async function expect(method, path, body, status = 200, user) {
  const r = await api(method, path, body, user);
  assert.equal(r.status, status, `${method} ${path}: ${JSON.stringify(r.body)}`);
  return r.body.data;
}
async function slot(day, startTime = '10:00', endTime = '11:00') { return expect('post', '/bookings/slots', { venueId: venue.id, date: date(day), startTime, endTime }, 201); }
async function book(s, user = customer) { return expect('post', '/bookings', { slotId: s.id }, 201, user); }
async function tournament(format, maxTeams = 3, entryFee = 0) { return expect('post', '/tournaments', { name: `${prefix} ${format}`, sportId: sport.id, format, maxTeams, entryFee, startDate: time(15, '06:00'), endDate: time(20, '23:00') }, 201); }
async function entry(t, user, teamName, extra = {}) { return expect('post', `/tournaments/${t.id}/manual-register`, { teamName, userId: user.id, ...extra }, 201); }
async function fixtures(t, day, hour = '10:00') { return expect('post', `/tournaments/${t.id}/fixtures`, { scheduledAt: time(day, hour), durationMinutes: 60, intervalMinutes: 90, venue: venue.name }, 201); }

async function main() {
  for (let i = 0; i < 5; i++) users.push(await prisma.user.create({ data: { name: `${prefix} User ${i}`, email: `checklist-${Date.now()}-${i}@example.test`, password: 'unused-for-token-auth', role: i === 0 ? 'ADMIN' : 'CUSTOMER' } }));
  [admin, customer, other] = users;
  sport = await prisma.sport.create({ data: { name: prefix } });
  venue = await expect('post', '/venues', { name: `${prefix} Court`, sportId: sport.id, pricePerSlot: 100, openingTime: '08:00', closingTime: '22:00', closedWeekdays: [] }, 201);
  await ok('Venue prices, opening hours, closures and sport activity', async () => {
    assert.equal((await expect('get', `/venues/${venue.id}`)).pricePerSlot, 100);
    await expect('post', '/bookings/slots', { venueId: venue.id, date: date(10), startTime: '07:00', endTime: '08:00' }, 409);
    await expect('put', `/venues/${venue.id}`, { closures: [{ startAt: time(11), endAt: time(11, '12:00'), reason: 'Demo maintenance' }] });
    await expect('post', '/bookings/slots', { venueId: venue.id, date: date(11), startTime: '10:30', endTime: '11:30' }, 409);
    await prisma.sport.update({ where: { id: sport.id }, data: { isActive: false } });
    await expect('post', '/bookings/slots', { venueId: venue.id, date: date(10), startTime: '10:00', endTime: '11:00' }, 409);
    await prisma.sport.update({ where: { id: sport.id }, data: { isActive: true } });
  });
  let booking, bookedSlot;
  await ok('Concurrent double booking, slot overlap and booking history', async () => {
    bookedSlot = await slot(10);
    await expect('post', '/bookings/slots', { venueId: venue.id, date: date(10), startTime: '10:30', endTime: '11:30' }, 409);
    const attempts = await Promise.all([api('post', '/bookings', { slotId: bookedSlot.id }, customer), api('post', '/bookings', { slotId: bookedSlot.id }, other)]);
    assert.deepEqual(attempts.map(r => r.status).sort(), [201, 409]);
    booking = attempts.find(r => r.status === 201).body.data;
    customer = users.find(u => u.id === booking.userId); other = users.find(u => u.role === 'CUSTOMER' && u.id !== customer.id);
    assert((await expect('get', '/bookings/my', undefined, 200, customer)).some(b => b.id === booking.id));
    await expect('put', `/bookings/${booking.id}/cancel`, {}, 403, other);
    await expect('put', `/venues/${venue.id}`, { closures: [{ startAt: time(10), endAt: time(10, '11:00'), reason: 'Conflicting closure' }] }, 409);
  });
  await ok('Reservation expiry releases a court and rejects late cash confirmation', async () => {
    await prisma.payment.update({ where: { id: booking.paymentId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect('post', '/payments/confirm', { paymentId: booking.paymentId, receivedInPerson: true }, 409);
    await lifecycle.expireReservations();
    assert.equal((await prisma.booking.findUnique({ where: { id: booking.id } })).status, 'CANCELLED');
    assert.equal((await prisma.bookingSlot.findUnique({ where: { id: bookedSlot.id } })).isBooked, false);
    booking = await book(bookedSlot);
  });
  await ok('Cash receipt, same-venue reschedule, cancellation and auditable cash refund', async () => {
    await expect('post', '/payments/confirm', { paymentId: booking.paymentId }, 400);
    await expect('post', '/payments/confirm', { paymentId: booking.paymentId, receivedInPerson: true });
    const target = await slot(10, '12:00', '13:00');
    await expect('put', `/bookings/${booking.id}/reschedule`, { slotId: target.id }, 200, customer);
    assert.equal((await prisma.bookingSlot.findUnique({ where: { id: bookedSlot.id } })).isBooked, false);
    await expect('put', `/bookings/${booking.id}/cancel`, {}, 200, customer);
    const refund = await prisma.refund.findFirst({ where: { paymentId: booking.paymentId } });
    assert.equal(refund.amount, 100);
    await expect('post', `/payments/refunds/${refund.id}/cash`, { returnedInPerson: true, reference: 'QA simulated cash return' }, 403, customer);
    await expect('post', `/payments/refunds/${refund.id}/cash`, { returnedInPerson: true, reference: 'QA simulated cash return' });
    await expect('post', `/payments/refunds/${refund.id}/cash`, { returnedInPerson: true, reference: 'Duplicate retry' });
    assert.equal((await prisma.payment.findUnique({ where: { id: booking.paymentId } })).status, 'REFUNDED');
  });
  await ok('Online checkout reuse, late settlement, duplicate webhook and refund retry', async () => {
    const b = await book(await slot(12));
    process.env.STRIPE_WEBHOOK_SECRET = 'local-simulated-test-only';
    await expect('post', '/payments/checkout', { paymentId: b.paymentId }, 200, customer);
    await expect('post', '/payments/checkout', { paymentId: b.paymentId }, 200, customer);
    assert.equal(providerCalls.sessions, 1);
    await expect('put', `/bookings/${b.id}/cancel`, {}, 200, customer);
    const session = { metadata: { paymentId: String(b.paymentId) }, payment_status: 'paid', amount_total: 10000, currency: 'pkr', payment_intent: `pi_qa_${b.id}` };
    await settle(session); await settle(session);
    assert.equal(await prisma.refund.count({ where: { paymentId: b.paymentId } }), 1);
    providerFails = true; await lifecycle.processRefunds();
    assert.equal((await prisma.refund.findFirst({ where: { paymentId: b.paymentId } })).status, 'FAILED');
    providerFails = false; await lifecycle.processRefunds();
    assert.equal((await prisma.payment.findUnique({ where: { id: b.paymentId } })).status, 'REFUNDED');
    assert.equal((await prisma.booking.findUnique({ where: { id: b.id } })).status, 'CANCELLED');
  });
  await ok('Tournament manual capacity race, cash safeguard and waived fee eligibility', async () => {
    const t = await tournament('KNOCKOUT', 1, 100);
    await expect('post', `/tournaments/${t.id}/manual-register`, { userId: customer.id, teamName: 'Cash Team', paymentStatus: 'PAID' }, 400);
    const attempts = await Promise.all([api('post', `/tournaments/${t.id}/manual-register`, { userId: customer.id, teamName: 'A' }), api('post', `/tournaments/${t.id}/manual-register`, { userId: other.id, teamName: 'B' })]);
    assert.deepEqual(attempts.map(r => r.status).sort(), [201, 409]);
    const pending = await prisma.payment.findFirst({ where: { tournamentReg: { tournamentId: t.id } } });
    assert.equal(pending.status, 'PENDING');
    await prisma.payment.update({ where: { id: pending.id }, data: { expiresAt: new Date(Date.now() - 1) } });
    await lifecycle.expireReservations();
    assert.equal(await prisma.teamRegistration.count({ where: { tournamentId: t.id, status: 'ACTIVE' } }), 0);
    await expect('put', `/tournaments/${t.id}`, { status: 'ONGOING' });
    await expect('post', `/tournaments/${t.id}/manual-register`, { userId: users[4].id, teamName: 'Closed' }, 409);
  });
  await ok('Three-team knockout byes, progression, locked results and champion', async () => {
    const t = await tournament('KNOCKOUT', 3, 100);
    for (let i = 1; i <= 3; i++) await entry(t, users[i], `Knockout ${i}`, { paymentStatus: 'FREE', waiverReason: 'Demo tournament' });
    const round1 = await fixtures(t, 15);
    assert.equal(round1.length, 2); assert.equal(round1.filter(m => m.isBye).length, 1);
    const semi = round1.find(m => !m.isBye);
    await expect('put', `/matches/${semi.id}/result`, { winner: 'draw' }, 400);
    await expect('put', `/matches/${semi.id}/result`, { winner: 'team1' });
    await expect('put', `/matches/${semi.id}/result`, { winner: 'team2' }, 409);
    assert.equal((await expect('get', `/tournaments/${t.id}`)).status, 'ONGOING');
    const final = await fixtures(t, 16);
    assert.equal(final.length, 1);
    await expect('put', `/matches/${final[0].id}/result`, { winner: 'team1' });
    const completed = await expect('get', `/tournaments/${t.id}`);
    assert.equal(completed.status, 'COMPLETED'); assert.equal(completed.champion, final[0].team1);
  });
  await ok('League standings, champion, fixture venue conflicts and booking conflicts', async () => {
    const t = await tournament('LEAGUE');
    for (let i = 1; i <= 3; i++) await entry(t, users[i], `League ${i}`);
    const matches = await fixtures(t, 17);
    assert.equal(matches.length, 3);
    for (const m of matches) await expect('put', `/matches/${m.id}/result`, { winner: 'team1', team1Score: '2', team2Score: '0' });
    const completed = await expect('get', `/tournaments/${t.id}`);
    assert.equal(completed.standings[0].points, 6); assert.equal(completed.champion, 'League 1');
    await expect('post', '/bookings/slots', { venueId: venue.id, date: date(17), startTime: '10:00', endTime: '11:00' }, 409);
    const clash = await tournament('LEAGUE');
    await entry(clash, customer, 'Clash A'); await entry(clash, other, 'Clash B');
    await expect('post', `/tournaments/${clash.id}/fixtures`, { scheduledAt: time(17), venue: venue.name, durationMinutes: 60, intervalMinutes: 90 }, 409);
    assert.equal(await prisma.match.count({ where: { tournamentId: clash.id } }), 0);
  });
  await ok('Event capacity race, unpaid expiry, cancellation refund and attendance', async () => {
    const e = await expect('post', '/events', { name: `${prefix} Event`, sportId: sport.id, fee: 50, maxParticipants: 1, startDate: time(13), endDate: time(13, '12:00'), venue: venue.name }, 201);
    const attempts = await Promise.all([api('post', `/events/${e.id}/register`, {}, customer), api('post', `/events/${e.id}/register`, {}, other)]);
    assert.deepEqual(attempts.map(r => r.status).sort(), [201, 409]);
    const first = attempts.find(r => r.status === 201).body.data;
    await prisma.payment.update({ where: { id: first.paymentId }, data: { expiresAt: new Date(Date.now() - 1) } });
    await lifecycle.expireReservations();
    const r = await expect('post', `/events/${e.id}/register`, {}, 201, users[4]);
    await expect('post', `/events/${e.id}/registrations/${r.id}/attend`, {}, 409);
    await expect('post', '/payments/confirm', { paymentId: r.paymentId, receivedInPerson: true });
    await expect('put', `/events/${e.id}`, { status: 'CANCELLED' });
    assert.equal((await prisma.eventRegistration.findUnique({ where: { id: r.id } })).status, 'CANCELLED');
    assert.equal(await prisma.refund.count({ where: { paymentId: r.paymentId } }), 1);
    await expect('post', `/events/${e.id}/register`, {}, 409, users[3]);
    const live = await prisma.event.create({ data: { name: `${prefix} Live attendance`, sportId: sport.id, startDate: new Date(Date.now() - 600000), endDate: new Date(Date.now() + 3600000), status: 'ONGOING' } });
    const reg = await prisma.eventRegistration.create({ data: { eventId: live.id, userId: customer.id } });
    await expect('post', `/events/${live.id}/registrations/${reg.id}/attend`, {}, 403, customer);
    await expect('post', `/events/${live.id}/registrations/${reg.id}/attend`, {});
    await expect('post', `/events/${live.id}/registrations/${reg.id}/attend`, {}, 409);
  });
  console.log(`\n${results.length} acceptance groups passed. Provider interactions were simulated; no money moved.`);
}
async function cleanup() {
  if (!sport) { await prisma.user.deleteMany({ where: { id: { in: users.map(u => u.id) } } }); return; }
  const ids = users.map(u => u.id);
  await prisma.refund.deleteMany({ where: { payment: { userId: { in: ids } } } });
  await prisma.payment.deleteMany({ where: { userId: { in: ids } } });
  await prisma.booking.deleteMany({ where: { userId: { in: ids } } });
  await prisma.bookingSlot.deleteMany({ where: { venue: { sportId: sport.id } } });
  await prisma.venueClosure.deleteMany({ where: { venue: { sportId: sport.id } } });
  await prisma.venue.deleteMany({ where: { sportId: sport.id } });
  await prisma.match.deleteMany({ where: { tournament: { sportId: sport.id } } });
  await prisma.teamRegistration.deleteMany({ where: { tournament: { sportId: sport.id } } });
  await prisma.tournament.deleteMany({ where: { sportId: sport.id } });
  await prisma.eventRegistration.deleteMany({ where: { event: { sportId: sport.id } } });
  await prisma.event.deleteMany({ where: { sportId: sport.id } });
  await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.sport.delete({ where: { id: sport.id } });
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => { try { await cleanup(); } finally { await prisma.$disconnect(); } });
