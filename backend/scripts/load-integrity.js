// Exercises the real HTTP app and MySQL. Refuses all non-demo databases.
require('dotenv').config({ quiet: true });
process.env.FIREBASE_ENABLED = 'false';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { performance } = require('node:perf_hooks');
const jwt = require('jsonwebtoken');
const prisma = require('../src/lib/prisma');
const db = new URL(process.env.DATABASE_URL);
if (process.env.NODE_ENV === 'production' || db.hostname !== '127.0.0.1' || db.port !== '3307' || db.pathname !== '/smart_sports_hub_demo') throw Error('Load tests require the isolated local demo database');
const app = require('../src/app');
const server = require('node:http').createServer(app);
const prefix = 'load-' + Date.now();
const report = { startedAt: new Date().toISOString(), environment: 'single local API process + local MariaDB, demo data only', stages: [] };
const users = []; let sport, venue, equipment, base;
async function call(user, method, path, body) {
  const start = performance.now();
  const r = await fetch(base + path, { method, headers: { Authorization: 'Bearer ' + jwt.sign({ id: user.id }, process.env.JWT_SECRET), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000) });
  return { status: r.status, body: await r.json(), ms: performance.now() - start };
}
async function reads(concurrency, count) {
  let index = 0; const samples = [], start = performance.now();
  await Promise.all(Array.from({ length: concurrency }, async () => {
    for (;;) { const n = index++; if (n >= count) break;
      const r = await call(users[1], 'GET', n % 2 ? `/venues/${venue.id}` : '/sports');
      assert.equal(r.status, 200); samples.push(r.ms);
    }
  }));
  samples.sort((a,b) => a-b); const seconds = (performance.now()-start)/1000;
  const stage = { type: 'authenticated HTTP reads', concurrency, requests: count, failures: 0, throughputRps: +(count/seconds).toFixed(1), p50ms: +samples[Math.floor(count*.5)].toFixed(1), p95ms: +samples[Math.floor(count*.95)].toFixed(1), p99ms: +samples[Math.min(count-1,Math.floor(count*.99))].toFixed(1) };
  report.stages.push(stage); console.log('LOAD_RESULT', JSON.stringify(stage));
  assert(stage.p95ms < 3000, 'Local read p95 exceeded 3 seconds');
}
async function main() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
  for (let i=0;i<3;i++) users.push(await prisma.user.create({ data: { name: prefix, email: `${prefix}-${i}@example.test`, password: 'unused', role: i ? 'CUSTOMER' : 'ADMIN' } }));
  sport = await prisma.sport.create({ data: { name: prefix } });
  const created = await call(users[0], 'POST', '/venues', { name: prefix, sportId: sport.id, pricePerSlot: 100, address: 'QA entrance only', latitude: 24.860735, longitude: 67.001137, openingTime: '00:00', closingTime: '23:59' });
  assert.equal(created.status, 201); venue = created.body.data;
  assert.equal((await call(users[1], 'GET', `/venues/${venue.id}`)).body.data.latitude, 24.860735);
  assert.equal((await call(users[1], 'PUT', `/venues/${venue.id}`, { latitude: 1, longitude: 2 })).status, 403);
  assert.equal((await call(users[0], 'PUT', `/venues/${venue.id}`, { latitude: 91, longitude: 0 })).status, 400);
  assert.equal((await call(users[0], 'PUT', `/venues/${venue.id}`, { description: 'renamed without changing location' })).body.data.longitude, 67.001137);
  await reads(1, 100); await reads(10, 300); await reads(40, 600);
  const date = new Date(Date.now()+7*86400000).toISOString().slice(0,10);
  const slot = await prisma.bookingSlot.create({ data: { venueId: venue.id, date: new Date(date), startTime: '12:00', endTime: '13:00' } });
  const bookingRace = await Promise.all(Array.from({ length: 30 }, (_,i) => call(users[1+i%2], 'POST', '/bookings', { slotId: slot.id })));
  assert.equal(bookingRace.filter(r=>r.status===201).length, 1, JSON.stringify(bookingRace.map(r=>({status:r.status,message:r.body.message}))));
  assert(bookingRace.every(r=>r.status===201 || r.status===409), 'Unexpected booking contention error');
  assert.equal(await prisma.booking.count({ where: { slotId: slot.id, status: { not: 'CANCELLED' } } }), 1);
  report.stages.push({ type: 'same-slot booking race', concurrency: 30, confirmedHolds: 1, conflicts: 29, duplicateBookings: 0 });
  equipment = await prisma.equipment.create({ data: { name: prefix, sportId: sport.id, venueId: venue.id, quantity: 3, pricePerSlot: 25 } });
  const rentalRace = await Promise.all(Array.from({length:20}, (_,i)=> call(users[1+i%2], 'POST', `/equipment/${equipment.id}/rent`, { quantity:1, rentalDate:date, returnDate:date })));
  assert.equal(rentalRace.filter(r=>r.status===201).length, 3, JSON.stringify(rentalRace.map(r=>({status:r.status,message:r.body.message}))));
  assert(rentalRace.every(r=>r.status===201||r.status===409));
  const held = await prisma.equipmentRental.aggregate({ where: { equipmentId: equipment.id, status: 'PENDING_PAYMENT' }, _sum: { quantity:true } });
  assert.equal(held._sum.quantity, 3);
  report.stages.push({type:'equipment inventory race', concurrency:20, capacity:3, heldUnits:3, conflicts:17, oversoldUnits:0});
  const clear = await call(users[0], 'PUT', `/venues/${venue.id}`, { latitude:null, longitude:null });
  assert.equal(clear.body.data.latitude, null); assert.equal(clear.body.data.longitude, null);
  report.integrity = 'PASS: location persistence/authorization, one active booking per slot, no inventory oversell, exact payment amounts';
  const payments = await prisma.payment.findMany({where:{userId:{in:users.map(u=>u.id)}}});
  assert.equal(payments.length,4); assert.equal(payments.reduce((sum,p)=>sum+p.amount,0),175);
  report.completedAt = new Date().toISOString();
}
async function cleanup() {
  const ids=users.map(u=>u.id);
  if (ids.length) {
    await prisma.notification.deleteMany({where:{userId:{in:ids}}});
    await prisma.payment.deleteMany({where:{userId:{in:ids}}});
    await prisma.booking.deleteMany({where:{userId:{in:ids}}});
    await prisma.equipmentRental.deleteMany({where:{userId:{in:ids}}});
  }
  if(equipment) await prisma.equipment.delete({where:{id:equipment.id}});
  if(venue) {await prisma.bookingSlot.deleteMany({where:{venueId:venue.id}}); await prisma.venue.delete({where:{id:venue.id}});}
  if(sport) await prisma.sport.delete({where:{id:sport.id}});
  if(ids.length) await prisma.user.deleteMany({where:{id:{in:ids}}});
}
main().catch(e=>{ report.failure=e.message; process.exitCode=1; console.error(e); }).finally(async()=> {
  try { await cleanup(); report.fixtureCleanup='complete'; } catch(e) {report.fixtureCleanup=e.message; process.exitCode=1;}
  fs.writeFileSync('../qa/load-integrity-results.json', JSON.stringify(report,null,2)+'\n');
  server.closeAllConnections(); await new Promise(resolve=>server.close(resolve)); await prisma.$disconnect();
});
