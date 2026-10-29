const { period, peakReserved, today, day, money } = require('../src/lib/equipment-policy');
const { assertPromo, normalizeCode } = require('../src/lib/promo-policy');
const { reportRange, ledger } = require('../src/lib/report-policy');
test('rental duration includes both dates and respects Pakistan midnight', () => {
  const now = new Date('2026-10-29T19:01:00Z');
  expect(today(now)).toBe('2026-10-30');
  expect(() => period({ rentalDate: '2026-10-29' }, now)).toThrow(/today/);
  expect(period({ rentalDate: '2026-10-30', returnDate: '2026-11-01' }, now).days).toBe(3);
  expect(money(33.33 * 3 * 2)).toBe(199.98);
});
test.each(['2026-02-30', 'invalid', '2026-10-29T10:00:00Z', '2026-1-01'])('rejects invalid rental date %s', value => expect(() => day(value)).toThrow());
test('rejects backwards and excessively long rental periods', () => {
  const now = new Date('2026-10-01');
  expect(() => period({ rentalDate: '2026-10-30', returnDate: '2026-10-29' }, now)).toThrow();
  expect(() => period({ rentalDate: '2026-10-30', returnDate: '2027-10-30' }, now)).toThrow(/90/);
});
test('capacity uses peak overlap, allowing disjoint reservations to share stock', () => {
  const rentals = [{ rentalDate: '2026-11-01', returnDate: '2026-11-02', quantity: 2 }, { rentalDate: '2026-11-03', returnDate: '2026-11-04', quantity: 3 }];
  expect(peakReserved(rentals, day('2026-11-01'), day('2026-11-04'))).toBe(3);
  rentals.push({ rentalDate: '2026-11-02', returnDate: '2026-11-03', quantity: 1 });
  expect(peakReserved(rentals, day('2026-11-01'), day('2026-11-04'))).toBe(4);
});
test('promo limits reject exhausted allowances and exact expiry', () => {
  const p = { isActive: true, usedCount: 1, maxUses: 3, perCustomerLimit: 2, minOrderAmount: 100, expiresAt: new Date('2026-11-01') };
  const now = new Date('2026-10-31');
  expect(normalizeCode(' save20 ')).toBe('SAVE20');
  expect(() => assertPromo(p, { now, uses: 1, amount: 100 })).not.toThrow();
  expect(() => assertPromo(p, { now, uses: 2 })).toThrow(/per-customer/);
  expect(() => assertPromo(p, { now: p.expiresAt })).toThrow(/expired/);
  expect(() => assertPromo(p, { now, amount: 99 })).toThrow(/Minimum/);
  expect(() => assertPromo({ ...p, usedCount: 3 }, { now })).toThrow(/usage limit/);
});
test('overdue confirmed equipment remains reserved until staff records its return', () => {
  const yesterday = new Date(Date.now() - 86400000 * 2);
  const start = new Date(), end = new Date(Date.now() + 86400000);
  expect(peakReserved([{ rentalDate: yesterday, returnDate: yesterday, status: 'CONFIRMED', quantity: 2 }], start, end)).toBe(2);
});
test('a refunded duplicate provider capture does not reduce net income twice', () => {
  const at = new Date('2026-11-01');
  const data = ledger([{ amount: 100, paidAt: at }], [{ amount: 100, status: 'REFUNDED', createdAt: at, updatedAt: at, providerIntentId: 'duplicate', payment: { stripePaymentIntentId: 'original' } }], {});
  expect(data.grossRevenue).toBe(200); expect(data.refundedAmount).toBe(100); expect(data.totalRevenue).toBe(100);
});
test('ledger separates gross, completed and pending refunds with Pakistan date boundaries', () => {
  const range = reportRange({ from: '2026-11-01', to: '2026-11-01' });
  const data = ledger([
    { amount: 100, paidAt: new Date('2026-10-31T19:00:00Z') },
    { amount: 200, paidAt: new Date('2026-11-01T19:00:00Z') },
  ], [
    { amount: 30, status: 'REFUNDED', updatedAt: new Date('2026-11-01T10:00:00Z') },
    { amount: 10, status: 'PENDING', createdAt: new Date('2026-11-01T10:00:00Z') },
    { amount: 5, status: 'FAILED', createdAt: new Date('2026-11-01T10:00:00Z') },
  ], range);
  expect(data).toEqual({ grossRevenue: 100, refundedAmount: 30, pendingRefunds: 15, totalRevenue: 70, revenueByMonth: { '2026-11': 70 } });
  expect(() => reportRange({ from: '2026-11-02', to: '2026-11-01' })).toThrow();
});
