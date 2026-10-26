const handleError = require('../middleware/errorHandler');
const prisma = require('../lib/prisma');
const transaction = require('../lib/transaction');
const QRCode = require('qrcode');
const { randomUUID: uuidv4 } = require('node:crypto');
const socket = require('../lib/socket');
const { entryPass, bookingForClient } = require('../lib/entry-pass');
const { startsAt, endsAt, deadline, assertVenueAvailable, fail, hasNotice } = require('../lib/arena-time');
const { expireReservations, cancelPayment } = require('../lib/reservation-lifecycle');

const getSlots = async (req, res) => {
  try {
    const { venueId, date } = req.query;
    if (!venueId || !date) {
      return res.status(400).json({ success: false, message: 'venueId and date are required' });
    }
    const targetDate = new Date(date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(targetDate.getTime()) || targetDate.toISOString().slice(0, 10) !== date || !Number.isSafeInteger(Number(venueId)) || Number(venueId) < 1) return res.status(400).json({ success: false, message: 'Valid venueId and YYYY-MM-DD date are required' });
    await expireReservations();
    let slots = await prisma.bookingSlot.findMany({
      where: {
        venueId: parseInt(venueId),
        date: targetDate
      },
      orderBy: { startTime: 'asc' }
    });
    const venue = await prisma.venue.findUnique({ where: { id: Number(venueId) }, include: { sport: true } });
    slots = await Promise.all(slots.map(async slot => {
      try { await assertVenueAvailable(prisma, venue, slot); return { ...slot, isAvailable: !slot.isBooked && startsAt(slot) > new Date() }; }
      catch (e) { return { ...slot, isBooked: true, isAvailable: false, unavailableReason: e.message }; }
    }));
    res.json({ success: true, data: slots });
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

const createSlot = async (req, res) => {
  try {
    const { venueId, date, startTime, endTime } = req.body;
    if (!venueId || !date || !startTime || !endTime) {
      return res.status(400).json({ success: false, message: 'venueId, date, startTime, endTime are required' });
    }
    
    const slot = await transaction(async tx => {
      const venue = await tx.venue.update({ where: { id: parseInt(venueId) }, data: { updatedAt: new Date() }, include: { sport: true } });
      await assertVenueAvailable(tx, venue, { date: new Date(date), startTime, endTime });
      const existingSlots = await tx.bookingSlot.findMany({ where: { venueId: parseInt(venueId), date: new Date(date) } });
      if (existingSlots.some(slot => startTime < slot.endTime && endTime > slot.startTime)) throw Object.assign(new Error('Time slot overlaps with an existing slot'), { status: 409 });
      return tx.bookingSlot.create({ data: { venueId: parseInt(venueId), date: new Date(date), startTime, endTime } });
    });
    res.status(201).json({ success: true, data: slot });
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

const getMyBookings = async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { userId: req.user.id },
      include: {
        slot: {
          include: {
            venue: { include: { sport: { select: { id: true, name: true, icon: true } } } }
          }
        },
        payment: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: bookings.map(b => bookingForClient(b)) });
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

const getAllBookings = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const skip = (page - 1) * limit;

    const bookings = await prisma.booking.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        slot: {
          include: { venue: { include: { sport: { select: { id: true, name: true } } } } }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    });
    res.json({ success: true, data: bookings.map(b => bookingForClient(b)) });
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

const bcrypt = require('bcryptjs');

const createBooking = async (req, res) => {
  try {
    const { slotId, notes, promoCode, walkInName, walkInPhone } = req.body;
    if (!slotId) return res.status(400).json({ success: false, message: 'slotId is required' });

    await expireReservations();
    // Check slot availability
    const slot = await prisma.bookingSlot.findUnique({ where: { id: parseInt(slotId) }, include: { venue: { include: { sport: true } } } });
    if (!slot) return res.status(404).json({ success: false, message: 'Slot not found' });
    if (!slot.venue.isActive) return res.status(409).json({ success: false, message: 'Venue is unavailable' });
    if (slot.isBooked) return res.status(409).json({ success: false, message: 'Slot already booked' });

    // Check if slot is in the past
    const slotDateTime = new Date(`${slot.date.toISOString().split('T')[0]}T${slot.startTime}:00+05:00`);
    if (slotDateTime < new Date()) {
      return res.status(400).json({ success: false, message: 'Cannot book a slot in the past' });
    }

    const basePrice = slot.venue.pricePerSlot;
    let membershipDiscount = 0;
    let promoDiscount = 0;
    let finalPrice = basePrice;
    let promoCodeId = null;

    // Membership logic
    const membership = walkInName ? null : await prisma.membership.findUnique({ where: { userId: req.user.id } });
    if (membership && membership.isActive && (!membership.endDate || membership.endDate > new Date())) {
      if (membership.tier === 'SILVER') membershipDiscount = basePrice * 0.10;
      if (membership.tier === 'GOLD') membershipDiscount = basePrice * 0.20;
    }
    
    finalPrice -= membershipDiscount;

    // Promo code logic
    if (promoCode) {
      const promo = await prisma.promoCode.findUnique({ where: { code: promoCode } });
      if (promo && promo.isActive && (!promo.expiresAt || new Date() <= promo.expiresAt) && (!promo.maxUses || promo.usedCount < promo.maxUses)) {
        if (!promo.minOrderAmount || basePrice >= promo.minOrderAmount) {
          if (promo.discountType === 'PERCENTAGE') {
            promoDiscount = finalPrice * (promo.discountValue / 100);
          } else {
            promoDiscount = promo.discountValue;
          }
          promoCodeId = promo.id;
        }
      }
      if (!promoCodeId) return res.status(400).json({ success: false, message: 'Promo code is invalid, expired, exhausted or below its minimum order value' });
    }
    
    finalPrice -= promoDiscount;
    if (finalPrice < 0) finalPrice = 0;
    finalPrice = Number(finalPrice.toFixed(2));

    let targetUserId = req.user.id;
    let targetBookingStatus = 'PENDING_PAYMENT';

    // Handle Walk-in Users (Admin Only)
    if (req.user.role === 'ADMIN' && walkInName && walkInPhone) {
      const email = `guest_${walkInPhone}@smartsportshub.com`;
      const guestPass = await bcrypt.hash(uuidv4(), 10);
      
      const guestUser = await prisma.user.upsert({
        where: { email },
        update: { name: walkInName },
        create: {
          name: walkInName,
          email,
          phone: walkInPhone,
          password: guestPass,
          role: 'CUSTOMER'
        }
      });
      targetUserId = guestUser.id;
      // Cash payments for walk-ins can be considered CONFIRMED immediately if the admin specifies, 
      // but let's keep it PENDING_PAYMENT and the admin can click "Confirm Payment" in the dashboard.
    }

    const qrToken = uuidv4();

    let booking = await transaction(async (tx) => {
      const currentVenue = await tx.venue.update({ where: { id: slot.venueId }, data: { updatedAt: new Date() }, include: { sport: true } });
      await assertVenueAvailable(tx, currentVenue, slot);
      if (currentVenue.pricePerSlot !== basePrice) throw fail('Venue price changed; refresh availability and retry');
      const claimed = await tx.bookingSlot.updateMany({ where: { id: parseInt(slotId), isBooked: false }, data: { isBooked: true } });
      if (!claimed.count) throw Object.assign(new Error('Slot already booked'), { status: 409 });
      
      const b = await tx.booking.create({
        data: {
          userId: targetUserId,
          slotId: parseInt(slotId),
          qrToken,
          basePrice,
          membershipDiscount,
          promoDiscount,
          finalPrice,
          promoCodeId,
          notes,
          status: finalPrice === 0 ? 'CONFIRMED' : 'PENDING_PAYMENT'
        },
        include: {
          slot: { include: { venue: { include: { sport: { select: { name: true } } } } } }
        }
      });
      await tx.bookingSlot.update({ where: { id: parseInt(slotId) }, data: { isBooked: true } });
      
      if (promoCodeId) {
         await tx.promoCode.update({ where: { id: promoCodeId }, data: { updatedAt: new Date() } });
         const currentPromo = await tx.promoCode.findUnique({ where: { id: promoCodeId } });
         if (!currentPromo.isActive || (currentPromo.expiresAt && currentPromo.expiresAt <= new Date()) || (currentPromo.maxUses && currentPromo.usedCount >= currentPromo.maxUses)) throw Object.assign(new Error('Promo code is no longer available'), { status: 409 });
         await tx.promoCode.update({ where: { id: promoCodeId }, data: { usedCount: { increment: 1 } } });
         await tx.promoCodeUsage.create({ data: { promoCodeId, userId: targetUserId, bookingId: b.id } });
      }
      // Provider references are written only after a verified provider transaction.
      
      const payment = await tx.payment.create({
        data: {
          userId: targetUserId,
          amount: finalPrice,
          purpose: 'BOOKING',
          bookingId: b.id,
          status: finalPrice === 0 ? 'PAID' : 'PENDING'
          ,expiresAt: finalPrice === 0 ? null : deadline()
        }
      });
      b.paymentId = payment.id;

      return b;
    });

    await require('../lib/notifications').createNotification(booking.userId, 'Booking created', `Booking #${booking.id} is ${booking.status === 'CONFIRMED' ? 'confirmed' : 'reserved pending payment'}.`, 'BOOKING');
    res.status(201).json({ success: true, data: bookingForClient(booking) });
    try { socket.getIO().emit('booking_updated', { slotId: booking.slotId }); } catch (e) {}
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

const cancelBooking = async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({ 
      where: { id: parseInt(req.params.id) },
      include: { slot: true } 
    });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    if (!['CONFIRMED', 'PENDING_PAYMENT'].includes(booking.status)) {
      return res.status(400).json({ success: false, message: 'Booking cannot be cancelled' });
    }

    const slotDateStr = booking.slot.date.toISOString().split('T')[0];
    const slotDateTime = new Date(`${slotDateStr}T${booking.slot.startTime}:00+05:00`);

    if (!hasNotice(slotDateTime, req.user.role)) {
      return res.status(400).json({ success: false, message: 'Bookings can only be cancelled at least 2 hours in advance.' });
    }

    await transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { bookingId: booking.id } });
      await cancelPayment(tx, payment);
      const changed = await tx.booking.updateMany({ where: { id: booking.id, slotId: booking.slotId, status: { in: ['CONFIRMED', 'PENDING_PAYMENT'] } }, data: { status: 'CANCELLED' } });
      if (!changed.count) throw Object.assign(new Error('Booking changed; refresh and retry'), { status: 409 });
      await tx.payment.updateMany({ where: { bookingId: booking.id, status: 'PENDING' }, data: { status: 'FAILED' } });
      await tx.bookingSlot.update({ where: { id: booking.slotId }, data: { isBooked: false } });
    });

    await require('../lib/notifications').createNotification(booking.userId, 'Booking cancelled', `Booking #${booking.id} was cancelled. Any paid amount is queued for a full refund.`, 'BOOKING');
    res.json({ success: true, message: 'Booking cancelled. Any paid amount is queued for a full refund; cash refunds are completed by staff.' });
    try { socket.getIO().emit('booking_updated', { slotId: booking.slotId }); } catch (e) {}
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

