const prisma = require('../lib/prisma');
exports.invoice = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ success: false, message: 'Valid payment ID required' });
    const payment = await prisma.payment.findUnique({ where: { id }, include: { refunds: true, user: { select: { name: true, email: true } }, booking: { include: { slot: { include: { venue: true } } } } } });
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });
    if (payment.userId !== req.user.id && req.user.role !== 'ADMIN') return res.status(403).json({ success: false, message: 'Not authorized' });
    res.json({ success: true, data: {
      invoiceNumber: `SSH-${String(id).padStart(8, '0')}`, issuedAt: payment.createdAt, customer: payment.user,
      currency: payment.currency, amount: payment.amount, status: payment.status, purpose: payment.purpose,
      refunds: payment.refunds.map(r => ({ amount: r.amount, status: r.status, reference: r.reference })),
      venue: payment.booking?.slot?.venue?.name || null, bookingId: payment.bookingId,
      basePrice: payment.booking?.basePrice, membershipDiscount: payment.booking?.membershipDiscount,
      promoDiscount: payment.booking?.promoDiscount,
      note: payment.status === 'PAID' ? 'Payment recorded. Keep this receipt for your records.' : 'This invoice is not proof of payment. Payment has not been recorded as paid.',
    } });
  } catch (e) { next(e); }
};
