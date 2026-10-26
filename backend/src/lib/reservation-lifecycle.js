const prisma = require('./prisma');
const transaction = require('./transaction');
const { getStripe } = require('./stripe');
const { fail } = require('./arena-time');

async function queueRefund(tx, payment, intent = payment.stripePaymentIntentId) {
  if (payment.amount <= 0) return;
  if (intent?.startsWith('pi_dummy_')) intent = null;
  return tx.refund.upsert({ where: { sourceKey: intent ? `stripe-${intent}` : `cash-${payment.id}` }, update: {}, create: { paymentId: payment.id, sourceKey: intent ? `stripe-${intent}` : `cash-${payment.id}`, providerIntentId: intent || null, amount: payment.amount } });
}

async function cancelPayment(tx, payment) {
  if (!payment) return;
  // All lifecycle operations lock payment first, then its reservation.
  await tx.payment.update({ where: { id: payment.id }, data: { updatedAt: new Date() } });
  const current = await tx.payment.findUnique({ where: { id: payment.id } });
  if (current.status === 'PAID') await queueRefund(tx, current);
  if (current.status === 'PENDING') await tx.payment.update({ where: { id: current.id }, data: { status: 'FAILED' } });
}

async function releaseReservation(tx, payment) {
  if (payment.membershipId) await tx.membershipChange.updateMany({ where: { paymentId: payment.id, status: 'PENDING' }, data: { status: 'EXPIRED' } });
  if (payment.bookingId) {
    const booking = await tx.booking.findUnique({ where: { id: payment.bookingId } });
    const changed = await tx.booking.updateMany({ where: { id: payment.bookingId, status: 'PENDING_PAYMENT' }, data: { status: 'CANCELLED' } });
    if (changed.count) await tx.bookingSlot.update({ where: { id: booking.slotId }, data: { isBooked: false } });
  }
  if (payment.eventRegId) await tx.eventRegistration.updateMany({ where: { id: payment.eventRegId, status: 'ACTIVE', attendedAt: null }, data: { status: 'EXPIRED' } });
  if (payment.tournamentRegId) await tx.teamRegistration.updateMany({ where: { id: payment.tournamentRegId, status: 'ACTIVE' }, data: { status: 'EXPIRED' } });
}

async function expireReservations(now = new Date()) {
  const due = await prisma.payment.findMany({ where: { status: 'PENDING', expiresAt: { lte: now } }, take: 200, orderBy: { id: 'asc' } });
  for (const payment of due) await transaction(async tx => {
    const claimed = await tx.payment.updateMany({ where: { id: payment.id, status: 'PENDING', expiresAt: { lte: now } }, data: { status: 'FAILED' } });
    if (!claimed.count) return;
    if (payment.membershipId) await tx.membershipChange.updateMany({ where: { paymentId: payment.id, status: 'PENDING' }, data: { status: 'EXPIRED' } });
    if (payment.bookingId) {
      const booking = await tx.booking.findUnique({ where: { id: payment.bookingId } });
      const changed = await tx.booking.updateMany({ where: { id: payment.bookingId, status: 'PENDING_PAYMENT' }, data: { status: 'CANCELLED' } });
      if (changed.count) await tx.bookingSlot.update({ where: { id: booking.slotId }, data: { isBooked: false } });
    }
    if (payment.eventRegId) await tx.eventRegistration.updateMany({ where: { id: payment.eventRegId, status: 'ACTIVE' }, data: { status: 'EXPIRED' } });
    if (payment.tournamentRegId) await tx.teamRegistration.updateMany({ where: { id: payment.tournamentRegId, status: 'ACTIVE' }, data: { status: 'EXPIRED' } });
  });
  if (due.length) emitChange();
}

async function assertPayable(tx, payment) {
  if (payment.membershipId) {
    const change = await tx.membershipChange.findUnique({ where: { paymentId: payment.id } });
    if (change?.status !== 'PENDING') throw fail('Membership request is no longer pending');
  }
  if (payment.status !== 'PENDING' || (payment.expiresAt && payment.expiresAt <= new Date())) throw fail('Payment reservation has expired or changed');
  if (payment.bookingId) {
    const b = await tx.booking.findUnique({ where: { id: payment.bookingId } });
    if (b?.status !== 'PENDING_PAYMENT') throw fail('Booking is no longer awaiting payment');
  }
  if (payment.eventRegId) {
    const r = await tx.eventRegistration.findUnique({ where: { id: payment.eventRegId }, include: { event: true } });
    if (r?.status !== 'ACTIVE' || r.event.status === 'CANCELLED') throw fail('Event registration is no longer active');
  }
  if (payment.tournamentRegId) {
    const r = await tx.teamRegistration.findUnique({ where: { id: payment.tournamentRegId } });
    if (r?.status !== 'ACTIVE') throw fail('Tournament registration is no longer active');
  }
}

async function finishRefund(refund, reference) {
  const notification = await transaction(async tx => {
    const changed = await tx.refund.updateMany({ where: { id: refund.id, status: { not: 'REFUNDED' } }, data: { status: 'REFUNDED', reference, error: null } });
    if (!changed.count) return;
    const payment = await tx.payment.findUnique({ where: { id: refund.paymentId } });
    // Refunding a duplicate provider charge must not reverse the original valid payment.
    if (!refund.providerIntentId || payment.stripePaymentIntentId === refund.providerIntentId) await tx.payment.update({ where: { id: payment.id }, data: { status: 'REFUNDED' } });
    return tx.notification.create({ data: { userId: payment.userId, title: 'Refund completed', body: `Refund of ${payment.currency} ${refund.amount} for payment #${payment.id} completed. Reference: ${reference}`, type: 'PAYMENT' } });
  });
  if (notification) await require('./notifications').deliverNotification(notification);
  emitChange();
}

async function processRefunds() {
  const refunds = await prisma.refund.findMany({ where: { status: { in: ['PENDING', 'FAILED'] }, providerIntentId: { not: null } }, take: 50 });
  for (const refund of refunds) {
    try {
      const result = refund.reference ? await getStripe().refunds.retrieve(refund.reference) : await getStripe().refunds.create({ payment_intent: refund.providerIntentId, amount: Math.round(refund.amount * 100) }, { idempotencyKey: `refund-${refund.id}` });
      if (result.status === 'succeeded') await finishRefund(refund, result.id);
      else await prisma.refund.update({ where: { id: refund.id }, data: { status: result.status === 'failed' || result.status === 'canceled' ? 'FAILED' : 'PENDING', reference: result.id, error: result.failure_reason || null } });
    } catch (error) { await prisma.refund.update({ where: { id: refund.id }, data: { status: 'FAILED', error: error.message } }); }
  }
}
function emitChange() { try { require('./socket').getIO().emit('booking_updated', {}); require('./socket').getIO().emit('resource_changed', { resource: 'bookings' }); require('./socket').getIO().emit('resource_changed', { resource: 'events' }); require('./socket').getIO().emit('resource_changed', { resource: 'payments' }); require('./socket').getIO().emit('resource_changed', { resource: 'tournaments' }); } catch {} }
function startLifecycleWorker() {
  let busy = false;
  const tick = async () => { if (busy) return; busy = true; try { await expireReservations(); await processRefunds(); } catch (e) { console.error('Reservation lifecycle:', e.message); } finally { busy = false; } };
  void tick();
  const timer = setInterval(tick, 15000); timer.unref();
  return () => clearInterval(timer);
}
module.exports = { queueRefund, cancelPayment, expireReservations, assertPayable, finishRefund, processRefunds, startLifecycleWorker, emitChange, releaseReservation };
