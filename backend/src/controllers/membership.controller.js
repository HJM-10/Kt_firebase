const prisma = require('../lib/prisma');
const transaction = require('../lib/transaction');
const { randomUUID } = require('node:crypto');
const { prices, active } = require('../lib/membership');
const { createNotification } = require('../lib/notifications');
const include = { history: { orderBy: { createdAt: 'desc' }, include: { payment: { select: { id: true, amount: true, status: true } } } } };
const present = card => card && { ...card, isActive: active(card), status: active(card) ? 'ACTIVE' : card.endDate && card.endDate <= new Date() ? 'EXPIRED' : 'INACTIVE' };
exports.getMyMembership = async (req, res, next) => {
  try { res.json({ success: true, data: present(await prisma.membership.findUnique({ where: { userId: req.user.id }, include })) }); } catch (e) { next(e); }
};
exports.getAllMemberships = async (req, res, next) => {
  try { res.json({ success: true, data: (await prisma.membership.findMany({ include: { ...include, user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: 'desc' } })).map(present) }); } catch (e) { next(e); }
};
exports.purchaseMembership = async (req, res, next) => {
  try {
    const { tier } = req.body;
    if (!Object.hasOwn(prices, tier)) return res.status(400).json({ success: false, message: 'Invalid membership tier' });
    const result = await transaction(async tx => {
      // Lock a stable parent even for a first purchase, serializing concurrent requests.
      await tx.user.update({ where: { id: req.user.id }, data: { updatedAt: new Date() } });
      let card = await tx.membership.findUnique({ where: { userId: req.user.id } });
      if (card) {
        const pending = await tx.membershipChange.findFirst({ where: { membershipId: card.id, status: 'PENDING' }, include: { payment: true } });
        if (pending) {
          if (pending.tier === tier && pending.payment?.status === 'PENDING' && (!pending.payment.expiresAt || pending.payment.expiresAt > new Date())) return { ...present(card), paymentId: pending.paymentId, amount: pending.payment.amount };
          if (pending.payment?.status === 'PENDING' && pending.payment.expiresAt <= new Date()) {
            await tx.payment.update({ where: { id: pending.paymentId }, data: { status: 'FAILED' } });
            await tx.membershipChange.update({ where: { id: pending.id }, data: { status: 'EXPIRED' } });
          } else throw Object.assign(new Error('Complete the pending membership payment before choosing another plan'), { status: 409 });
        }
        if (active(card) && (prices[tier] < prices[card.tier] || tier === 'BASIC')) throw Object.assign(new Error('Choose the current paid tier to renew, or a higher tier to upgrade. Downgrades are available after expiry.'), { status: 409 });
      }
      const kind = !card || !active(card) ? 'PURCHASE' : card.tier === tier ? 'RENEWAL' : 'UPGRADE';
      if (!card) card = await tx.membership.create({ data: { userId: req.user.id, cardNumber: `SSH-${randomUUID()}`, tier: 'BASIC', isActive: false } });
      const amount = prices[tier];
      const payment = amount ? await tx.payment.create({ data: { userId: req.user.id, membershipId: card.id, amount, purpose: 'MEMBERSHIP', expiresAt: new Date(Date.now() + 30 * 60000) } }) : null;
      const now = new Date();
      await tx.membershipChange.create({ data: { membershipId: card.id, paymentId: payment?.id, tier, kind, status: amount ? 'PENDING' : 'ACTIVE', ...(!amount ? { startDate: now, activatedAt: now } : {}) } });
      if (!amount) card = await tx.membership.update({ where: { id: card.id }, data: { tier, isActive: true, startDate: now, endDate: null } });
      return { ...present(card), paymentId: payment?.id, amount };
    });
    if (!result.amount) await createNotification(req.user.id, 'Membership activated', 'Your Basic membership card is active.', 'MEMBERSHIP');
    res.status(201).json({ success: true, data: result });
  } catch (e) { next(e); }
};
