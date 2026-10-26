const prices = { BASIC: 0, SILVER: 1000, GOLD: 2500 };
const active = (card, now = new Date()) => !!(card?.isActive && (!card.endDate || card.endDate > now));
function annualEnd(start) {
  const end = new Date(start);
  end.setUTCFullYear(end.getUTCFullYear() + 1);
  if (end.getUTCMonth() !== start.getUTCMonth()) end.setUTCDate(0);
  return end;
}
async function activateMembership(tx, payment, now = new Date()) {
  const change = await tx.membershipChange.findUnique({ where: { paymentId: payment.id } });
  if (!change || change.status !== 'PENDING') throw Object.assign(new Error('Membership request is no longer pending'), { status: 409 });
  await tx.membership.update({ where: { id: payment.membershipId }, data: { updatedAt: now } });
  const card = await tx.membership.findUnique({ where: { id: payment.membershipId } });
  const startDate = change.kind === 'RENEWAL' && active(card, now) && card.endDate > now ? card.endDate : now;
  const endDate = change.tier === 'BASIC' ? null : annualEnd(startDate);
  await tx.membershipChange.update({ where: { id: change.id }, data: { status: 'ACTIVE', startDate, endDate, activatedAt: now } });
  await tx.membership.update({ where: { id: card.id }, data: { tier: change.tier, isActive: true, startDate: change.kind === 'RENEWAL' && active(card, now) ? card.startDate : now, endDate } });
}
module.exports = { prices, active, annualEnd, activateMembership };
