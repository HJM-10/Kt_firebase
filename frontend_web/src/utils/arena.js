export const arenaDay = (now = new Date()) => new Date(now.getTime() + 5 * 3600000).toISOString().slice(0, 10);
export const validDay = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
export const rentalDays = (from, to) => validDay(from) && validDay(to) && to >= from ? Math.round((new Date(to) - new Date(from)) / 86400000) + 1 : null;
export const money = value => `PKR ${new Intl.NumberFormat('en-PK', { maximumFractionDigits: 2 }).format(Number.isFinite(Number(value)) ? Number(value) : 0)}`;
export const minutes = time => Number(time?.slice(0, 2) || 0) * 60 + Number(time?.slice(3, 5) || 0);
export const sessionStart = slot => new Date(`${String(slot.date).slice(0, 10)}T${slot.startTime}:00+05:00`);
export const statusLabels = { PENDING_PAYMENT: 'Awaiting payment', PENDING: 'Awaiting payment', CONFIRMED: 'Confirmed', SCANNED: 'Checked in', CANCELLED: 'Cancelled', PAID: 'Paid', REFUNDED: 'Refunded', FAILED: 'Failed', RETURNED: 'Returned', OPEN: 'Open session', UNAVAILABLE: 'Unavailable' };
export function slotState(slot) {
  const booking = slot.bookings?.find(b => ['PENDING_PAYMENT', 'CONFIRMED', 'SCANNED'].includes(b.status));
  if (booking) return { status: booking.status, label: booking.user?.name || `Booking #${booking.id}`, booking };
  if (slot.isBooked || slot.unavailableReason) return { status: 'UNAVAILABLE', label: slot.unavailableReason || 'Unavailable' };
  return { status: 'OPEN', label: 'Open session' };
}
export function timelineBounds(venues) {
  const slots = venues.flatMap(v => v.slots || []);
  if (!slots.length) return { start: 8 * 60, end: 22 * 60 };
  return { start: Math.floor(Math.min(...slots.map(s => minutes(s.startTime))) / 60) * 60, end: Math.ceil(Math.max(...slots.map(s => minutes(s.endTime))) / 60) * 60 };
}
export function filterBookings(bookings, { query = '', status = 'ALL' } = {}) {
  const term = query.trim().toLowerCase();
  return bookings.filter(b => (status === 'ALL' || b.status === status) && (!term || [b.id, b.user?.name, b.user?.email, b.user?.phone, b.slot?.venue?.name, b.slot?.venue?.sport?.name].some(value => String(value ?? '').toLowerCase().includes(term))));
}
export function filterRentals(rentals, { venueId = '', status = 'ALL', query = '' } = {}) {
  const term = query.trim().toLowerCase();
  return rentals.filter(r => (!venueId || String(r.equipment?.venueId) === String(venueId)) && (status === 'ALL' || r.status === status) && (!term || [r.id, r.equipment?.name, r.user?.name, r.status].some(value => String(value ?? '').toLowerCase().includes(term))));
}
export const sportImage = name => {
  const key = String(name || '').toLowerCase();
  const sport = ['padel', 'football', 'cricket', 'basketball', 'chess', 'hockey', 'polo', 'swimming'].find(s => key.includes(s));
  return sport ? `/clubhouse/${sport}.png` : null;
};
