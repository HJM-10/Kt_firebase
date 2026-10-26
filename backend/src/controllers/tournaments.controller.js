const handleError = require('../middleware/errorHandler');
const prisma = require('../lib/prisma');
const transaction = require('../lib/transaction');
const { deadline, fail } = require('../lib/arena-time');
const { expireReservations } = require('../lib/reservation-lifecycle');

const getTournaments = async (req, res) => {
  try {
    const { sportId, status } = req.query;
    const where = {};
    if (sportId) where.sportId = parseInt(sportId);
    if (status) where.status = status;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const skip = (page - 1) * limit;

    const tournaments = await prisma.tournament.findMany({
      where,
      include: {
        sport: { select: { id: true, name: true, icon: true } },
        registrations: { where: { userId: req.user.id, status: 'ACTIVE' }, select: { id: true, payment: { select: { status: true } } } },
        _count: { select: { registrations: { where: { status: 'ACTIVE' } }, matches: true } }
      },
      orderBy: { startDate: 'desc' },
      skip,
      take: limit
    });
    res.json({ success: true, data: tournaments });
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

const getTournamentById = async (req, res) => {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        sport: true,
        matches: { orderBy: { scheduledAt: 'asc' } },
        registrations: { include: { user: { select: { id: true, name: true } }, payment: { select: { status: true } } } }
      }
    });
    if (!tournament) return res.status(404).json({ success: false, message: 'Tournament not found' });
    tournament.standings = require('../lib/tournament-competition').standings(tournament);
    res.json({ success: true, data: tournament });
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

const createTournament = async (req, res) => {
  try {
    const { name, description, sportId, format, startDate, endDate, maxTeams, entryFee, imageUrl } = req.body;
    if (!name || !sportId || !startDate) {
      return res.status(400).json({ success: false, message: 'name, sportId, startDate are required' });
    }
    const tournament = await prisma.tournament.create({
      data: {
        name, description,
        sportId: parseInt(sportId),
        format: format || 'KNOCKOUT',
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        maxTeams: maxTeams ? parseInt(maxTeams) : 8,
        entryFee: entryFee ? parseFloat(entryFee) : 0,
        imageUrl
      },
      include: { sport: { select: { id: true, name: true } } }
    });
    res.status(201).json({ success: true, data: tournament });
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

const updateTournament = async (req, res) => {
  try {
    const { name, description, status, startDate, endDate, maxTeams, entryFee, imageUrl } = req.body;
    const tournament = await transaction(async tx => {
      const current = await tx.tournament.update({ where: { id: Number(req.params.id) }, data: { updatedAt: new Date() } });
      const count = await tx.teamRegistration.count({ where: { tournamentId: current.id, status: 'ACTIVE' } });
      if (maxTeams && Number(maxTeams) < count) throw fail('Capacity cannot be below the active team count');
      if (status === 'COMPLETED' && current.status !== 'COMPLETED') throw fail('Record all results to finalize the champion');
      if (current.status === 'COMPLETED' || (status === 'UPCOMING' && current.status !== 'UPCOMING')) throw fail('Started or completed tournaments cannot be reopened');
      if (new Date(endDate || current.endDate || '9999-01-01') < new Date(startDate || current.startDate)) throw fail('End date must follow start date', 400);
      return tx.tournament.update({
      where: { id: parseInt(req.params.id) },
      data: {
        name, description, status,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        maxTeams: maxTeams ? parseInt(maxTeams) : undefined,
        entryFee: entryFee !== undefined ? parseFloat(entryFee) : undefined,
        imageUrl
      },
      include: { sport: { select: { id: true, name: true } } }
    }); });
    res.json({ success: true, data: tournament });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ success: false, message: 'Tournament not found' });
    console.error(err);
    handleError(err, req, res);
  }
};

const deleteTournament = async (req, res) => {
  try {
    const tournamentId = parseInt(req.params.id);
    const registrationCount = await prisma.teamRegistration.count({ where: { tournamentId } });
    if (registrationCount > 0) return res.status(409).json({ success: false, message: 'Tournament has registrations. Retain it to preserve payment and match history.' });
    
    await transaction(async (tx) => {
      await tx.tournament.update({ where: { id: tournamentId }, data: { updatedAt: new Date() } });
      if (await tx.teamRegistration.count({ where: { tournamentId } })) throw fail('Tournament has registration history and cannot be deleted');
      // Find registrations for this tournament
      const regs = await tx.teamRegistration.findMany({
        where: { tournamentId },
        select: { id: true }
      });
      const regIds = regs.map(r => r.id);

      // Delete payments related to these registrations
      if (regIds.length > 0) {
        await tx.payment.deleteMany({
          where: { tournamentRegId: { in: regIds } }
        });
      }

      // Delete registrations
      await tx.teamRegistration.deleteMany({
        where: { tournamentId }
      });

      // Delete matches
      await tx.match.deleteMany({
        where: { tournamentId }
      });

      // Finally, delete the tournament
      await tx.tournament.delete({
        where: { id: tournamentId }
      });
    });

    res.json({ success: true, message: 'Tournament deleted successfully' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ success: false, message: 'Tournament not found' });
    console.error(err);
    handleError(err, req, res);
  }
};


