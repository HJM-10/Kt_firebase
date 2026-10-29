const prisma = require('../lib/prisma');
const transaction = require('../lib/transaction');
const { getStripe } = require('../lib/stripe');
const { assertPayable, queueRefund, emitChange } = require('../lib/reservation-lifecycle');

async function settle(session) {
  if (session.payment_status !== 'paid') return;
  const id = Number(session.metadata?.paymentId);
  if (!Number.isSafeInteger(id)) throw new Error('Missing payment reference');
  const notification = await transaction(async tx => {
    await tx.payment.update({ where: { id }, data: { updatedAt: new Date() } });
    const payment = await tx.payment.findUnique({ where: { id } });
    if (!payment || session.amount_total !== Math.round(payment.amount * 100) || session.currency !== payment.currency.toLowerCase()) throw new Error('Payment amount or currency mismatch');
    if (!session.payment_intent) throw new Error('Missing provider payment intent');
    if (payment.stripePaymentIntentId === session.payment_intent) return;
    if (['PAID', 'REFUNDED'].includes(payment.status)) { await queueRefund(tx, payment, session.payment_intent); return; }
    let payable = true;
    try { await assertPayable(tx, payment); } catch (error) { if (error.status !== 409) throw error; payable = false; }
    await tx.payment.update({ where: { id }, data: { status: 'PAID', paidAt: new Date(), stripePaymentIntentId: session.payment_intent } });
    if (!payable) { await require('../lib/reservation-lifecycle').releaseReservation(tx, payment); await queueRefund(tx, payment, session.payment_intent); return; }
    if (payment.bookingId) {
      const changed = await tx.booking.updateMany({ where: { id: payment.bookingId, status: 'PENDING_PAYMENT' }, data: { status: 'CONFIRMED' } });
      if (!changed.count) throw new Error('Booking requires payment reconciliation');
    }
    if (payment.membershipId) await require('../lib/membership').activateMembership(tx, payment);
    if (payment.rentalId) await tx.equipmentRental.update({ where: { id: payment.rentalId }, data: { status: 'CONFIRMED' } });
    return tx.notification.create({ data: { userId: payment.userId, title: 'Payment received', body: `Payment #${id} of ${payment.currency} ${payment.amount} was received.`, type: 'PAYMENT' } });
  });
  if (notification) await require('../lib/notifications').deliverNotification(notification);
  emitChange();
}

async function checkout(req, res, next) {
  try {
    const id = Number(req.body.paymentId);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ success: false, message: 'Valid paymentId required' });
    const payment = await prisma.payment.findUnique({ where: { id } });
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });
    if (payment.userId !== req.user.id) return res.status(403).json({ success: false, message: 'Not authorized' });
    if (payment.status !== 'PENDING') return res.status(409).json({ success: false, message: 'Payment is not pending' });
    if (payment.amount <= 0) return res.status(400).json({ success: false, message: 'No payment is due' });
    if (!process.env.STRIPE_WEBHOOK_SECRET) return res.status(503).json({ success: false, message: 'Verified online payments are not configured. Contact arena staff to pay in person.' });
    if (payment.bookingId) {
      const booking = await prisma.booking.findUnique({ where: { id: payment.bookingId } });
      if (!booking || booking.status !== 'PENDING_PAYMENT') return res.status(409).json({ success: false, message: 'Booking no longer awaits payment' });
    }
    const origin = process.env.PUBLIC_API_URL || 'http://localhost:5000';
    const session = await transaction(async tx => {
      await tx.payment.update({ where: { id }, data: { updatedAt: new Date() } });
      const current = await tx.payment.findUnique({ where: { id } });
      await assertPayable(tx, current);
      if (current.stripeCheckoutSessionId) {
        const previous = await getStripe().checkout.sessions.retrieve(current.stripeCheckoutSessionId);
        if (previous.status !== 'open') throw Object.assign(new Error('Checkout completed or expired; refresh your payments'), { status: 409 });
        return previous;
      }
      const created = await getStripe().checkout.sessions.create({
      mode: 'payment',
      client_reference_id: String(id), metadata: { paymentId: String(id) },
      payment_intent_data: { metadata: { paymentId: String(id) } },
      line_items: [{ price_data: { currency: payment.currency.toLowerCase(), unit_amount: Math.round(payment.amount * 100), product_data: { name: `Smart Sports Hub ${payment.purpose.replaceAll('_', ' ')} #${id}` } }, quantity: 1 }],
      success_url: `${origin}/api/payments/return?status=success`,
      cancel_url: `${origin}/api/payments/return?status=cancelled`,
    }, { idempotencyKey: `checkout-${id}` });
      await tx.payment.update({ where: { id }, data: { stripeCheckoutSessionId: created.id } });
      return created;
    }, { timeout: 20000 });
    res.json({ success: true, data: { url: session.url } });
  } catch (error) { next(error); }
}

async function webhook(req, res) {
  let event;
  try {
    if (!process.env.STRIPE_WEBHOOK_SECRET) return res.sendStatus(503);
    event = getStripe().webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch { return res.status(400).json({ success: false, message: 'Invalid webhook signature' }); }
  try {
    if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) await settle(event.data.object);
    res.json({ received: true });
  } catch (error) { console.error('Stripe settlement failed:', error.message); res.sendStatus(500); }
}
async function reconcile(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ success: false, message: 'Valid payment ID required' });
    const payment = await prisma.payment.findUnique({ where: { id } });
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });
    if (!payment.stripeCheckoutSessionId) return res.status(409).json({ success: false, message: 'No online checkout exists for this payment' });
    const session = await getStripe().checkout.sessions.retrieve(payment.stripeCheckoutSessionId);
    await settle(session);
    res.json({ success: true, data: await prisma.payment.findUnique({ where: { id }, include: { refunds: true } }) });
  } catch (e) { next(e); }
}
module.exports = { checkout, webhook, settle, reconcile };

