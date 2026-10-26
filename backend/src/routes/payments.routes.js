const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const { initiatePayment, confirmPayment, getMyPayments, getAllPayments } = require('../controllers/payments.controller');

router.get('/return', (req, res) => res.type('text').send('Return to Smart Sports Hub and refresh your payments. Payment status is updated only after Stripe verifies the transaction.'));
router.use(authenticate);
router.post('/checkout', require('../controllers/checkout.controller').checkout);

router.post('/initiate', initiatePayment);
router.post('/confirm', requireAdmin, confirmPayment);
router.post('/:id/reconcile', requireAdmin, require('../controllers/checkout.controller').reconcile);
router.post('/refunds/:id/cash', requireAdmin, require('../controllers/payments.controller').completeCashRefund);
router.post('/refunds/retry', requireAdmin, require('../controllers/payments.controller').retryRefunds);
router.get('/my', getMyPayments);
router.get('/:id/invoice', require('../controllers/invoice.controller').invoice);
router.get('/', requireAdmin, getAllPayments);

module.exports = router;
