const { day, money } = require('./equipment-policy');
const { fail } = require('./arena-time');
function reportRange(query) {
  const from = query.from ? day(query.from) : null;
  const to = query.to ? day(query.to) : null;
  if (from && to && from > to) throw fail('Report end date must follow start date', 400);
  // Date controls represent Pakistan calendar days; the upper bound is exclusive.
  return { from: from ? new Date(+from - 5 * 3600000) : null, to: to ? new Date(+to + 19 * 3600000) : null };
}
const inRange = (date, range) => date && (!range.from || new Date(date) >= range.from) && (!range.to || new Date(date) < range.to);
function ledger(payments, refunds, range) {
  let grossRevenue = 0, refundedAmount = 0, pendingRefunds = 0;
  const revenueByMonth = {};
  const add = (date, amount) => { const month = new Date(+new Date(date) + 5 * 3600000).toISOString().slice(0, 7); revenueByMonth[month] = money((revenueByMonth[month] || 0) + amount); };
  for (const p of payments) if (inRange(p.paidAt || p.createdAt, range)) { grossRevenue += p.amount; add(p.paidAt || p.createdAt, p.amount); }
  for (const r of refunds) {
    // Duplicate provider captures have their own receipt even though they share a payment.
    if (r.providerIntentId && r.payment && r.providerIntentId !== r.payment.stripePaymentIntentId && inRange(r.createdAt, range)) { grossRevenue += r.amount; add(r.createdAt, r.amount); }
    if (r.status === 'REFUNDED' && inRange(r.updatedAt, range)) { refundedAmount += r.amount; add(r.updatedAt, -r.amount); }
    else if (r.status !== 'REFUNDED' && inRange(r.createdAt, range)) pendingRefunds += r.amount;
  }
  return { grossRevenue: money(grossRevenue), refundedAmount: money(refundedAmount), pendingRefunds: money(pendingRefunds), totalRevenue: money(grossRevenue - refundedAmount), revenueByMonth };
}
module.exports = { reportRange, inRange, ledger };
