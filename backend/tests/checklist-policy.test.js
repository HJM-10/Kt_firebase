const { hasNotice, startsAt, endsAt } = require('../src/lib/arena-time');
const { standings } = require('../src/lib/tournament-competition');
test('cancellation and rescheduling accept exactly two hours notice and reject one millisecond less', () => {
  const now = Date.parse('2026-11-01T05:00:00Z');
  expect(hasNotice(now + 7200000, 'CUSTOMER', now)).toBe(true);
  expect(hasNotice(now + 7199999, 'CUSTOMER', now)).toBe(false);
  expect(hasNotice(now - 1000, 'ADMIN', now)).toBe(true);
});
test('session boundaries use Pakistan time independently of server timezone', () => {
  const slot = { date: new Date('2026-11-01'), startTime: '10:00', endTime: '11:00' };
  expect(startsAt(slot).toISOString()).toBe('2026-11-01T05:00:00.000Z');
  expect(endsAt(slot).toISOString()).toBe('2026-11-01T06:00:00.000Z');
});
test('league points, draws and score difference exclude byes', () => {
  const table = standings({ entryFee: 0, registrations: [], matches: [
    { team1: 'A', team2: 'B', isCompleted: true, winner: 'draw', team1Score: '1', team2Score: '1' },
    { team1: 'A', team2: 'C', isCompleted: true, winner: 'team1', team1Score: '3', team2Score: '0' },
    { team1: 'B', team2: 'BYE', isCompleted: true, winner: 'team1', isBye: true },
  ] });
  expect(table.map(r => [r.team, r.points, r.played, r.difference])).toEqual([['A', 4, 2, 3], ['B', 1, 1, 0], ['C', 0, 1, -3]]);
});
