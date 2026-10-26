const startsAt = slot => new Date(`${slot.date.toISOString().slice(0, 10)}T${slot.startTime}:00+05:00`);
const endsAt = slot => new Date(`${slot.date.toISOString().slice(0, 10)}T${slot.endTime}:00+05:00`);
const fail = (message, status = 409) => Object.assign(new Error(message), { status });
const deadline = () => new Date(Date.now() + 30 * 60000);
const hasNotice = (start, role, now = Date.now()) => role === 'ADMIN' || new Date(start).getTime() - now >= 7200000;

async function assertVenueAvailable(tx, venue, slot) {
  if (!venue?.isActive || venue.sport?.isActive === false) throw fail('Venue or sport is unavailable');
  const day = slot.date.getUTCDay();
  if ((venue.closedWeekdays || []).includes(day) || slot.startTime < (venue.openingTime || '06:00') || slot.endTime > (venue.closingTime || '23:00')) throw fail('Session is outside venue opening hours');
  const closure = await tx.venueClosure.findFirst({ where: { venueId: venue.id, startAt: { lt: endsAt(slot) }, endAt: { gt: startsAt(slot) } } });
  if (closure) throw fail(`Venue closed: ${closure.reason}`);
  const matches = await tx.match.findMany({ where: { venue: venue.name, isBye: false, scheduledAt: { lt: endsAt(slot) } } });
  if (matches.some(m => new Date(m.scheduledAt.getTime() + m.durationMinutes * 60000) > startsAt(slot))) throw fail('Venue is reserved for a tournament match');
  const events = await tx.event.findMany({ where: { venue: venue.name, status: { not: 'CANCELLED' }, startDate: { lt: endsAt(slot) } } });
  if (events.some(e => (e.endDate || new Date(e.startDate.getTime() + 7200000)) > startsAt(slot))) throw fail('Venue is reserved for an event');
}
module.exports = { startsAt, endsAt, fail, deadline, assertVenueAvailable, hasNotice };
