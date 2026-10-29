const prisma = require('../lib/prisma');
const { reportRange, inRange, ledger } = require('../lib/report-policy');
const { startsAt, assertVenueAvailable } = require('../lib/arena-time');
const { expireReservations } = require('../lib/reservation-lifecycle');
const wrap = fn => async (req, res, next) => { try { await fn(req, res); } catch (e) { next(e); } };
const dateWhere = range => ({ ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lt: range.to } : {}) });
exports.getRevenueSummary = wrap(async (req, res) => {
  const range = reportRange(req.query);
  const data = await prisma.$transaction(async tx => {
    const payments = await tx.payment.findMany({ where: { status: { in: ['PAID', 'REFUNDED'] } } });
    const refunds = await tx.refund.findMany({ include: { payment: true } });
    return ledger(payments, refunds, range);
  }, { isolationLevel: 'RepeatableRead' });
  res.json({ success: true, data });
});
exports.getBookingAnalytics = wrap(async (req, res) => {
  const range = reportRange(req.query);
  const rows = await prisma.booking.groupBy({ by: ['status'], where: { createdAt: dateWhere(range) }, _count: { id: true } });
  res.json({ success: true, data: { statusCounts: Object.fromEntries(rows.map(b => [b.status, b._count.id])) } });
});
exports.getUtilizationReport = wrap(async (req, res) => {
  const range = reportRange(req.query); await expireReservations();
  const rows = await prisma.bookingSlot.findMany({ where: { venue: { isActive: true, sport: { isActive: true } } }, include: { venue: { include: { sport: true } }, bookings: { where: { status: { in: ['CONFIRMED', 'SCANNED'] } } } } });
  let totalSlots = 0, bookedSlots = 0, totalMinutes = 0, bookedMinutes = 0;
  for (const slot of rows) {
    if (!inRange(startsAt(slot), range)) continue;
    const booked = slot.bookings.length > 0;
    // Honour reservations already sold, but exclude closures and events from unsold capacity.
    if (!booked) { try { await assertVenueAvailable(prisma, slot.venue, slot); } catch (e) { if (e.status === 409) continue; throw e; } }
    const mins = t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
    const duration = Math.max(0, mins(slot.endTime) - mins(slot.startTime));
    totalSlots++; totalMinutes += duration;
    if (booked) { bookedSlots++; bookedMinutes += duration; }
  }
  res.json({ success: true, data: { totalSlots, bookedSlots, totalMinutes, bookedMinutes, utilizationRate: totalMinutes ? bookedMinutes / totalMinutes * 100 : 0 } });
});
exports.getCustomerAnalytics = wrap(async (req, res) => {
  const range = reportRange(req.query);
  const customers = await prisma.user.findMany({ where: { role: 'CUSTOMER' }, select: { id: true, name: true, email: true, createdAt: true } });
  const payments = await prisma.payment.findMany({ where: { status: { in: ['PAID', 'REFUNDED'] }, user: { role: 'CUSTOMER' } } });
  const refunds = await prisma.refund.findMany({ include: { payment: true } });
  const totals = new Map();
  for (const p of payments) if (inRange(p.paidAt || p.createdAt, range)) totals.set(p.userId, (totals.get(p.userId) || 0) + p.amount);
  for (const r of refunds) {
    if (r.providerIntentId && r.providerIntentId !== r.payment.stripePaymentIntentId && inRange(r.createdAt, range)) totals.set(r.payment.userId, (totals.get(r.payment.userId) || 0) + r.amount);
    if (r.status === 'REFUNDED' && inRange(r.updatedAt, range)) totals.set(r.payment.userId, (totals.get(r.payment.userId) || 0) - r.amount);
  }
  const topCustomers = customers.map(user => ({ user, totalSpent: Math.round((totals.get(user.id) || 0) * 100) / 100 })).filter(c => c.totalSpent > 0).sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 5);
  res.json({ success: true, data: { totalCustomers: customers.filter(u => !range.to || u.createdAt < range.to).length, topCustomers } });
});
exports.exportBookingsCsv = wrap(async (req, res) => {
  const range = reportRange(req.query);
  const bookings = await prisma.booking.findMany({ where: { createdAt: dateWhere(range) }, include: { user: true, slot: { include: { venue: true } } }, orderBy: { createdAt: 'desc' } });
  const cell = value => `"${String(value ?? '').replace(/^[\s]*[=+@-]/, "'$&").replaceAll('"', '""')}"`;
  const csv = 'ID,Created Date,User Name,User Email,Venue,Total Price,Status\n' + bookings.map(b => [b.id, b.createdAt.toISOString(), b.user.name, b.user.email, b.slot.venue.name, b.finalPrice, b.status].map(cell).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv'); res.setHeader('Content-Disposition', 'attachment; filename="bookings.csv"'); res.send(csv);
});
