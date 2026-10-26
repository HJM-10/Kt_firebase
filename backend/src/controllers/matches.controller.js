const handleError = require('../middleware/errorHandler');
const prisma = require('../lib/prisma');
const transaction = require('../lib/transaction');
const { fail } = require('../lib/arena-time');
const { assertSchedule, finalize } = require('../lib/tournament-competition');

const getMatches = async (req, res) => {
  try {
    const { tournamentId, isCompleted } = req.query;
    const where = {};
    if (tournamentId) where.tournamentId = parseInt(tournamentId);
    if (isCompleted !== undefined) where.isCompleted = isCompleted === 'true';

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const skip = (page - 1) * limit;

    const matches = await prisma.match.findMany({
      where,
      include: { tournament: { select: { id: true, name: true, sport: { select: { name: true } } } } },
      orderBy: { scheduledAt: 'asc' },
      skip,
      take: limit
    });
    res.json({ success: true, data: matches });
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

const getMatchById = async (req, res) => {
  try {
    const match = await prisma.match.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { tournament: { include: { sport: true } } }
    });
    if (!match) return res.status(404).json({ success: false, message: 'Match not found' });
    res.json({ success: true, data: match });
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

const createMatch = async (req, res) => {
  try {
    const { tournamentId, team1, team2, scheduledAt, venue, round } = req.body;
    if (!tournamentId || !team1 || !team2 || !scheduledAt) {
      return res.status(400).json({ success: false, message: 'tournamentId, team1, team2, scheduledAt are required' });
    }
    const durationMinutes = Number(req.body.durationMinutes || 120);
    if (!Number.isInteger(durationMinutes) || durationMinutes < 15 || new Date(scheduledAt) <= new Date()) throw fail('Choose a future time and duration of at least 15 minutes', 400);
    const match = await transaction(async tx => {
      const tournament = await tx.tournament.update({ where: { id: Number(tournamentId) }, data: { updatedAt: new Date() } });
      if (tournament.status === 'COMPLETED') throw fail('Tournament is completed');
      if (team1.trim().toLowerCase() === team2.trim().toLowerCase()) throw fail('A team cannot play against itself', 400);
      const teams = await tx.teamRegistration.findMany({ where: { tournamentId: tournament.id, status: 'ACTIVE' }, include: { payment: true } });
      if (![team1, team2].every(t => teams.some(r => r.teamName === t && (tournament.entryFee === 0 || r.payment?.status === 'PAID')))) throw fail('Both teams must have eligible registrations', 400);
      if (tournament.format === 'KNOCKOUT' && !/^Round \d+$/.test(round || '')) throw fail('Use Round 1, Round 2, etc. for knockout matches', 400);
      const existing = await tx.match.findMany({ where: { tournamentId: tournament.id } });
      if (existing.some(m => [m.team1, m.team2].includes(team1) && [m.team1, m.team2].includes(team2))) throw fail('This pairing already exists');
      if (tournament.format === 'KNOCKOUT') {
        const roundNumber = Number(round.split(' ')[1]);
        const roundMatches = existing.filter(m => m.round === round);
        const maxRound = Math.ceil(Math.log2(teams.length));
        if (roundNumber < 1 || roundNumber > maxRound || roundMatches.some(m => [m.team1, m.team2].some(t => [team1, team2].includes(t)))) throw fail('Teams can play only once per round');
        if (roundNumber > 1) {
          const previous = existing.filter(m => m.round === `Round ${roundNumber - 1}`);
          const { winnerName } = require('../lib/tournament-competition');
          if (previous.length !== 2 ** (maxRound - roundNumber + 1) || previous.some(m => !m.isCompleted) || ![team1, team2].every(t => previous.some(m => winnerName(m) === t))) throw fail('Use completed previous-round winners');
        }
      }
      const data = { tournamentId: tournament.id, team1, team2, scheduledAt: new Date(scheduledAt), venue: venue?.trim(), round, durationMinutes };
      await assertSchedule(tx, data, tournament);
      const match = await tx.match.create({ data, include: { tournament: { select: { id: true, name: true } } } });
      await tx.tournament.update({ where: { id: tournament.id }, data: { status: 'ONGOING' } });
      return match;
    });
    res.status(201).json({ success: true, data: match });
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

const updateMatchResult = async (req, res) => {
  try {
    const { result, team1Score, team2Score, winner, isCompleted } = req.body;
    const initial = await prisma.match.findUnique({ where: { id: Number(req.params.id) } });
    if (!initial) throw fail('Match not found', 404);
    const match = await transaction(async tx => {
      const tournament = await tx.tournament.update({ where: { id: initial.tournamentId }, data: { updatedAt: new Date() } });
      const current = await tx.match.findUnique({ where: { id: initial.id } });
      if (current.isBye || current.isCompleted || tournament.status === 'COMPLETED') throw fail('Completed results are locked to preserve bracket and standings');
      const complete = isCompleted ?? true;
      if (winner && !['team1', 'team2', 'draw', current.team1, current.team2].includes(winner)) throw fail('Winner must be a competing team or draw', 400);
      if (complete && (!winner || (tournament.format === 'KNOCKOUT' && winner === 'draw'))) throw fail('A completed knockout needs a winner; a league result needs a winner or draw', 400);
      const saved = await tx.match.update({ where: { id: current.id }, data: { result, team1Score: team1Score == null ? undefined : String(team1Score), team2Score: team2Score == null ? undefined : String(team2Score), winner, isCompleted: complete }, include: { tournament: { select: { id: true, name: true } } } });
      await finalize(tx, tournament.id);
      return saved;
    });
    res.json({ success: true, data: match });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ success: false, message: 'Match not found' });
    console.error(err);
    handleError(err, req, res);
  }
};

module.exports = { getMatches, getMatchById, createMatch, updateMatchResult };

