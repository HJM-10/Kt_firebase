const prisma = require('../lib/prisma');
const { startsAt, assertVenueAvailable } = require('../lib/arena-time');
const { expireReservations } = require('../lib/reservation-lifecycle');
const { today } = require('../lib/equipment-policy');
exports.getRecommendedSlots = async (req, res, next) => {
  try {
    await expireReservations();
    const history = await prisma.booking.findMany({ where: { userId: req.user.id, status: { in: ['CONFIRMED', 'SCANNED'] } }, include: { slot: { include: { venue: true } } }, orderBy: { createdAt: 'desc' }, take: 100 });
    const venues = {}, sports = {};
    for (const b of history) { venues[b.slot.venueId] = (venues[b.slot.venueId] || 0) + 1; sports[b.slot.venue.sportId] = (sports[b.slot.venue.sportId] || 0) + 1; }
    const now = new Date(), until = new Date(now.getTime() + 7 * 86400000);
    const slots = await prisma.bookingSlot.findMany({ where: { isBooked: false, date: { gte: new Date(today(now)), lte: new Date(today(until)) }, venue: { isActive: true, sport: { isActive: true } } }, include: { venue: { include: { sport: true } } }, orderBy: [{ date: 'asc' }, { startTime: 'asc' }] });
    const available = [];
    for (const slot of slots) {
      if (startsAt(slot) <= now || startsAt(slot) > until) continue;
      try { await assertVenueAvailable(prisma, slot.venue, slot); } catch (e) { if (e.status === 409) continue; throw e; }
      available.push({ ...slot, recommendationReason: venues[slot.venueId] ? 'A venue you have booked before' : sports[slot.venue.sportId] ? 'Matches your favourite sport' : 'Available in the next seven days', score: (venues[slot.venueId] || 0) * 3 + (sports[slot.venue.sportId] || 0) });
    }
    available.sort((a, b) => b.score - a.score || startsAt(a) - startsAt(b) || a.id - b.id);
    res.json({ success: true, data: available.slice(0, 5) });
  } catch (e) { next(e); }
};
