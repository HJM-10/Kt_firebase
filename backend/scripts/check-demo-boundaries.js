// Tests the court created in the visible Flutter walkthrough; retains demo history.
require('dotenv').config({ quiet: true });
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const prisma = require('../src/lib/prisma');
const { expireReservations } = require('../src/lib/reservation-lifecycle');
const database = new URL(process.env.DATABASE_URL);
if (database.hostname !== '127.0.0.1' || database.port !== '3307' || database.pathname !== '/smart_sports_hub_demo' || process.env.NODE_ENV === 'production') throw new Error('Requires isolated demo database');
async function main() {
  const admin = await prisma.user.findUnique({ where: { email:'admin@smartsportshub.com' } });
  const customer = await prisma.user.findUnique({ where: { email:'user@smartsportshub.com' } });
  const venue = await prisma.venue.findFirst({ where:{name:'Checklist Demo Court'} });
  const call = async (method,path,body,user=admin,expected=200) => {
    const r = await fetch(`http://127.0.0.1:5000/api${path}`,{method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${jwt.sign({id:user.id},process.env.JWT_SECRET)}`},...(body?{body:JSON.stringify(body)}:{})});
    const json=await r.json();assert.equal(r.status,expected,`${path}: ${JSON.stringify(json)}`);return json.data;
  };
  const day = n => new Date(Date.now()+18000000+n*86400000).toISOString().slice(0,10);
  for (const [label,date,startTime,endTime] of [['outside hours',day(1),'07:00','08:00'],['maintenance closure',day(1),'10:00','11:00'],['weekly Friday closure',day(5),'10:00','11:00']]) {
    await call('POST','/bookings/slots',{venueId:venue.id,date,startTime,endTime},admin,409);console.log(`PASS ${label} rejected on the visible demo court`);
  }
  const slots=[];
  for(const [startTime,endTime] of [['18:00','19:00'],['19:00','20:00'],['20:00','21:00']]) {
    let slot=await prisma.bookingSlot.findFirst({where:{venueId:venue.id,date:new Date(day(0)),startTime}});
    if(!slot) slot=await call('POST','/bookings/slots',{venueId:venue.id,date:day(0),startTime,endTime},admin,201);
    slots.push(slot);
  }
  let booking=await prisma.booking.findFirst({where:{userId:customer.id,slotId:slots[0].id,status:{in:['PENDING_PAYMENT','CONFIRMED']}}});
  if(!booking) booking=await call('POST','/bookings',{slotId:slots[0].id,notes:'Checklist demo: reschedule and refund; simulated money only'},customer,201);
  await call('POST','/bookings',{slotId:slots[0].id},customer,409);console.log('PASS second booking of reserved session rejected');
  if(!await prisma.booking.findFirst({where:{slotId:slots[2].id,notes:'Checklist demo expired hold'}})) {
    const expired=await call('POST','/bookings',{slotId:slots[2].id,notes:'Checklist demo expired hold'},customer,201);
    await prisma.payment.update({where:{id:expired.paymentId},data:{expiresAt:new Date(Date.now()-1000)}});
    await expireReservations();
    assert.equal((await prisma.bookingSlot.findUnique({where:{id:slots[2].id}})).isBooked,false);
    console.log(`PASS deliberately expired demo hold #${expired.id} released 8–9 PM for booking`);
  }
  console.log(JSON.stringify({customerBooking:booking.id,rescheduleSlot:slots[1].id,venue:venue.name},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>prisma.$disconnect());
