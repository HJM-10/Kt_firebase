const { fail, startsAt, endsAt, assertVenueAvailable } = require('./arena-time');

function standings(tournament) {
  const rows = new Map();
  const row = name => { if (!rows.has(name)) rows.set(name, { team: name, played: 0, won: 0, drawn: 0, lost: 0, points: 0, scored: 0, conceded: 0, difference: 0 }); return rows.get(name); };
  for (const reg of tournament.registrations || []) if (reg.status === 'ACTIVE' && (tournament.entryFee === 0 || reg.payment?.status === 'PAID')) row(reg.teamName);
  for (const match of tournament.matches) {
    if (match.isBye) continue;
    const a = row(match.team1), b = row(match.team2);
    if (!match.isCompleted) continue;
    a.played++; b.played++;
    const winner = winnerName(match);
    if (winner === match.team1) { a.won++; a.points += 3; b.lost++; }
    else if (winner === match.team2) { b.won++; b.points += 3; a.lost++; }
    else if (match.winner === 'draw') { a.drawn++; b.drawn++; a.points++; b.points++; }
    const s1 = Number(match.team1Score), s2 = Number(match.team2Score);
    if (match.team1Score !== null && match.team2Score !== null && Number.isFinite(s1) && Number.isFinite(s2)) { a.scored += s1; a.conceded += s2; b.scored += s2; b.conceded += s1; }
  }
  return [...rows.values()].map(r => ({ ...r, difference: r.scored - r.conceded })).sort((a, b) => b.points - a.points || b.difference - a.difference || b.scored - a.scored || a.team.localeCompare(b.team));
}
const winnerName = m => m.winner === 'team1' ? m.team1 : m.winner === 'team2' ? m.team2 : m.winner === 'draw' ? null : m.winner;

async function finalize(tx, tournamentId) {
  const t = await tx.tournament.findUnique({ where: { id: tournamentId }, include: { matches: true, registrations: { include: { payment: true } } } });
  if (!t.matches.length || t.matches.some(m => !m.isCompleted)) return;
  let champion;
  if (t.format === 'KNOCKOUT') {
    if (t.matches.some(m => !/^Round \d+$/.test(m.round || ''))) return;
    const eligibleCount = t.registrations.filter(r => r.status === 'ACTIVE' && (t.entryFee === 0 || r.payment?.status === 'PAID')).length;
    const rounds = Math.ceil(Math.log2(eligibleCount));
    if (eligibleCount < 2) return;
    for (let r = 1; r <= rounds; r++) if (t.matches.filter(m => m.round === `Round ${r}`).length !== 2 ** (rounds - r)) return;
    const lastRound = Math.max(...t.matches.map(m => Number(m.round.split(' ')[1])));
    if (lastRound !== rounds) return;
    const final = t.matches.filter(m => m.round === `Round ${lastRound}`);
    if (final.length !== 1 || final[0].isBye) return;
    champion = winnerName(final[0]);
  } else {
    const table = standings(t);
    const eligible = t.registrations.filter(r => r.status === 'ACTIVE' && (t.entryFee === 0 || r.payment?.status === 'PAID')).map(r => r.teamName);
    // A partial manual schedule cannot crown a league champion.
    for (let a = 0; a < eligible.length; a++) for (let b = a + 1; b < eligible.length; b++) if (!t.matches.some(m => !m.isBye && [m.team1, m.team2].includes(eligible[a]) && [m.team1, m.team2].includes(eligible[b]))) return;
    if (table.length) {
      const top = table[0];
      champion = table.filter(r => r.points === top.points && r.difference === top.difference && r.scored === top.scored).map(r => r.team).join(' / ');
    }
  }
  if (champion) await tx.tournament.update({ where: { id: t.id }, data: { status: 'COMPLETED', champion } });
}

