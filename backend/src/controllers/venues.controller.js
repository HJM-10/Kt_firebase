const handleError = require('../middleware/errorHandler');
const prisma = require('../lib/prisma');
const transaction = require('../lib/transaction');
const { venueLocation } = require('../lib/venue-location');

const getVenues = async (req, res) => {
  try {
    const { sportId } = req.query;
    const where = req.user.role === 'ADMIN' ? {} : { isActive: true, sport: { isActive: true } };
    if (sportId) where.sportId = parseInt(sportId);

    const venues = await prisma.venue.findMany({
      where,
      include: { sport: { select: { id: true, name: true, icon: true } }, closures: true },
      orderBy: { name: 'asc' }
    });
    res.json({ success: true, data: venues });
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

const getVenueById = async (req, res) => {
  try {
    const venue = await prisma.venue.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { sport: true, closures: true, equipment: { include: { sport: true } } }
    });
    if (!venue) return res.status(404).json({ success: false, message: 'Venue not found' });
    res.json({ success: true, data: venue });
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

const createVenue = async (req, res) => {
  try {
    const location = venueLocation(req.body);
    const { name, description, sportId, capacity, pricePerSlot, imageUrl, openingTime, closingTime, closedWeekdays, isActive } = req.body;
    if (!name || !sportId) {
      return res.status(400).json({ success: false, message: 'Name and sportId are required' });
    }
    const venue = await prisma.venue.create({
      data: { ...location, name, description, sportId: parseInt(sportId), capacity, pricePerSlot, imageUrl, openingTime, closingTime, closedWeekdays, isActive, closures: { create: (req.body.closures || []).map(({ startAt, endAt, reason }) => ({ startAt: new Date(startAt), endAt: new Date(endAt), reason })) } },
      include: { sport: { select: { id: true, name: true } } }
    });
    res.status(201).json({ success: true, data: venue });
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

const updateVenue = async (req, res) => {
  try {
    const location = venueLocation(req.body);
    const { name, description, sportId, capacity, pricePerSlot, imageUrl, isActive, openingTime, closingTime, closedWeekdays, closures } = req.body;
    const venue = await transaction(async tx => {
      const current = await tx.venue.update({ where: { id: Number(req.params.id) }, data: { updatedAt: new Date() } });
      const proposed = { ...current, openingTime: openingTime ?? current.openingTime, closingTime: closingTime ?? current.closingTime, closedWeekdays: closedWeekdays ?? current.closedWeekdays };
      if (proposed.openingTime >= proposed.closingTime) throw Object.assign(new Error('Closing time must follow opening time'), { status: 400 });
      const slots = await tx.bookingSlot.findMany({ where: { venueId: current.id, isBooked: true, date: { gte: new Date(new Date().toISOString().slice(0, 10)) } } });
      const { startsAt, endsAt } = require('../lib/arena-time');
      for (const slot of slots) {
        if (slot.startTime < proposed.openingTime || slot.endTime > proposed.closingTime || (proposed.closedWeekdays || []).includes(slot.date.getUTCDay()) || (closures || []).some(c => new Date(c.startAt) < endsAt(slot) && new Date(c.endAt) > startsAt(slot))) throw Object.assign(new Error('Hours or closures conflict with an existing reservation. Cancel or reschedule that reservation first.'), { status: 409 });
      }
      if (closures) await tx.venueClosure.deleteMany({ where: { venueId: current.id } });
      return tx.venue.update({
      where: { id: parseInt(req.params.id) },
      data: { ...location, name, description, sportId: sportId ? parseInt(sportId) : undefined, capacity, pricePerSlot, imageUrl, isActive, openingTime, closingTime, closedWeekdays, ...(closures ? { closures: { create: closures.map(({ startAt, endAt, reason }) => ({ startAt: new Date(startAt), endAt: new Date(endAt), reason })) } } : {}) },
      include: { sport: { select: { id: true, name: true } }, closures: true }
    }); });
    res.json({ success: true, data: venue });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ success: false, message: 'Venue not found' });
    console.error(err);
    handleError(err, req, res);
  }
};

const deleteVenue = async (req, res) => {
  try {
    await prisma.venue.update({ where: { id: parseInt(req.params.id) }, data: { isActive: false } });
    res.json({ success: true, message: 'Venue deactivated' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ success: false, message: 'Venue not found' });
    console.error(err);
    handleError(err, req, res);
  }
};

module.exports = { getVenues, getVenueById, createVenue, updateVenue, deleteVenue };

