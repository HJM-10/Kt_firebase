require('dotenv').config({ quiet: true });
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const database = new URL(process.env.DATABASE_URL);
if (process.env.NODE_ENV === 'production' || database.hostname !== '127.0.0.1' || database.port !== '3307' || database.pathname !== '/smart_sports_hub_demo') throw new Error('Requires isolated local demo database');
const p = new PrismaClient();
async function main() {
  const admin = await p.user.findUnique({ where: { email: 'admin@smartsportshub.com' } });
  const customer = await p.user.findUnique({ where: { email: 'user@smartsportshub.com' } });
  const venue = await p.venue.findFirst({ where: { name: 'Checklist Demo Court' }, include: { closures: true } });
  if (!venue || !admin || !customer) throw new Error('Create the demo court in Flutter and retain the original demo logins first');
  const captains = [customer];
  for (let i = 2; i <= 3; i++) captains.push(await p.user.upsert({ where: { email: `checklist-captain${i}@example.test` }, update: {}, create: { name: `Checklist Demo Captain ${i}`, email: `checklist-captain${i}@example.test`, password: await bcrypt.hash('customer123', 10) } }));
  const call = async (method, path, body, user = admin) => {
    const r = await fetch(`http://127.0.0.1:5000/api${path}`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt.sign({ id: user.id }, process.env.JWT_SECRET)}` }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const json = await r.json(); if (!r.ok) throw new Error(`${method} ${path}: ${json.message}`); return json.data;
  };
  const day = n => new Date(Date.now() + 18000000 + n * 86400000).toISOString().slice(0, 10);
  const at = (n, time) => `${day(n)}T${time}:00+05:00`;
  const tournaments = [];
  for (const [name, format, fee, maxTeams] of [['Knockout','KNOCKOUT',100,3],['League','LEAGUE',0,3],['Registration','KNOCKOUT',300,2]]) {
    let t = await p.tournament.findFirst({ where: { name: `Checklist Demo ${name}` } });
    if (!t) t = await call('POST', '/tournaments', { name: `Checklist Demo ${name}`, sportId: venue.sportId, format, entryFee: fee, maxTeams, startDate: at(1,'08:00'), endDate: at(10,'22:00') });
    if (name !== 'Registration') for (const [i, u] of captains.entries()) {
      if (!await p.teamRegistration.findUnique({ where: { tournamentId_userId: { tournamentId: t.id, userId: u.id } } })) await call('POST', `/tournaments/${t.id}/manual-register`, { userId: u.id, teamName: `${name} Team ${i + 1}`, paymentStatus: fee ? 'FREE' : 'PENDING', ...(fee ? { waiverReason: 'Simulated demo entry, no money collected' } : {}) });
    }
    tournaments.push({ id: t.id, name: t.name });
  }
  let event = await p.event.findFirst({ where: { name: 'Checklist Demo Coaching' } });
  if (!event) event = await call('POST','/events',{ name:'Checklist Demo Coaching', sportId:venue.sportId, type:'COACHING', venue:venue.name, startDate:at(1,'16:00'),endDate:at(1,'18:00'),fee:250,maxParticipants:1 });
  let live = await p.event.findFirst({ where: { name:'Checklist Demo Live Attendance' } });
  if (!live) {
    live = await call('POST','/events',{ name:'Checklist Demo Live Attendance',sportId:venue.sportId,type:'TRAINING',venue:venue.name,startDate:new Date(Date.now()+1800000).toISOString(),endDate:new Date(Date.now()+3600000).toISOString(),fee:100,maxParticipants:3 });
    await call('POST',`/events/${live.id}/register`,{},customer);
    await call('PUT',`/events/${live.id}`,{ startDate:new Date(Date.now()-300000).toISOString(),status:'ONGOING' });
  }
  console.log(JSON.stringify({ venue: { id:venue.id,name:venue.name,price:venue.pricePerSlot,hours:`${venue.openingTime}-${venue.closingTime}`,closedWeekdays:venue.closedWeekdays,closures:venue.closures },tournaments,events:[{id:event.id,name:event.name},{id:live.id,name:live.name}], fixtureSuggestion:{ firstRound:at(1,'12:00'),final:at(2,'12:00'),league:at(3,'10:00') } },null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>p.$disconnect());
