// Additive, repeatable visual-preview data for this project's isolated demo only.
require('dotenv').config({ quiet: true });
const database = new URL(process.env.DATABASE_URL);
if (process.env.NODE_ENV === 'production' || database.hostname !== '127.0.0.1' || database.port !== '3307' || database.pathname !== '/smart_sports_hub_demo') {
  throw new Error('Arena preview data requires the isolated localhost:3307/smart_sports_hub_demo database');
}
const prisma = require('../src/lib/prisma');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('node:crypto');
const QRCode = require('qrcode');
const prefix = 'ARENA_DESK_DEMO';
const clock = new Date();
const pakistan = new Date(clock.getTime() + 5 * 3600000);
const today = pakistan.toISOString().slice(0, 10);
const hour = pakistan.getUTCHours();
const baseHour = Math.min(19, Math.max(10, hour + 1));
const time = h => `${String(h).padStart(2, '0')}:00`;
const day = offset => new Date(new Date(today).getTime() + offset * 86400000).toISOString().slice(0, 10);

async function slotFor(venue, date, startTime, endTime) {
  const slots = await prisma.bookingSlot.findMany({ where: { venueId: venue.id, date: new Date(date) } });
  const exact = slots.find(s => s.startTime === startTime && s.endTime === endTime);
  if (exact) return exact;
  if (slots.some(s => startTime < s.endTime && endTime > s.startTime)) return null;
  return prisma.bookingSlot.create({ data: { venueId: venue.id, date: new Date(date), startTime, endTime } });
}

async function sampleBooking(venue, date, startTime, endTime, user, status) {
  const notes = `${prefix} | ${date} | ${venue.id} | ${startTime} | Simulated preview, no real money collected`;
  if (await prisma.booking.findFirst({ where: { notes } })) return;
  const slot = await slotFor(venue, date, startTime, endTime);
  if (!slot || slot.isBooked) return;
  const other = await prisma.booking.findFirst({ where: { slotId: slot.id, OR: [{ notes: null }, { NOT: { notes: { startsWith: prefix } } }] } });
  if (other) return;
  const token = randomUUID();
  await prisma.$transaction(async tx => {
    const claimed = await tx.bookingSlot.updateMany({ where: { id: slot.id, isBooked: false }, data: { isBooked: status !== 'CANCELLED' } });
    if (!claimed.count) return;
    const booking = await tx.booking.create({ data: {
      userId: user.id, slotId: slot.id, notes, status, qrToken: token,
      basePrice: venue.pricePerSlot, finalPrice: venue.pricePerSlot,
    } });
    await tx.booking.update({ where: { id: booking.id }, data: { qrCode: await QRCode.toDataURL(JSON.stringify({ bookingId: booking.id, token, userId: user.id })) } });
    await tx.payment.create({ data: {
      userId: user.id, bookingId: booking.id, amount: booking.finalPrice, purpose: 'BOOKING',
      status: status === 'PENDING_PAYMENT' ? 'PENDING' : status === 'CANCELLED' ? 'REFUNDED' : 'PAID',
    } });
  });
}

async function main() {
  const users = [];
  for (const [index, name] of ['Ali Khan', 'Sara Ahmed', 'Umar Farooq', 'Ayesha Malik', 'Hassan Ali', 'Zara Noor'].entries()) {
    users.push(await prisma.user.upsert({
      where: { email: `arena.preview.${index + 1}@example.test` }, update: {},
      create: { name: `Demo ${name}`, email: `arena.preview.${index + 1}@example.test`, phone: `0300999000${index}`, password: await bcrypt.hash(randomUUID(), 10), role: 'CUSTOMER' },
    }));
  }
  const names = ['Basketball', 'Chess', 'Cricket', 'Football', 'Hockey', 'Padel', 'Polo', 'Swimming'];
  const venues = [];
  for (const name of names) {
    const sport = await prisma.sport.findUnique({ where: { name } });
    if (!sport || !sport.isActive) continue;
    const venue = await prisma.venue.findFirst({ where: { sportId: sport.id, name: { startsWith: 'Demo ' }, isActive: true }, orderBy: { id: 'asc' } });
    if (venue) venues.push(venue);
    if (name === 'Padel') {
      for (const number of ['01', '02']) {
        const courtName = `Demo Padel Court ${number}`;
        let court = await prisma.venue.findFirst({ where: { name: courtName, sportId: sport.id } });
        if (!court) court = await prisma.venue.create({ data: {
          name: courtName, description: 'Illustrative Clubhouse preview court. All bookings on this fixture are dummy data.',
          sportId: sport.id, capacity: 4, pricePerSlot: 2000,
        } });
        if (court.isActive) venues.push(court);
      }
    }
  }
  for (const venue of venues) {
    for (let offset = 0; offset < 3; offset++) {
      for (let i = 0; i < 4; i++) await slotFor(venue, day(offset), time(baseHour + i), time(baseHour + i + 1));
    }
  }
  const padel = venues.filter(v => v.name.startsWith('Demo Padel Court'));
  const basketball = venues.find(v => v.sportId && v.name.includes('Basketball'));
  const pool = venues.find(v => v.name.includes('Swimming') || v.name.includes('Pool'));
  const cricket = venues.find(v => v.name.includes('Cricket'));
  const booked = [padel[0], basketball, padel[1], pool].filter(Boolean);
  for (let offset = 0; offset < 3; offset++) {
    for (const [index, venue] of booked.entries()) {
      await sampleBooking(venue, day(offset), time(baseHour), time(baseHour + 1), users[index], index === 2 ? 'PENDING_PAYMENT' : 'CONFIRMED');
      await sampleBooking(venue, day(offset), time(baseHour + 2), time(baseHour + 3), users[(index + 2) % users.length], index === 1 ? 'PENDING_PAYMENT' : 'CONFIRMED');
    }
  }
  // Add a visible ongoing example without claiming a real customer attended.
  if (padel[0] && hour < 23 && hour < baseHour) {
    await sampleBooking(padel[0], today, time(hour), time(hour + 1), users[5], 'SCANNED');
  }
  if (cricket) await sampleBooking(cricket, today, time(baseHour + 1), time(baseHour + 2), users[4], 'CANCELLED');
  console.log(`Arena Desk preview ready for ${today}: ${venues.length} demo facilities, 3 days of sessions, ${await prisma.booking.count({ where: { notes: { startsWith: prefix } } })} labelled sample bookings. All payments are simulated.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
