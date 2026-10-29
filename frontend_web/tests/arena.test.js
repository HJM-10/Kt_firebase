import test from 'node:test';
import assert from 'node:assert/strict';
import { arenaDay, validDay, money, sessionStart, slotState, timelineBounds, filterBookings, filterRentals, rentalDays } from '../src/utils/arena.js';
test('arena date and session boundaries use Pakistan time regardless of the browser timezone', () => {
  assert.equal(arenaDay(new Date('2026-10-29T18:59:59Z')), '2026-10-29');
  assert.equal(arenaDay(new Date('2026-10-29T19:00:00Z')), '2026-10-30');
  assert.equal(sessionStart({ date: '2026-10-30T00:00:00Z', startTime: '06:30' }).toISOString(), '2026-10-30T01:30:00.000Z');
  assert.equal(validDay('2026-02-30'), false);
  assert.equal(validDay('2028-02-29'), true);
  assert.equal(validDay('2026-1-01'), false);
});
test('schedule state retains the active booking, but cancelled history does not occupy an open session', () => {
  const cancelled = { id: 1, status: 'CANCELLED', user: { name: 'Previous customer' } };
  const confirmed = { id: 2, status: 'CONFIRMED', user: { name: 'Current customer' } };
  assert.deepEqual(slotState({ isBooked: false, bookings: [cancelled] }), { status: 'OPEN', label: 'Open session' });
  assert.equal(slotState({ isBooked: true, bookings: [cancelled, confirmed] }).booking.id, 2);
  assert.deepEqual(slotState({ isBooked: true, unavailableReason: 'Tournament match', bookings: [cancelled] }), { status: 'UNAVAILABLE', label: 'Tournament match' });
  assert.equal(slotState({ bookings: [{ id: 4, status: 'PENDING_PAYMENT' }] }).status, 'PENDING_PAYMENT');
});
test('schedule range covers the whole published duration, including half-hour boundaries', () => {
  assert.deepEqual(timelineBounds([{ slots: [{ startTime: '08:30', endTime: '10:00' }] }, { slots: [{ startTime: '17:00', endTime: '22:30' }] }]), { start: 480, end: 1380 });
  assert.deepEqual(timelineBounds([]), { start: 480, end: 1320 });
});
test('booking search combines explicit states with customer, venue and ID matches', () => {
  const rows = [
    { id: 21, status: 'CONFIRMED', user: { name: 'Ali Khan' }, slot: { venue: { name: 'Padel Court 01' } } },
    { id: 22, status: 'PENDING_PAYMENT', user: { name: 'Sara Ali' }, slot: { venue: { name: 'Cricket Nets' } } },
  ];
  assert.deepEqual(filterBookings(rows, { query: ' ali ', status: 'CONFIRMED' }).map(b => b.id), [21]);
  assert.deepEqual(filterBookings(rows, { query: 'Cricket' }).map(b => b.id), [22]);
  assert.deepEqual(filterBookings(rows, { query: '22' }).map(b => b.id), [22]);
  assert.deepEqual(filterBookings(rows, { query: 'missing' }), []);
  assert.equal(filterBookings([{ id: 1, status: 'CANCELLED' }], { query: '1' }).length, 1);
});
test('currency is consistently labelled PKR and never renders missing values as NaN', () => {
  assert.equal(money(48000), 'PKR 48,000');
  assert.equal(money(33.339), 'PKR 33.34');
  assert.equal(money(undefined), 'PKR 0');
  assert.equal(money(Infinity), 'PKR 0');
});
test('rental quotes include both dates and reject cleared, impossible or backwards dates', () => {
  assert.equal(rentalDays('2026-10-29', '2026-10-29'), 1);
  assert.equal(rentalDays('2026-10-29', '2026-10-31'), 3);
  assert.equal(rentalDays('2026-10-29', ''), null);
  assert.equal(rentalDays('2026-02-30', '2026-03-01'), null);
  assert.equal(rentalDays('2026-10-31', '2026-10-29'), null);
});
test('rental desk scopes venue stock separately from shared stock and combines status and customer search', () => {
  const rentals = [
    { id: 1, equipment: { name: 'Racket', venueId: 7 }, status: 'CONFIRMED', user: { name: 'Ali' } },
    { id: 2, equipment: { name: 'Racket', venueId: 8 }, status: 'RETURNED', user: { name: 'Sara' } },
    { id: 3, equipment: { name: 'Shared ball', venueId: null }, status: 'PENDING_PAYMENT' },
  ];
  assert.deepEqual(filterRentals(rentals, { venueId: '7', status: 'CONFIRMED', query: 'ali' }).map(r => r.id), [1]);
  assert.deepEqual(filterRentals(rentals, { venueId: '7', query: 'Sara' }), []);
  assert.equal(filterRentals(rentals).length, 3);
  assert.deepEqual(filterRentals(rentals, { status: 'PENDING_PAYMENT' }).map(r => r.id), [3]);
});
