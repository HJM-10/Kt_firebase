const { fail } = require('./arena-time');
const today = (now = new Date()) => new Date(now.getTime() + 5 * 3600000).toISOString().slice(0, 10);
function day(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw fail('Use a valid YYYY-MM-DD rental date', 400);
  return new Date(value);
}
function period(body, now = new Date()) {
  const start = day(body.rentalDate);
  const end = day(body.returnDate || body.rentalDate);
  if (start.toISOString().slice(0, 10) < today(now) || end < start) throw fail('Rental dates must start today or later, with return on or after collection', 400);
  const days = (end - start) / 86400000 + 1;
  if (days > 90) throw fail('Rentals cannot exceed 90 days', 400);
  return { start, end, days };
}
const money = value => Math.round((value + Number.EPSILON) * 100) / 100;
const overlap = (equipmentId, start, end) => ({ equipmentId, status: { in: ['PENDING_PAYMENT', 'CONFIRMED'] }, rentalDate: { lte: end }, OR: [{ returnDate: { gte: start } }, { returnDate: null, rentalDate: { gte: start } }, { status: 'CONFIRMED', returnDate: { lt: new Date(today()) } }] });
// Peak concurrent reservations, rather than summing rentals on disjoint dates.
function peakReserved(rentals, start, end) {
  const changes = new Map();
  for (const r of rentals) {
    const a = Math.max(+start, +new Date(r.rentalDate));
    const overdue = r.status === 'CONFIRMED' && new Date(r.returnDate || r.rentalDate) < new Date(today());
    const b = overdue ? +end : Math.min(+end, +new Date(r.returnDate || r.rentalDate));
    changes.set(a, (changes.get(a) || 0) + r.quantity);
    changes.set(b + 86400000, (changes.get(b + 86400000) || 0) - r.quantity);
  }
  let current = 0, peak = 0;
  for (const [, change] of [...changes].sort((a, b) => a[0] - b[0])) { current += change; peak = Math.max(peak, current); }
  return peak;
}
module.exports = { today, day, period, money, overlap, peakReserved };
