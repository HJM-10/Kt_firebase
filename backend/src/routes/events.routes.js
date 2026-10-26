const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const { getAllEvents, getEventById, createEvent, updateEvent, deleteEvent, registerForEvent } = require('../controllers/events.controller');

router.get('/', getAllEvents);
router.get('/:id', getEventById);

router.use(authenticate);

router.post('/:id/register', registerForEvent);
router.post('/:id/registrations/:registrationId/cancel', require('../controllers/events.controller').cancelRegistration);

router.use(requireAdmin);
router.post('/:id/registrations/:registrationId/attend', require('../controllers/events.controller').attend);

router.post('/', createEvent);
router.put('/:id', updateEvent);
router.delete('/:id', deleteEvent);

module.exports = router;
