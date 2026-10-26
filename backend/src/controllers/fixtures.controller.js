const prisma = require('../lib/prisma');
const transaction = require('../lib/transaction');
const { fail } = require('../lib/arena-time');
const { assertSchedule, winnerName } = require('../lib/tournament-competition');
exports.generate = async (req, res, next) => {
  try {
    const id = Number(req.params.id), start = new Date(req.body.scheduledAt);
    const interval = Number(req.body.intervalMinutes || 150), durationMinutes = Number(req.body.durationMinutes || 120);
    if (!Number.isSafeInteger(id) || id < 1 || !Number.isFinite(start.getTime()) || start <= new Date() || !Number.isInteger(durationMinutes) || durationMinutes < 15 || !Number.isInteger(interval) || interval < durationMinutes + 30) throw fail('Choose a future time and an interval allowing match duration plus 30 minutes rest', 400);
    const matches = await transaction(async tx => {
      await tx.tournament.update({ where: { id }, data: { updatedAt: new Date() } });
      const tournament = await tx.tournament.findUnique({ where: { id }, include: { registrations: { where: { status: 'ACTIVE' }, include: { payment: true }, orderBy: { id: 'asc' } }, matches: { orderBy: { id: 'asc' } } } });
      if (tournament.status === 'COMPLETED') throw fail('Tournament is completed');
      if (tournament.registrations.some(r => r.payment?.status === 'PENDING')) throw fail('Resolve or expire pending entry fees before generating fixtures');
      let teams = tournament.registrations.filter(r => tournament.entryFee === 0 || r.payment?.status === 'PAID').map(r => r.teamName);
      let round = 1;
      if (tournament.matches.length) {
        if (tournament.format === 'LEAGUE') throw fail('League fixtures already exist');
        if (tournament.matches.some(m => !/^Round \d+$/.test(m.round || ''))) throw fail('Existing manual fixtures require manual bracket management');
        round = Math.max(...tournament.matches.map(m => Number(m.round.split(' ')[1]))) + 1;
        const previous = tournament.matches.filter(m => m.round === `Round ${round - 1}`);
        if (previous.some(m => !m.isCompleted || !m.winner || m.winner === 'draw')) throw fail('Complete the current round with a winner for every match first');
        teams = previous.map(winnerName);
      }
      if (teams.length < 2 || new Set(teams.map(t => t.trim().toLowerCase())).size !== teams.length) throw fail('At least two distinct eligible teams are required', 400);
      const pairs = [];
      if (tournament.format === 'LEAGUE') {
        for (let a = 0; a < teams.length; a++) for (let b = a + 1; b < teams.length; b++) pairs.push([teams[a], teams[b]]);
      } else {
        const bracketSize = 2 ** Math.ceil(Math.log2(teams.length));
        const byes = bracketSize - teams.length;
        for (let a = 0; a < byes; a++) pairs.push([teams[a], 'BYE']);
        for (let a = byes; a < teams.length; a += 2) pairs.push([teams[a], teams[a + 1]]);
      }
      const created = [];
      let played = 0;
      for (const pair of pairs) {
        const isBye = pair[1] === 'BYE';
        const data = { tournamentId: id, team1: pair[0], team2: pair[1], round: tournament.format === 'LEAGUE' ? 'League' : `Round ${round}`, scheduledAt: new Date(start.getTime() + played * interval * 60000), venue: req.body.venue?.trim(), durationMinutes, isBye, isCompleted: isBye, winner: isBye ? 'team1' : null, result: isBye ? 'Automatic bye' : null };
        if (!isBye) { await assertSchedule(tx, data, tournament); played++; }
        created.push(await tx.match.create({ data }));
      }
      await tx.tournament.update({ where: { id }, data: { status: 'ONGOING' } });
      return created;
    }, { timeout: 20000 });
    res.status(201).json({ success: true, data: matches });
  } catch (e) { if (e.code === 'P2025') e.status = 404; next(e); }
};
