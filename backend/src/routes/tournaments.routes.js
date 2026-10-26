const router = require('express').Router();
const { getTournaments, getTournamentById, createTournament, updateTournament, deleteTournament, registerForTournament, manualRegister } = require('../controllers/tournaments.controller');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.get('/', getTournaments);
router.get('/:id', getTournamentById);
router.post('/', authenticate, requireAdmin, createTournament);
router.put('/:id', authenticate, requireAdmin, updateTournament);
router.delete('/:id', authenticate, requireAdmin, deleteTournament);
router.post('/:id/register', authenticate, registerForTournament);
router.post('/:id/manual-register', authenticate, requireAdmin, manualRegister);
router.post('/:id/fixtures', authenticate, requireAdmin, require('../controllers/fixtures.controller').generate);

module.exports = router;
