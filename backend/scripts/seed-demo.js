// Run only against the isolated local demo database configured for this project.
require('dotenv').config({ quiet: true });
const url = new URL(process.env.DATABASE_URL);
if (url.hostname !== '127.0.0.1' || url.port !== '3307' || url.pathname !== '/smart_sports_hub_demo') {
  throw new Error('Demo seeding requires the isolated localhost:3307/smart_sports_hub_demo database');
}
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');
const { randomUUID } = require('node:crypto');
const prisma = new PrismaClient();
const future = days => new Date(new Date(Date.now() + days * 86400000).toISOString().slice(0, 10));
async function main() {
  const admin = await prisma.user.upsert({ where: { email: 'admin@smartsportshub.com' }, update: {}, create: {
    name: 'Demo Administrator', email: 'admin@smartsportshub.com', password: await bcrypt.hash('admin123', 10), role: 'ADMIN',
  } });
  const customer = await prisma.user.upsert({ where: { email: 'user@smartsportshub.com' }, update: {}, create: {
    name: 'Demo Player', email: 'user@smartsportshub.com', password: await bcrypt.hash('customer123', 10), role: 'CUSTOMER', phone: '03000000000',
  } });
  const names = ['Cricket', 'Football', 'Basketball', 'Hockey', 'Polo', 'Swimming', 'Chess', 'Padel'];
  const icons = ['🏏', '⚽', '🏀', '🏑', '🐴', '🏊', '♟️', '🎾'];
  const sports = [];
  const venues = [];
  for (let i = 0; i < names.length; i++) {
    const sport = await prisma.sport.upsert({ where: { name: names[i] }, update: {}, create: { name: names[i], icon: icons[i], description: `${names[i]} facilities — local demo data` } });
    sports.push(sport);
    const venue = await prisma.venue.upsert({ where: { id: i + 1 }, update: {}, create: { id: i + 1, name: `Demo ${names[i]} ${i === 5 ? 'Pool' : i === 6 ? 'Hall' : 'Arena'}`, description: 'Sample facility for exploring the project.', sportId: sport.id, capacity: 20, pricePerSlot: [2500,1500,600,1200,3000,500,200,1800][i] } });
    venues.push(venue);
    for (let day = 1; day <= 7; day++) {
      for (const hour of [10, 14, 18]) {
        const startTime = `${hour}:00`;
        const existing = await prisma.bookingSlot.findFirst({ where: { venueId: venue.id, date: future(day), startTime } });
        if (!existing) await prisma.bookingSlot.create({ data: { venueId: venue.id, date: future(day), startTime, endTime: `${hour + 1}:00` } });
      }
    }
  }
  for (const [i, status] of ['CONFIRMED', 'PENDING_PAYMENT'].entries()) {
    const notes = `Demo starter booking ${i + 1}`;
    if (await prisma.booking.findFirst({ where: { userId: customer.id, notes } })) continue;
    const slot = await prisma.bookingSlot.findFirst({ where: { venueId: venues[i].id, date: future(i + 2), isBooked: false }, orderBy: { startTime: 'asc' } });
    const token = randomUUID();
    await prisma.$transaction(async tx => {
      const booking = await tx.booking.create({ data: { userId: customer.id, slotId: slot.id, notes, status, qrToken: token, basePrice: venues[i].pricePerSlot, finalPrice: venues[i].pricePerSlot } });
      await tx.booking.update({ where: { id: booking.id }, data: { qrCode: await QRCode.toDataURL(JSON.stringify({ bookingId: booking.id, token, userId: customer.id })) } });
      await tx.bookingSlot.update({ where: { id: slot.id }, data: { isBooked: true } });
      await tx.payment.create({ data: { userId: customer.id, bookingId: booking.id, amount: booking.finalPrice, purpose: 'BOOKING', status: status === 'CONFIRMED' ? 'PAID' : 'PENDING' } });
    });
  }
  const tournament = await prisma.tournament.upsert({ where: { id: 1 }, update: {}, create: { id: 1, name: 'Demo Cricket Cup', description: 'Sample knockout competition', sportId: sports[0].id, startDate: future(10), endDate: future(14), maxTeams: 8, entryFee: 0, format: 'KNOCKOUT' } });
  await prisma.teamRegistration.upsert({ where: { tournamentId_userId: { tournamentId: tournament.id, userId: customer.id } }, update: {}, create: { tournamentId: tournament.id, userId: customer.id, teamName: 'Demo Falcons' } });
  await prisma.match.upsert({ where: { id: 1 }, update: {}, create: { id: 1, tournamentId: tournament.id, team1: 'Demo Falcons', team2: 'Demo Tigers', scheduledAt: new Date(future(10).getTime() + 10 * 3600000), venue: venues[0].name, round: 'Exhibition' } });
  await prisma.event.upsert({ where: { id: 1 }, update: {}, create: { id: 1, name: 'Demo Football Coaching', description: 'Free sample coaching session', sportId: sports[1].id, type: 'COACHING', startDate: future(5), endDate: future(5), venue: venues[1].name, maxParticipants: 25, fee: 0 } });
  await prisma.eventRegistration.upsert({ where: { eventId_userId: { eventId: 1, userId: customer.id } }, update: {}, create: { eventId: 1, userId: customer.id } });
  for (const [i, name] of ['Cricket Bat', 'Football', 'Basketball'].entries()) {
    await prisma.equipment.upsert({ where: { id: i + 1 }, update: {}, create: { id: i + 1, name: `Demo ${name}`, sportId: sports[i].id, quantity: 10, pricePerSlot: 200 } });
  }
  await prisma.membership.upsert({ where: { userId: customer.id }, update: {}, create: { userId: customer.id, tier: 'BASIC', cardNumber: 'SSH-DEMO-PLAYER', isActive: true } });
  await prisma.promoCode.upsert({ where: { code: 'WELCOME20' }, update: {}, create: { code: 'WELCOME20', discountType: 'PERCENTAGE', discountValue: 20, maxUses: 100, expiresAt: future(90) } });
  await prisma.notification.upsert({ where: { id: 1 }, update: {}, create: { id: 1, userId: customer.id, title: 'Welcome to your demo', body: 'All records in this database are sample data. Explore sports, bookings and your membership.' } });
  await prisma.complaint.upsert({ where: { id: 1 }, update: {}, create: { id: 1, userId: customer.id, title: 'Demo facility question', description: 'Is equipment included with a court reservation? This is a sample support request.', category: 'General' } });
  console.log(`Demo ready: ${await prisma.sport.count()} sports, ${await prisma.venue.count()} venues, ${await prisma.bookingSlot.count()} slots. Customer and administrator accounts available.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
