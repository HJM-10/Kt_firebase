// Run only against the isolated local demo database; cleans up its own fixtures.
require('../backend/node_modules/dotenv').config({path: require('node:path').join(__dirname, '../backend/.env'), quiet:true});
const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
const jwt = require('../backend/node_modules/jsonwebtoken');
const prisma = require('../backend/src/lib/prisma');
const db = new URL(process.env.DATABASE_URL);
if (db.hostname !== '127.0.0.1' || db.port !== '3307' || db.pathname !== '/smart_sports_hub_demo') throw Error('Demo database required');
const label = `QR_VERIFY_${randomUUID()}`;
let user, sport, venue;
const ids = [], slots = [];
async function api(path, token, body, method=body ? 'POST' : 'GET') {
 const response = await fetch(`http://127.0.0.1:5000/api${path}`, {method, headers:{Authorization:`Bearer ${token}`, 'Content-Type':'application/json'}, ...(body ? {body:JSON.stringify(body)} : {})});
 return {status:response.status, ...await response.json()};
}
async function fixture(date, startTime, endTime, status='CONFIRMED') {
 const slot = await prisma.bookingSlot.create({data:{venueId:venue.id,date:new Date(`${date}T00:00:00Z`),startTime,endTime,isBooked:true}}); slots.push(slot.id);
 const booking = await prisma.booking.create({data:{userId:user.id,slotId:slot.id,status,qrToken:randomUUID(),notes:label}}); ids.push(booking.id); return booking;
}
(async()=>{
 try {
 const admin = await prisma.user.findFirst({where:{role:'ADMIN'}});
 const token = jwt.sign({id:admin.id,role:'ADMIN'},process.env.JWT_SECRET,{expiresIn:'10m'});
 user = await prisma.user.create({data:{name:label,email:`${label}@example.test`,password:'test-only',role:'CUSTOMER'}});
 sport = await prisma.sport.create({data:{name:label}});
 venue = await prisma.venue.create({data:{name:label,sportId:sport.id,openingTime:'00:00',closingTime:'23:59'}});
 const local = new Date(Date.now()+5*3600000); const today = local.toISOString().slice(0,10);
 const tomorrow = new Date(local.getTime()+86400000).toISOString().slice(0,10);
 const yesterday = new Date(local.getTime()-86400000).toISOString().slice(0,10);
 const active = await fixture(today,'00:00','23:59');
 const pass = await api(`/bookings/${active.id}/qr`,token);
 assert.equal(pass.status,200); assert.equal(pass.data.entryPass.status,'VALID'); assert.match(pass.data.qrCode,/^data:image\/png;base64,/);
 assert.equal(pass.data.booking.qrToken,undefined);
 const scans = await Promise.all([api('/bookings/scan',token,{qrToken:pass.data.qrToken}),api('/bookings/scan',token,{qrToken:pass.data.qrToken})]);
 assert.equal(scans.filter(r=>r.status===200).length,1); assert.equal((await prisma.booking.findUnique({where:{id:active.id}})).status,'SCANNED');
 console.log('PASS real-database simultaneous scans: exactly one admission');
 for(const [date,status,expected] of [[yesterday,'CONFIRMED','EXPIRED'],[today,'PENDING_PAYMENT','PAYMENT_REQUIRED'],[today,'CANCELLED','CANCELLED']]) {
  const booking=await fixture(date,'00:00','23:59',status);
  const result=await api(`/bookings/${booking.id}/qr`,token); assert.equal(result.data.entryPass.status,expected); assert.equal(result.data.qrToken,null);
  assert.notEqual((await api('/bookings/scan',token,{qrToken:booking.qrToken})).status,200);
 }
 console.log('PASS expired, unpaid and cancelled passes cannot check in');
 const future=await fixture(tomorrow,'20:00','21:00');
 const target=await prisma.bookingSlot.create({data:{venueId:venue.id,date:new Date(`${tomorrow}T00:00:00Z`),startTime:'21:00',endTime:'22:00'}});slots.push(target.id);
 const old=await api(`/bookings/${future.id}/qr`,token);
 const moved=await api(`/bookings/${future.id}/reschedule`,token,{slotId:target.id},'PUT'); assert.equal(moved.status,200,JSON.stringify(moved));
 const fresh=await api(`/bookings/${future.id}/qr`,token);assert.notEqual(fresh.data.qrToken,old.data.qrToken);
 assert.equal((await api('/bookings/scan',token,{qrToken:old.data.qrToken})).status,404);
 assert.equal(fresh.data.entryPass.expiresAt,`${tomorrow}T17:00:00.000Z`);
 console.log('PASS reschedule rotates QR, rejects old pass and uses new session end');
 } finally {
 if (user) await prisma.notification.deleteMany({where:{userId:user.id}});
 if(ids.length) await prisma.booking.deleteMany({where:{id:{in:ids}}});
 if(slots.length) await prisma.bookingSlot.deleteMany({where:{id:{in:slots}}});
 if(venue) await prisma.venue.delete({where:{id:venue.id}});
 if(sport) await prisma.sport.delete({where:{id:sport.id}});
 if(user) await prisma.user.delete({where:{id:user.id}});
 await prisma.$disconnect();
 }
})().catch(e=>{console.error(e);process.exitCode=1});
