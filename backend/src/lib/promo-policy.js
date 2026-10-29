const { fail } = require('./arena-time');
const normalizeCode = code => typeof code === 'string' ? code.trim().toUpperCase() : '';
function assertPromo(promo, { amount, uses = 0, now = new Date() } = {}) {
  if (!promo?.isActive || (promo.expiresAt && new Date(promo.expiresAt) <= now)) throw fail('Promo code is inactive or expired', 400);
  if (promo.maxUses != null && promo.usedCount >= promo.maxUses) throw fail('Promo code usage limit reached', 400);
  if (uses >= (promo.perCustomerLimit ?? 1)) throw fail('You have reached this promo code’s per-customer limit', 400);
  if (amount != null && amount < (promo.minOrderAmount || 0)) throw fail(`Minimum booking value is PKR ${promo.minOrderAmount}`, 400);
}
async function releasePromo(tx, bookingId) {
  const usage = await tx.promoCodeUsage.findUnique({ where: { bookingId } });
  if (!usage) return;
  await tx.promoCode.update({ where: { id: usage.promoCodeId }, data: { updatedAt: new Date() } });
  const removed = await tx.promoCodeUsage.deleteMany({ where: { id: usage.id } });
  if (removed.count) await tx.promoCode.updateMany({ where: { id: usage.promoCodeId, usedCount: { gt: 0 } }, data: { usedCount: { decrement: 1 } } });
}
module.exports = { normalizeCode, assertPromo, releasePromo };
