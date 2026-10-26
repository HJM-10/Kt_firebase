const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getRecommendedSlots } = require('../controllers/recommendations.controller');

router.use(authenticate);

router.get('/slots', getRecommendedSlots);

module.exports = router;
