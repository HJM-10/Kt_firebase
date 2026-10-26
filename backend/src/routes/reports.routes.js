const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const { getRevenueSummary, getBookingAnalytics, getUtilizationReport, getCustomerAnalytics, exportBookingsCsv } = require('../controllers/reports.controller');

router.use(authenticate, requireAdmin);

router.get('/arena-desk', require('../controllers/arena.controller').getArenaDesk);

router.get('/revenue', getRevenueSummary);
router.get('/bookings', getBookingAnalytics);
router.get('/utilization', getUtilizationReport);
router.get('/customers', getCustomerAnalytics);
router.get('/export/bookings', exportBookingsCsv);

module.exports = router;
