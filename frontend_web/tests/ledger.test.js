import test from 'node:test';
import assert from 'node:assert/strict';
import { ledgerCsv, paymentDay, paymentMethod } from '../src/utils/ledger.js';
test('ledger dates use Pakistan receipt days and fall back to creation for unpaid records', () => {
  assert.equal(paymentDay({ paidAt: '2026-10-28T20:30:00Z', createdAt: '2026-10-01T00:00:00Z' }), '2026-10-29');
  assert.equal(paymentDay({ createdAt: '2026-10-29T00:00:00Z' }), '2026-10-29');
  assert.equal(paymentDay({ createdAt: 'invalid' }), '');
});
test('payment method never labels an unrecorded pending payment as cash collected', () => {
  assert.equal(paymentMethod({ status: 'PENDING' }), 'Not yet recorded');
  assert.equal(paymentMethod({ status: 'PAID' }), 'No online reference');
  assert.equal(paymentMethod({ status: 'PENDING', stripeCheckoutSessionId: 'cs_test' }), 'Online');
  assert.notEqual(paymentMethod({ status: 'PAID', stripePaymentIntentId: 'pi_dummy_seed' }), 'Online');
});
test('ledger CSV quotes commas, escapes spreadsheet formulae and includes venue references', () => {
  const csv = ledgerCsv([{ id: 7, status: 'PAID', user: { name: '=IMPORTDATA("bad")' }, amount: 500, purpose: 'BOOKING', createdAt: '2026-10-29', booking: { slot: { venue: { name: 'Court, A' } } } }]);
  assert.ok(csv.includes('"Court, A"')); assert.ok(csv.includes("\"'=IMPORTDATA")); assert.ok(csv.includes('"500"'));
});
