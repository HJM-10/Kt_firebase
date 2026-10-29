// Additive UI fixtures. Never run against a production or shared database.
require('dotenv').config({ quiet: true });
const database = new URL(process.env.DATABASE_URL);
if (process.env.NODE_ENV === 'production' || database.hostname !== '127.0.0.1' || database.port !== '3307' || database.pathname !== '/smart_sports_hub_demo') throw Error('Studio preview requires the isolated localhost:3307/smart_sports_hub_demo database');
const prisma = require('../src/lib/prisma');
const prefix = 'ARENA_STUDIO_DEMO';
const today = new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 10);
const nextDay = offset => new Date(new Date(today).getTime() + offset * 86400000).toISOString().slice(0, 10);
const definitions = [
  ['Padel racket', 'Padel', 'padel-racket', 500, 12, 'Carbon-fibre face', 'Control · 365 g', 'Pressurised padel ball'],
  ['Padel balls (can of 3)', 'Padel', 'padel-balls', 200, 20, 'Felt / rubber core', 'Three-ball can', 'Pressurised padel ball · not tennis'],
  ['Cricket bat & leather ball', 'Cricket', 'cricket-bat', 600, 8, 'Willow / leather', 'Adult short handle', 'Red leather cricket ball'],
  ['Football', 'Football', 'football', 300, 12, 'PU outer / rubber bladder', 'Size 5', 'Size 5 football'],
  ['Field hockey stick & ball', 'Hockey', 'hockey-stick', 400, 10, 'Composite shaft', 'Adult · 36.5 inches', 'Solid white field hockey ball'],
  ['Table tennis paddle set', 'Table Tennis', 'table-tennis', 250, 8, 'Wood / rubber faces', 'Two paddles + two balls', '40+ mm ABS plastic ball'],
];
async function rental(item, user, key, status, date, quantity = 1) {
  const marker = `${prefix} | ${key} | Illustrative demo rental. No real payment collected.`;
  let row = await prisma.equipmentRental.findFirst({ where: { damageNotes: marker, equipmentId: item.id, userId: user.id }, include: { payment: true } });
  if (row) return row;
  row = await prisma.equipmentRental.create({ data: { equipmentId: item.id, userId: user.id, quantity, totalPrice: item.pricePerSlot * quantity, rentalDate: new Date(date), returnDate: new Date(date), status, damageNotes: marker, returnedAt: status === 'RETURNED' ? new Date(`${date}T18:00:00+05:00`) : null } });
  const paid = status !== 'PENDING_PAYMENT';
  const payment = await prisma.payment.create({ data: { rentalId: row.id, userId: user.id, amount: row.totalPrice, purpose: 'EQUIPMENT_RENTAL', status: paid ? 'PAID' : 'PENDING', paidAt: paid ? new Date(`${date}T12:00:00+05:00`) : null, createdAt: new Date(`${date}T10:00:00+05:00`), expiresAt: paid ? null : new Date(Date.now() + 30 * 60000) } });
  return { ...row, payment };
}
async function main() {
  const users = await prisma.user.findMany({ where: { email: { startsWith: 'arena.preview.' } }, orderBy: { id: 'asc' } });
  if (users.length < 3) throw Error('Run seed-arena-preview.js first');
  const items = [];
  for (const [name, sportName, asset, price, quantity, material, model, ballType] of definitions) {
    const sport = await prisma.sport.upsert({ where: { name: sportName }, update: {}, create: { name: sportName, description: 'Illustrative demo sport', isActive: true } });
    let venue = await prisma.venue.findFirst({ where: { sportId: sport.id, isActive: true, name: sportName === 'Padel' ? 'Demo Padel Court 01' : { startsWith: 'Demo ' } }, orderBy: { id: 'asc' } });
    if (!venue) venue = await prisma.venue.create({ data: { sportId: sport.id, name: `Demo ${sportName} Studio`, description: 'Illustrative venue for exploring the project.', pricePerSlot: 800, capacity: 4 } });
    const data = { name, sportId: sport.id, venueId: venue.id, brand: 'Club sample', model, material, ballType, condition: 'Good · inspected sample', pricePerSlot: price, quantity, imageUrl: `/gear/${asset}.png`, description: `${prefix} · Illustrative equipment and specifications for demo only.`, isActive: true };
    const existing = await prisma.equipment.findFirst({ where: { name, description: { startsWith: prefix }, venueId: venue.id } });
    const item = existing ? await prisma.equipment.update({ where: { id: existing.id }, data: { imageUrl: data.imageUrl } }) : await prisma.equipment.create({ data });
    items.push(item);
  }
  for (let i = 0; i < 4; i++) await rental(items[i], users[i % users.length], `active-${today}-${i}`, i === 1 ? 'PENDING_PAYMENT' : i === 3 ? 'RETURNED' : 'CONFIRMED', today, i === 1 ? 2 : 1);
  // Keep one useful unpaid example when an older preview hold has expired.
  // Create a new hold only if needed; never revive an expired/cancelled payment.
  const pending = await prisma.equipmentRental.findFirst({ where: { damageNotes: { startsWith: prefix }, rentalDate: new Date(today), status: 'PENDING_PAYMENT', payment: { is: { status: 'PENDING', expiresAt: { gt: new Date() } } } } });
  if (!pending) {
    const held = await prisma.equipmentRental.aggregate({ where: { equipmentId: items[0].id, status: { in: ['CONFIRMED', 'PENDING_PAYMENT'] }, rentalDate: { lte: new Date(today) }, OR: [{ returnDate: { gte: new Date(today) } }, { returnDate: null, rentalDate: new Date(today) }] }, _sum: { quantity: true } });
    if ((held._sum.quantity || 0) < items[0].quantity) await rental(items[0], users[1], `live-preview-${Date.now()}`, 'PENDING_PAYMENT', today);
  }
  for (let i = 5; i >= 0; i--) {
    const date = new Date(`${today.slice(0, 7)}-10T12:00:00Z`); date.setUTCMonth(date.getUTCMonth() - i);
    const day = date.toISOString().slice(0, 10);
    await rental(items[(5 - i) % items.length], users[i % users.length], `history-${day}`, 'RETURNED', day, 6 - i);
    // Several individual, correctly priced rentals make the historical chart
    // useful to inspect; each remains linked to its own sample payment.
    if (i > 0) for (let j = 1; j <= 9; j++) {
      const rentalDay = `${day.slice(0, 8)}${String(10 + j).padStart(2, '0')}`;
      await rental(items[j % items.length], users[j % users.length], `history-${rentalDay}-sample-${j}`, 'RETURNED', rentalDay, 3);
    }
  }
  for (const [key, complete, item] of [['pending-refund', false, items[1]], ['completed-refund', true, items[2]]]) {
    const row = await rental(item, users[2], key, 'CANCELLED', nextDay(-2));
    const sourceKey = `${prefix}:${key}`;
    await prisma.refund.upsert({ where: { sourceKey }, update: {}, create: { sourceKey, paymentId: row.payment.id, amount: row.totalPrice, status: complete ? 'REFUNDED' : 'PENDING', reference: complete ? 'DEMO-REFUND-ONLY' : null } });
    if (complete) await prisma.payment.update({ where: { id: row.payment.id }, data: { status: 'REFUNDED' } });
  }
  await prisma.promoCode.upsert({ where: { code: 'PLAY20' }, update: {}, create: { code: 'PLAY20', discountType: 'PERCENTAGE', discountValue: 20, perCustomerLimit: 1, maxUses: 100, expiresAt: new Date(`${nextDay(90)}T23:59:59+05:00`) } });
  const oldPending = await prisma.booking.findMany({ where: { notes: { startsWith: 'ARENA_DESK_DEMO' }, status: 'PENDING_PAYMENT' }, select: { id: true } });
  await prisma.payment.updateMany({ where: { bookingId: { in: oldPending.map(b => b.id) }, status: 'PENDING', expiresAt: null }, data: { expiresAt: new Date(Date.now() + 30 * 60000) } });
  console.log(`Studio preview ready for ${today}: ${items.length} illustrated equipment types, current rental desk, 6 months of linked sample receipts, completed/pending refund examples and PLAY20. Simulated data only.`);
}
main().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
