const prisma = require('../lib/prisma');
const { randomUUID } = require('node:crypto');
const { bookingForClient } = require('../lib/entry-pass');
const transaction = require('../lib/transaction');
const socket = require('../lib/socket');
const { createNotification } = require('../lib/notifications');
const startsAt = slot => new Date(`${slot.date.toISOString().slice(0, 10)}T${slot.startTime}:00+05:00`);
const { assertVenueAvailable, hasNotice } = require('../lib/arena-time');
exports.reschedule = async (req, res, next) => {
  try {
    const id = Number(req.params.id), slotId = Number(req.body.slotId);
    if (![id, slotId].every(n => Number.isSafeInteger(n) && n > 0)) return res.status(400).json({ success: false, message: 'Valid booking and slot IDs required' });
    const updated = await transaction(async tx => {
      const payment = await tx.payment.findUnique({ where: { bookingId: id } });
      if (payment) {
        await tx.payment.update({ where: { id: payment.id }, data: { updatedAt: new Date() } });
        if (payment.status === 'PENDING' && payment.expiresAt && payment.expiresAt <= new Date()) throw Object.assign(new Error('Unpaid reservation has expired'), { status: 409 });
      }
      const booking = await tx.booking.findUnique({ where: { id }, include: { slot: true } });
      if (!booking) throw Object.assign(new Error('Booking not found'), { status: 404 });
      if (booking.userId !== req.user.id && req.user.role !== 'ADMIN') throw Object.assign(new Error('Not authorized'), { status: 403 });
      if (!['CONFIRMED', 'PENDING_PAYMENT'].includes(booking.status)) throw Object.assign(new Error('Booking cannot be rescheduled'), { status: 409 });
      if (!hasNotice(startsAt(booking.slot), req.user.role)) throw Object.assign(new Error('Reschedule at least 2 hours before the booking'), { status: 400 });
      const slot = await tx.bookingSlot.findUnique({ where: { id: slotId }, include: { venue: true } });
      if (!slot || !slot.venue.isActive || slot.isBooked || startsAt(slot) <= new Date()) throw Object.assign(new Error('Target slot is unavailable'), { status: 409 });
      const venue = await tx.venue.update({ where: { id: slot.venueId }, data: { updatedAt: new Date() }, include: { sport: true } });
      await assertVenueAvailable(tx, venue, slot);
      if (slot.venueId !== booking.slot.venueId || slot.endTime.split(':').map(Number).reduce((h, m) => h * 60 + m) - slot.startTime.split(':').map(Number).reduce((h, m) => h * 60 + m) !== booking.slot.endTime.split(':').map(Number).reduce((h, m) => h * 60 + m) - booking.slot.startTime.split(':').map(Number).reduce((h, m) => h * 60 + m)) throw Object.assign(new Error('Choose the same venue and slot duration; the original price is retained'), { status: 400 });
      const claim = await tx.bookingSlot.updateMany({ where: { id: slotId, isBooked: false }, data: { isBooked: true } });
      if (!claim.count) throw Object.assign(new Error('Target slot was just reserved'), { status: 409 });
      const changed = await tx.booking.updateMany({ where: { id, slotId: booking.slotId, status: booking.status }, data: { slotId, qrToken: randomUUID(), qrCode: null } });
      if (!changed.count) throw Object.assign(new Error('Booking changed; refresh and retry'), { status: 409 });
      await tx.bookingSlot.update({ where: { id: booking.slotId }, data: { isBooked: false } });
      return tx.booking.findUnique({ where: { id }, include: { slot: true } });
    });
    try { socket.getIO().emit('booking_updated', { slotId }); } catch {}
    await createNotification(updated.userId, 'Booking rescheduled', `Booking #${id} has moved to ${updated.slot.date.toISOString().slice(0, 10)} at ${updated.slot.startTime}.`, 'BOOKING');
    res.json({ success: true, data: bookingForClient(updated) });
  } catch (e) { next(e); }
};
