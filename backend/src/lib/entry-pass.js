const { startsAt, endsAt } = require('./arena-time');

function entryPass(booking, now = new Date()) {
  const validFrom = startsAt(booking.slot);
  const expiresAt = endsAt(booking.slot);
  let status = 'VALID';
  if (booking.status === 'CANCELLED') status = 'CANCELLED';
  else if (booking.status === 'SCANNED') status = 'USED';
  else if (booking.status !== 'CONFIRMED') status = 'PAYMENT_REQUIRED';
  else if (now >= expiresAt) status = 'EXPIRED';
  else if (now < validFrom) status = 'UPCOMING';
  const messages = {
    VALID: 'Entry is available until the booked session ends.',
    UPCOMING: 'Entry opens when the booked session starts.',
    EXPIRED: 'This entry pass has expired because the booked session has ended.',
    CANCELLED: 'This booking has been cancelled.',
    USED: 'This entry pass has already been used.',
    PAYMENT_REQUIRED: 'Confirm payment before an entry pass becomes available.',
  };
  return { status, validFrom, expiresAt, serverTime: now, message: messages[status] };
}

function bookingForClient(booking, now) {
  const { qrCode, qrToken, ...safe } = booking;
  return { ...safe, entryPass: entryPass(booking, now) };
}
module.exports = { entryPass, bookingForClient };
