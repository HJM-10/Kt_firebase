const prisma = require('../lib/prisma');
const handleError = require('../middleware/errorHandler');

// All daily operational views use the arena's Pakistan calendar day.
const pakistanDay = now => new Date(now.getTime() + 5 * 3600000).toISOString().slice(0, 10);
const dayBounds = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  const start = new Date(`${value}T00:00:00+05:00`);
  return { date, start, end: new Date(start.getTime() + 86400000) };
};

const getArenaDesk = async (req, res) => {
  try {
    const date = req.query.date === undefined ? pakistanDay(new Date()) : req.query.date;
    const bounds = dayBounds(date);
    if (!bounds) return res.status(400).json({ success: false, message: 'A valid YYYY-MM-DD date is required' });
    const [venues, sports, paid, matches, events] = await Promise.all([
      prisma.venue.findMany({
        orderBy: { name: 'asc' },
        include: {
          closures: true,
          sport: { select: { id: true, name: true, isActive: true, imageUrl: true } },
          slots: {
            where: { date: bounds.date }, orderBy: { startTime: 'asc' },
            include: { bookings: {
              orderBy: { createdAt: 'desc' },
              select: {
                id: true, status: true, finalPrice: true, notes: true,
                user: { select: { id: true, name: true, phone: true } },
                payment: { select: { id: true, status: true, amount: true } },
              },
            } },
          },
        },
      }),
      prisma.sport.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, isActive: true, imageUrl: true } }),
      prisma.payment.aggregate({
        where: { status: 'PAID', updatedAt: { gte: bounds.start, lt: bounds.end } },
        _sum: { amount: true }, _count: { id: true },
      }),
      prisma.match.findMany({ where: { isBye: false, scheduledAt: { lt: bounds.end } } }),
      prisma.event.findMany({ where: { status: { not: 'CANCELLED' }, startDate: { lt: bounds.end } } }),
    ]);
    const { startsAt, endsAt } = require('../lib/arena-time');
    for (const venue of venues) for (const slot of venue.slots) {
      const start = startsAt(slot), end = endsAt(slot);
      let reason;
      if (!venue.isActive || venue.sport?.isActive === false) reason = 'Facility inactive';
      else if (slot.startTime < venue.openingTime || slot.endTime > venue.closingTime || (venue.closedWeekdays || []).includes(slot.date.getUTCDay())) reason = 'Outside opening hours';
      else if ((venue.closures || []).some(c => c.startAt < end && c.endAt > start)) reason = 'Facility closed';
      else if (matches.some(m => m.venue === venue.name && m.scheduledAt < end && new Date(m.scheduledAt.getTime() + m.durationMinutes * 60000) > start)) reason = 'Tournament match';
      else if (events.some(e => e.venue === venue.name && e.startDate < end && (e.endDate || new Date(e.startDate.getTime() + 7200000)) > start)) reason = 'Event';
      if (reason) { slot.unavailableReason = reason; slot.isBooked = true; }
    }
    const bookings = venues.flatMap(venue => venue.slots.flatMap(slot => slot.bookings.map(booking => ({
      ...booking,
      slot: {
        id: slot.id, venueId: venue.id, date: slot.date, startTime: slot.startTime, endTime: slot.endTime,
        venue: { id: venue.id, name: venue.name, imageUrl: venue.imageUrl, sport: venue.sport },
      },
    }))));
    bookings.sort((a, b) => a.slot.startTime.localeCompare(b.slot.startTime) || a.id - b.id);
    const active = bookings.filter(b => b.status !== 'CANCELLED');
    res.json({ success: true, data: {
      date, timezone: 'Asia/Karachi', generatedAt: new Date().toISOString(), venues, sports, bookings,
      summary: {
        bookings: active.length,
        pendingBookings: active.filter(b => b.status === 'PENDING_PAYMENT').length,
        collected: paid._sum.amount || 0,
        paymentCount: paid._count.id,
      },
    } });
  } catch (error) { handleError(error, req, res); }
};

module.exports = { getArenaDesk, dayBounds, pakistanDay };