const getBookingQR = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) throw fail('A valid booking ID is required', 400);
    const include = { user: { select: { name: true } }, slot: { include: { venue: { include: { sport: true } } } } };
    let booking = await prisma.booking.findUnique({ where: { id }, include });
    if (!booking) throw fail('Booking not found', 404);
    if (booking.userId !== req.user.id && req.user.role !== 'ADMIN') throw fail('Not authorized', 403);
    let pass = entryPass(booking);
    if (['VALID', 'UPCOMING'].includes(pass.status) && !booking.qrToken) {
      await prisma.booking.updateMany({ where: { id, status: 'CONFIRMED', qrToken: null }, data: { qrToken: uuidv4(), qrCode: null } });
      booking = await prisma.booking.findUnique({ where: { id }, include });
      pass = entryPass(booking);
    }
    const available = ['VALID', 'UPCOMING'].includes(pass.status);
    const token = available ? booking.qrToken : null;
    // Only the opaque token is encoded: no customer or payment details.
    const qrCode = token ? await QRCode.toDataURL(token, { errorCorrectionLevel: 'M', margin: 4 }) : null;
    res.json({ success: true, data: { qrCode, qrToken: token, entryPass: pass, booking: bookingForClient(booking) } });
  } catch (err) { handleError(err, req, res); }
};

