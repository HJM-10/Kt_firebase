const router = require('express').Router();
const { getSports, getSportById, createSport, updateSport, deleteSport } = require('../controllers/sports.controller');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.get('/', getSports);
router.get('/:id', getSportById);
router.post('/', authenticate, requireAdmin, createSport);
router.put('/:id', authenticate, requireAdmin, updateSport);
router.delete('/:id', authenticate, requireAdmin, deleteSport);

module.exports = router;
