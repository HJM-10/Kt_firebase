const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const { getMyMembership, getAllMemberships, purchaseMembership } = require('../controllers/membership.controller');

router.use(authenticate);

router.get('/my', getMyMembership);
router.post('/purchase', purchaseMembership);

router.get('/', requireAdmin, getAllMemberships);

module.exports = router;
