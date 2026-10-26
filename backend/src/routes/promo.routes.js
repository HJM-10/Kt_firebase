const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validatePromo, getAllPromos, createPromo, updatePromo } = require('../controllers/promo.controller');

router.use(authenticate);

router.post('/validate', validatePromo);

router.use(requireAdmin);

router.get('/', getAllPromos);
router.post('/', createPromo);
router.patch('/:id', updatePromo);

module.exports = router;