const scanBooking = async (req, res) => {
  try {
    let value = req.body.qrToken;
    if (typeof value !== 'string' || !value.trim() || value.length > 2000) throw fail('A valid entry pass code is required', 400);
    try { const decoded = JSON.parse(value); if (typeof decoded?.token === 'string') value = decoded.token; } catch {}
    const qrToken = value.trim();
    const include = { user: { select: { id: true, name: true } }, slot: { include: { venue: { include: { sport: { select: { name: true } } } } } } };
    const updated = await transaction(async tx => {
      // Lock first, then check the clock and current booking. No stale token can
      // race a reschedule or remain valid after the end of the booked session.
      const locked = await tx.booking.updateMany({ where: { qrToken }, data: { updatedAt: new Date() } });
      if (!locked.count) throw fail('Invalid entry pass', 404);
      const booking = await tx.booking.findUnique({ where: { qrToken }, include });
      const pass = entryPass(booking);
      if (pass.status !== 'VALID') throw fail(pass.message, 400);
      const changed = await tx.booking.updateMany({ where: { id: booking.id, qrToken, slotId: booking.slotId, status: 'CONFIRMED' }, data: { status: 'SCANNED' } });
      if (!changed.count) throw fail('Booking already checked in or changed');
      return tx.booking.findUnique({ where: { id: booking.id }, include });
    });
    res.json({ success: true, message: 'Player checked in', data: bookingForClient(updated) });
    try { socket.getIO().emit('booking_updated', { slotId: updated.slotId }); } catch {}
  } catch (err) { handleError(err, req, res); }
};

const confirmBooking = async (req, res) => {
  try {
    const payment = await prisma.payment.findUnique({ where: { bookingId: parseInt(req.params.id) } });
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });
    req.body.paymentId = payment.id;
    return require('./payments.controller').confirmPayment(req, res);
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

module.exports = { getSlots, createSlot, getMyBookings, getAllBookings, createBooking, cancelBooking, getBookingQR, scanBooking, confirmBooking };


