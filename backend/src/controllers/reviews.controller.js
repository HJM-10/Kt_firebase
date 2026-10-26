const handleError = require('../middleware/errorHandler');
const prisma = require('../lib/prisma');

const getVenueReviews = async (req, res) => {
  try {
    const venueId = req.params.id ?? req.params.venueId;
    const reviews = await prisma.review.findMany({
      where: { venueId: parseInt(venueId) },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: reviews });
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

const createReview = async (req, res) => {
  try {
    const venueId = req.params.id ?? req.params.venueId;
    const { rating, comment, bookingId } = req.body;
    if (!Number.isInteger(Number(rating)) || Number(rating) < 1 || Number(rating) > 5) return res.status(400).json({ success: false, message: 'Rating must be an integer from 1 to 5' });
    
    if (!rating || !bookingId) {
      return res.status(400).json({ success: false, message: 'Rating and bookingId are required' });
    }

    if (!Number.isSafeInteger(Number(bookingId)) || Number(bookingId) < 1 || !Number.isSafeInteger(Number(venueId)) || Number(venueId) < 1 || (comment != null && (typeof comment !== 'string' || comment.length > 500))) return res.status(400).json({ success: false, message: 'Valid booking, venue and comment up to 500 characters required' });

    // Verify booking
    const booking = await prisma.booking.findFirst({
      where: { 
        id: parseInt(bookingId), 
        userId: req.user.id, 
        slot: { venueId: parseInt(venueId) },
        status: 'SCANNED'
      }
    });

    if (!booking) {
      return res.status(403).json({ success: false, message: 'A checked-in booking at this venue is required to leave a review' });
    }

    const review = await prisma.review.upsert({
      where: { userId_venueId: { userId: req.user.id, venueId: parseInt(venueId) } },
      update: { rating: parseInt(rating), comment, bookingId: parseInt(bookingId) },
      create: {
        userId: req.user.id,
        venueId: parseInt(venueId),
        bookingId: parseInt(bookingId),
        rating: parseInt(rating),
        comment
      },
      include: { user: { select: { id: true, name: true } } }
    });

    res.status(201).json({ success: true, data: review });
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

const deleteReview = async (req, res) => {
  try {
    const reviewId = parseInt(req.params.id);
    const review = await prisma.review.findUnique({ where: { id: reviewId } });
    
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
    if (review.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await prisma.review.delete({ where: { id: reviewId } });
    res.json({ success: true, message: 'Review deleted successfully' });
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

const getAllReviews = async (req, res) => {
  try {
    const reviews = await prisma.review.findMany({
      include: { 
        user: { select: { id: true, name: true, email: true } },
        venue: { select: { id: true, name: true, sport: { select: { name: true } } } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: reviews });
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

module.exports = { getVenueReviews, createReview, deleteReview, getAllReviews };