async function register(req, res, manual) {
  try {
    await expireReservations();
    const tournamentId = Number(req.params.id);
    const userId = manual && req.body.userId ? Number(req.body.userId) : req.user.id;
    if (!Number.isSafeInteger(userId) || userId < 1) throw fail('Valid captain required', 400);
    const teamName = (req.body.teamName || `Team ${userId}`).trim();
    if (!teamName || teamName.length > 100 || ['bye', 'team1', 'team2', 'draw'].includes(teamName.toLowerCase())) throw fail('Choose a valid team name (BYE, team1, team2 and draw are reserved)', 400);
    const paymentStatus = manual ? (req.body.paymentStatus || 'PENDING') : 'PENDING';
    if (!['PENDING', 'PAID', 'FREE'].includes(paymentStatus)) throw fail('Invalid payment status', 400);
    if (paymentStatus === 'PAID' && req.body.receivedInPerson !== true) throw fail('Explicit confirmation of money received in person is required', 400);
    if (paymentStatus === 'FREE' && !req.body.waiverReason?.trim()) throw fail('A reason is required to waive an entry fee', 400);
    const result = await transaction(async tx => {
      const t = await tx.tournament.update({ where: { id: tournamentId }, data: { updatedAt: new Date() } });
      if (t.status !== 'UPCOMING' || t.startDate <= new Date()) throw fail('Tournament registration is closed');
      const count = await tx.teamRegistration.count({ where: { tournamentId, status: 'ACTIVE' } });
      if (count >= t.maxTeams) throw fail('Tournament has reached maximum capacity');
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user?.isActive) throw fail('Captain account is unavailable', 400);
      const registrations = await tx.teamRegistration.findMany({ where: { tournamentId, status: 'ACTIVE' } });
      if (registrations.some(r => r.teamName.trim().toLowerCase() === teamName.toLowerCase())) throw fail('Team name is already registered');
      const old = await tx.teamRegistration.findUnique({ where: { tournamentId_userId: { tournamentId, userId } }, include: { payment: true } });
      if (old?.status === 'ACTIVE') throw fail('Already registered for this tournament');
      if (old?.payment && old.payment.status !== 'FAILED') throw fail('Previous registration requires refund reconciliation');
      if (old?.payment) await tx.payment.update({ where: { id: old.payment.id }, data: { tournamentRegId: null } });
      const reg = old ? await tx.teamRegistration.update({ where: { id: old.id }, data: { status: 'ACTIVE', teamName } }) : await tx.teamRegistration.create({ data: { tournamentId, userId, teamName } });
      // A waived entry has an auditable zero-value paid record and remains eligible for fixtures.
      const amount = paymentStatus === 'FREE' ? 0 : t.entryFee;
      const paid = amount === 0 || paymentStatus === 'PAID';
      const payment = await tx.payment.create({ data: { userId, amount, purpose: 'TOURNAMENT_REGISTRATION', tournamentRegId: reg.id, status: paid ? 'PAID' : 'PENDING', expiresAt: paid ? null : deadline() } });
      if (paymentStatus === 'FREE') await tx.notification.create({ data: { userId, title: 'Tournament fee waived', body: `Entry for ${teamName}: ${req.body.waiverReason.trim()}`, type: 'TOURNAMENT' } });
      return { ...reg, paymentId: paid ? null : payment.id };
    });
    res.status(201).json({ success: true, data: result });
  } catch (e) {
    if (e.code === 'P2002') e = fail('User or team is already registered');
    if (e.code === 'P2025') e = fail('Tournament not found', 404);
    handleError(e, req, res);
  }
}
const registerForTournament = (req, res) => register(req, res, false);
const manualRegister = (req, res) => register(req, res, true);
module.exports = { getTournaments, getTournamentById, createTournament, updateTournament, deleteTournament, registerForTournament, manualRegister };
