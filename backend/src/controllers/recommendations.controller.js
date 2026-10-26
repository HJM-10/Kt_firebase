const handleError = require('../middleware/errorHandler');
const prisma = require('../lib/prisma');

const getRecommendedSlots = async (req, res) => {
  try {
    // 1. Get user's booking history to understand preferences
    const userBookings = await prisma.booking.findMany({
      where: { userId: req.user.id, status: { in: ['CONFIRMED', 'SCANNED'] } },
      include: { slot: { include: { venue: true } } }
    });

    let preferredSportIds = [];
    let preferredVenueIds = [];
    
    if (userBookings.length > 0) {
      // Find most booked sports and venues
      const sportCounts = {};
      const venueCounts = {};
      
      userBookings.forEach(b => {
        const vId = b.slot.venueId;
        const sId = b.slot.venue.sportId;
        sportCounts[sId] = (sportCounts[sId] || 0) + 1;
        venueCounts[vId] = (venueCounts[vId] || 0) + 1;
      });
      
      // Sort and pick top 2 sports and top 3 venues
      preferredSportIds = Object.keys(sportCounts).sort((a,b) => sportCounts[b] - sportCounts[a]).slice(0, 2).map(Number);
      preferredVenueIds = Object.keys(venueCounts).sort((a,b) => venueCounts[b] - venueCounts[a]).slice(0, 3).map(Number);
    }

    // 2. Query available upcoming slots based on preferences
    const now = new Date();
    // Look ahead 7 days
    const nextWeek = new Date();
    nextWeek.setDate(now.getDate() + 7);

    // If no history, just get some random available slots for upcoming 7 days
    let whereClause = {
      isBooked: false,
      date: { gte: now, lte: nextWeek }
    };

    if (preferredVenueIds.length > 0) {
      // Prioritize their favorite venues, or venues of their favorite sports
      whereClause = {
        isBooked: false,
        date: { gte: now, lte: nextWeek },
        OR: [
          { venueId: { in: preferredVenueIds } },
          { venue: { sportId: { in: preferredSportIds } } }
        ]
      };
    }

    const availableSlots = await prisma.bookingSlot.findMany({
      where: whereClause,
      include: { venue: { include: { sport: { select: { name: true, icon: true } } } } },
      orderBy: { date: 'asc' },
      take: 5 // Return top 5 recommendations
    });

    res.json({ success: true, data: availableSlots });
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

module.exports = { getRecommendedSlots };

