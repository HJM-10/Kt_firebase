const router = require('express').Router();
const { getSlots, createSlot, getMyBookings, getAllBookings, createBooking, cancelBooking, getBookingQR, scanBooking, confirmBooking } = require('../controllers/bookings.controller');
const { authenticate, requireAdmin } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { bookingSchemas } = require('../validations');

router.get('/slots', getSlots);
router.post('/slots', authenticate, requireAdmin, validate(bookingSchemas.createSlot), createSlot);

router.get('/my', authenticate, getMyBookings);
router.get('/', authenticate, requireAdmin, getAllBookings);
router.post('/', authenticate, validate(bookingSchemas.createBooking), createBooking);
router.put('/:id/cancel', authenticate, cancelBooking);
router.put('/:id/reschedule', authenticate, require('../controllers/reschedule.controller').reschedule);
router.put('/:id/confirm', authenticate, requireAdmin, confirmBooking);

router.get('/:id/qr', authenticate, getBookingQR);
router.post('/scan', authenticate, requireAdmin, scanBooking);

module.exports = router;
