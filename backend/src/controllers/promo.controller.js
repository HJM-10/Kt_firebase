const prisma = require('../lib/prisma');
const transaction = require('../lib/transaction');
const { fail } = require('../lib/arena-time');
const { normalizeCode, assertPromo } = require('../lib/promo-policy');
const { emitChange } = require('../lib/reservation-lifecycle');
const wrap = fn => async (req, res, next) => { try { await fn(req, res); } catch (e) { if (e.code === 'P2002') e = fail('Promo code already exists', 409); next(e); } };
function terms(body, partial = false) {
  const data = {};
  if (!partial || body.code !== undefined) {
    data.code = normalizeCode(body.code);
    if (!/^[A-Z0-9_-]{2,40}$/.test(data.code)) throw fail('Use 2–40 letters, numbers, hyphens or underscores for the code', 400);
  }
  for (const key of ['discountValue', 'maxUses', 'perCustomerLimit', 'minOrderAmount']) {
    if (body[key] === undefined) continue;
    if (body[key] === null && ['maxUses', 'minOrderAmount'].includes(key)) { data[key] = null; continue; }
    const value = Number(body[key]);
    if (!Number.isFinite(value) || value < (key === 'minOrderAmount' ? 0 : 1) || (['maxUses', 'perCustomerLimit'].includes(key) && !Number.isSafeInteger(value))) throw fail(`Invalid ${key}`, 400);
    data[key] = value;
  }
  if (body.discountType !== undefined) {
    if (!['FIXED', 'PERCENTAGE'].includes(body.discountType)) throw fail('Invalid discount type', 400);
    data.discountType = body.discountType;
  }
  if (!partial && data.discountValue === undefined) throw fail('Discount value is required', 400);
  if (body.expiresAt !== undefined) {
    data.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    if (data.expiresAt && !Number.isFinite(+data.expiresAt)) throw fail('Invalid expiry', 400);
  }
  if (body.isActive !== undefined) { if (typeof body.isActive !== 'boolean') throw fail('Invalid active status', 400); data.isActive = body.isActive; }
  return data;
}
function checkTerms(data) {
  if ((data.discountType || 'PERCENTAGE') === 'PERCENTAGE' && data.discountValue > 100) throw fail('Percentage discount cannot exceed 100', 400);
}
exports.validatePromo = wrap(async (req, res) => {
  const promo = await prisma.promoCode.findUnique({ where: { code: normalizeCode(req.body.code) } });
  const uses = promo ? await prisma.promoCodeUsage.count({ where: { promoCodeId: promo.id, userId: req.user.id } }) : 0;
  assertPromo(promo, { uses });
  res.json({ success: true, data: promo });
});
exports.getAllPromos = wrap(async (req, res) => {
  const admin = req.user.role === 'ADMIN';
  const rows = await prisma.promoCode.findMany({ where: admin ? {} : { isActive: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, orderBy: { createdAt: 'desc' } });
  const data = admin ? rows : await Promise.all(rows.map(async promo => {
    const uses = await prisma.promoCodeUsage.count({ where: { promoCodeId: promo.id, userId: req.user.id } });
    return { ...promo, remainingUses: Math.max(0, promo.perCustomerLimit - uses), available: (promo.maxUses == null || promo.usedCount < promo.maxUses) && uses < promo.perCustomerLimit };
  }));
  res.json({ success: true, data });
});
exports.createPromo = wrap(async (req, res) => {
  const data = terms(req.body); checkTerms(data);
  const promo = await prisma.promoCode.create({ data }); emitChange(); res.status(201).json({ success: true, data: promo });
});
exports.updatePromo = wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) throw fail('Invalid promo ID', 400);
  const data = terms(req.body, true);
  const promo = await transaction(async tx => {
    const current = await tx.promoCode.update({ where: { id }, data: { updatedAt: new Date() } });
    checkTerms({ ...current, ...data });
    return tx.promoCode.update({ where: { id }, data });
  }); emitChange(); res.json({ success: true, data: promo });
});
