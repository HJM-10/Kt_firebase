export function paymentDay(payment) {
  const value = new Date(payment.paidAt || payment.createdAt);
  return Number.isFinite(+value) ? new Date(+value + 5 * 3600000).toISOString().slice(0, 10) : '';
}
export function paymentMethod(payment) {
  if (payment.stripeCheckoutSessionId || payment.stripePaymentIntentId && !payment.stripePaymentIntentId.startsWith('pi_dummy_')) return 'Online';
  return ['PAID', 'REFUNDED'].includes(payment.status) ? 'No online reference' : 'Not yet recorded';
}
export function ledgerCsv(payments) {
  const cell = value => `"${String(value ?? '').replace(/^[\s]*[=+@-]/, "'$&").replaceAll('"', '""')}"`;
  return 'Payment,Customer,Venue,Purpose,Date,Method,Amount PKR,Status\n' + payments.map(p => [p.id, p.user?.name, p.booking?.slot?.venue?.name || p.rental?.equipment?.venue?.name, p.purpose, paymentDay(p), paymentMethod(p), p.amount, p.status].map(cell).join(',')).join('\n');
}
