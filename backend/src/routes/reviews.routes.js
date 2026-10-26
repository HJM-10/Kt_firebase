const express = require('express');
const router = express.Router({ mergeParams: true });
const { authenticate, requireAdmin } = require('../middleware/auth');
const { getVenueReviews, createReview, deleteReview, getAllReviews } = require('../controllers/reviews.controller');

// GET /api/reviews — admin: all reviews
router.get('/', authenticate, requireAdmin, getAllReviews);

// POST /api/reviews/:venueId — customer submits a review for a venue
router.post('/:venueId', authenticate, createReview);

// GET /api/reviews/venue/:venueId — get reviews for a specific venue (public)
router.get('/venue/:venueId', getVenueReviews);

// DELETE /api/reviews/:id — owner or admin
router.delete('/:id', authenticate, deleteReview);

module.exports = router;
