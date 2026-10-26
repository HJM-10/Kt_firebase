const router = require('express').Router();
const { getVenues, getVenueById, createVenue, updateVenue, deleteVenue } = require('../controllers/venues.controller');
const { getVenueReviews, createReview } = require('../controllers/reviews.controller');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.get('/', getVenues);
router.get('/:id', getVenueById);
router.get('/:id/reviews', getVenueReviews);
router.post('/:id/reviews', authenticate, createReview);
router.post('/', authenticate, requireAdmin, createVenue);
router.put('/:id', authenticate, requireAdmin, updateVenue);
router.delete('/:id', authenticate, requireAdmin, deleteVenue);

module.exports = router;
