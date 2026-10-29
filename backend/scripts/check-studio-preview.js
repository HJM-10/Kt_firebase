require('dotenv').config({ quiet: true });
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const db = new URL(process.env.DATABASE_URL);
if (process.env.NODE_ENV === 'production' || db.hostname !== '127.0.0.1' || db.port !== '3307' || db.pathname !== '/smart_sports_hub_demo') throw Error('Studio verification requires the isolated demo database');
const prisma = require('../src/lib/prisma');
const request = require('supertest');
const app = require('../src/app');
const today = new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 10);
async function main() {
  const before = await Promise.all([prisma.equipment.count(), prisma.equipmentRental.count(), prisma.payment.count()]);
  execFileSync(process.execPath, ['scripts/seed-studio-preview.js'], { stdio: 'pipe' });
  const after = await Promise.all([prisma.equipment.count(), prisma.equipmentRental.count(), prisma.payment.count()]);
  assert.deepEqual(after, before, 'Repeated seeding must not duplicate inventory, rentals or payments');
  const login = await request(app).post('/api/auth/login').send({ email: 'admin@smartsportshub.com', password: 'admin123' });
  assert.equal(login.status, 200);
  const get = async path => { const r = await request(app).get('/api' + path).set('Authorization', 'Bearer ' + login.body.data.token); assert.equal(r.status, 200, path); return r.body.data; };
  const items = await get(`/equipment?rentalDate=${today}&returnDate=${today}`);
  const sample = items.filter(e => e.description?.startsWith('ARENA_STUDIO_DEMO'));
  assert.equal(sample.length, 6); assert(sample.every(e => e.imageUrl?.startsWith('/gear/') && e.venueId && e.availableQuantity >= 0 && e.availableQuantity <= e.quantity));
  assert(sample.find(e => e.name === 'Table tennis paddle set').ballType.includes('plastic'));
  assert(sample.find(e => e.name === 'Padel racket').ballType.includes('padel'));
  const assets = [];
  for (const item of sample) { const r = await fetch('http://localhost:5174' + item.imageUrl); assert.equal(r.status, 200); assert(r.headers.get('content-type')?.includes('image/png')); assets.push(item.imageUrl); }
  const rentals = await prisma.equipmentRental.findMany({ where: { damageNotes: { startsWith: 'ARENA_STUDIO_DEMO' } }, include: { equipment: true, payment: true } });
  for (const rental of rentals) { assert.equal(rental.totalPrice, rental.quantity * rental.equipment.pricePerSlot); assert.equal(rental.payment.amount, rental.totalPrice); }
  const payments = await get('/payments'); assert(payments.some(p => p.booking?.slot?.venue?.name)); assert(payments.some(p => p.rental?.equipment?.imageUrl));
  const revenue = await get('/reports/revenue'); assert.equal(revenue.totalRevenue, Math.round((revenue.grossRevenue - revenue.refundedAmount) * 100) / 100); assert(Object.keys(revenue.revenueByMonth).length >= 6);
  const desk = await get(`/reports/arena-desk?date=${today}`); assert(desk.bookings.some(b => b.notes?.startsWith('ARENA_DESK_DEMO')));
  const result = { checkedAt: new Date().toISOString(), status: 'PASS', repeatSeedCountsUnchanged: true, sampleEquipmentTypes: sample.length, sampleRentalsWithMatchingPayments: rentals.length, loadedAssets: assets, revenueMonths: Object.keys(revenue.revenueByMonth).length, checks: ['seed idempotency', 'dated equipment availability and venue associations', 'padel and table-tennis ball specifications', 'six served product images', 'rental pricing and matching payment amounts', 'ledger venue/equipment metadata', 'gross minus completed refunds equals net', 'populated current-day schedule'], environment: 'isolated local demo only; all sample payments are simulated' };
  fs.writeFileSync('../qa/studio-integration-results.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
}
main().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