async function assertSchedule(tx, data, tournament) {
  const start = new Date(data.scheduledAt), finish = new Date(start.getTime() + data.durationMinutes * 60000);
  if (start < tournament.startDate || (tournament.endDate && finish > tournament.endDate)) throw fail('Match must fit inside tournament dates', 400);
  if (!data.venue?.trim()) throw fail('Choose a registered venue', 400);
  const venue = await tx.venue.findFirst({ where: { name: data.venue.trim() } });
  if (!venue) throw fail('Choose a registered venue by name', 400);
  const locked = await tx.venue.update({ where: { id: venue.id }, data: { updatedAt: new Date() }, include: { sport: true } });
  if (venue.sportId !== tournament.sportId) throw fail('Venue must support the tournament sport', 400);
  const local = d => new Date(d.getTime() + 18000000).toISOString();
  const day = local(start).slice(0, 10);
  if (local(finish).slice(0, 10) !== day) throw fail('A match must finish on the same arena day', 400);
  await assertVenueAvailable(tx, locked, { date: new Date(day), startTime: local(start).slice(11, 16), endTime: local(finish).slice(11, 16) });
  const matches = await tx.match.findMany({ where: { isBye: false, scheduledAt: { lt: new Date(finish.getTime() + 30 * 60000) } } });
  for (const m of matches) {
    const mEnd = new Date(m.scheduledAt.getTime() + m.durationMinutes * 60000);
    if (m.venue?.trim().toLowerCase() === data.venue.trim().toLowerCase() && m.scheduledAt < finish && mEnd > start) throw fail('Venue has an overlapping match');
    if (m.tournamentId === tournament.id && [m.team1, m.team2].some(team => [data.team1, data.team2].includes(team)) && m.scheduledAt < new Date(finish.getTime() + 30 * 60000) && new Date(mEnd.getTime() + 30 * 60000) > start) throw fail('Team schedule requires at least 30 minutes rest between matches');
  }
  const slots = await tx.bookingSlot.findMany({ where: { venueId: venue.id, date: new Date(day), isBooked: true } });
  if (slots.some(s => startsAt(s) < finish && endsAt(s) > start)) throw fail('Venue has an overlapping booking');
  const events = await tx.event.findMany({ where: { venue: venue.name, status: { not: 'CANCELLED' }, startDate: { lt: finish } } });
  if (events.some(e => (e.endDate || new Date(e.startDate.getTime() + 120 * 60000)) > start)) throw fail('Venue has an overlapping event');
}
async function assertEventSchedule(tx, event, excludeId) {
  if (!event.venue) return;
  const venue = await tx.venue.findFirst({ where: { name: event.venue } });
  if (!venue) return; // Events can also name an external location.
  await tx.venue.update({ where: { id: venue.id }, data: { updatedAt: new Date() } });
  if (!venue.isActive || venue.sportId !== Number(event.sportId)) throw fail('Choose an active venue for this sport', 400);
  const start = new Date(event.startDate), end = event.endDate ? new Date(event.endDate) : new Date(start.getTime() + 7200000);
  if (end <= start) throw fail('Event end must follow its start', 400);
  if (await tx.venueClosure.findFirst({ where: { venueId: venue.id, startAt: { lt: end }, endAt: { gt: start } } })) throw fail('Event overlaps a venue closure');
  const slots = await tx.bookingSlot.findMany({ where: { venueId: venue.id, isBooked: true } });
  if (slots.some(s => startsAt(s) < end && endsAt(s) > start)) throw fail('Event overlaps a court booking');
  const matches = await tx.match.findMany({ where: { venue: venue.name, isBye: false, scheduledAt: { lt: end } } });
  if (matches.some(m => new Date(m.scheduledAt.getTime() + m.durationMinutes * 60000) > start)) throw fail('Event overlaps a tournament match');
  const other = await tx.event.findMany({ where: { venue: venue.name, status: { not: 'CANCELLED' }, ...(excludeId ? { id: { not: excludeId } } : {}), startDate: { lt: end } } });
  if (other.some(e => (e.endDate || new Date(e.startDate.getTime() + 7200000)) > start)) throw fail('Venue has an overlapping event');
}
module.exports = { standings, winnerName, finalize, assertSchedule, assertEventSchedule };
