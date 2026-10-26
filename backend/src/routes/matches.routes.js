const router = require('express').Router();
const { getMatches, getMatchById, createMatch, updateMatchResult } = require('../controllers/matches.controller');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.get('/', getMatches);
router.get('/:id', getMatchById);
router.post('/', authenticate, requireAdmin, createMatch);
router.put('/:id/result', authenticate, requireAdmin, updateMatchResult);

module.exports = router;
