const handleError = require('../middleware/errorHandler');
const prisma = require('../lib/prisma');
const transaction = require('../lib/transaction');
const socket = require('../lib/socket');
const { fail, deadline, hasNotice } = require('../lib/arena-time');
const { cancelPayment, expireReservations } = require('../lib/reservation-lifecycle');

const getAllEvents = async (req, res) => {
  try {
    const events = await prisma.event.findMany({
      include: {
        sport: { select: { name: true, icon: true } },
        registrations: { where: { userId: req.user.id, status: 'ACTIVE' }, select: { id: true, payment: { select: { status: true } } } },
        _count: { select: { registrations: { where: { status: 'ACTIVE' } } } }
      },
      orderBy: { startDate: 'asc' }
    });
    res.json({ success: true, data: events });
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

const getEventById = async (req, res) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        sport: { select: { name: true, icon: true } },
        registrations: { include: { user: { select: { id: true, name: true } }, payment: { select: { status: true } } } }
      }
    });
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    res.json({ success: true, data: event });
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

const createEvent = async (req, res) => {
  try {
    const { name, description, sportId, type, startDate, endDate, venue, maxParticipants, fee, imageUrl } = req.body;
    
    if (!name || !sportId || !startDate) {
      return res.status(400).json({ success: false, message: 'Name, sportId, and startDate are required' });
    }

    const event = await transaction(async tx => {
      await require('../lib/tournament-competition').assertEventSchedule(tx, req.body);
      return tx.event.create({
      data: {
        name, description, 
        sportId: parseInt(sportId), 
        type: type || 'TRAINING',
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        venue, 
        maxParticipants: maxParticipants ? parseInt(maxParticipants) : null,
        fee: fee ? parseFloat(fee) : 0,
        imageUrl,
        status: 'UPCOMING'
      }
    }); });

    res.status(201).json({ success: true, data: event });
    try { socket.getIO().emit('event_updated', event); } catch (e) {}
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};

const updateEvent = async (req, res) => {
  try {
    const { name, description, sportId, type, startDate, endDate, venue, maxParticipants, fee, imageUrl, status } = req.body;
    const eventId = parseInt(req.params.id);

    const event = await transaction(async tx => {
      const current = await tx.event.update({ where: { id: eventId }, data: { updatedAt: new Date() } });
      if (current.status === 'CANCELLED') throw fail('Cancelled events are retained for history and cannot be reopened');
      const count = await tx.eventRegistration.count({ where: { eventId, status: 'ACTIVE' } });
      if (maxParticipants && Number(maxParticipants) < count) throw fail('Capacity cannot be below current active registrations');
      if (status !== 'CANCELLED' && (startDate || endDate || venue || sportId)) await require('../lib/tournament-competition').assertEventSchedule(tx, { ...current, ...req.body, startDate: startDate || current.startDate, endDate: endDate || current.endDate }, current.id);
      if (status === 'CANCELLED') {
        const regs = await tx.eventRegistration.findMany({ where: { eventId, status: 'ACTIVE' }, include: { payment: true } });
        for (const reg of regs) {
          await cancelPayment(tx, reg.payment);
          await tx.eventRegistration.update({ where: { id: reg.id }, data: { status: 'CANCELLED' } });
        }
      }
      const event = await tx.event.update({
      where: { id: eventId },
      data: {
        name, description, 
        sportId: sportId ? parseInt(sportId) : undefined, 
        type, 
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        venue, 
        maxParticipants: maxParticipants ? parseInt(maxParticipants) : undefined,
        fee: fee !== undefined ? parseFloat(fee) : undefined,
        imageUrl,
        status
      }
    });

      return event;
    });
    res.json({ success: true, data: event });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ success: false, message: 'Event not found' });
    console.error(err);
    handleError(err, req, res);
  }
};

const deleteEvent = async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);
    const registrationsCount = await prisma.eventRegistration.count({ where: { eventId } });
    if (registrationsCount > 0) return res.status(409).json({ success: false, message: 'This event has registrations. Cancel it instead to retain payment history.' });
    
    // Find all registrations for this event to delete their payments
    const registrations = await prisma.eventRegistration.findMany({ 
      where: { eventId }, 
      select: { id: true } 
    });
    const regIds = registrations.map(r => r.id);

    await transaction([
      // 1. Delete payments tied to these registrations
      prisma.payment.deleteMany({ where: { eventRegId: { in: regIds } } }),
      // 2. Delete the registrations themselves
      prisma.eventRegistration.deleteMany({ where: { eventId } }),
      // 3. Finally, delete the event
      prisma.event.delete({ where: { id: eventId } })
    ]);

    res.json({ success: true, message: 'Event deleted successfully' });
  } catch (err) {
    console.error(err);
    handleError(err, req, res);
  }
};


const registerForEvent = async (req, res) => {
  try {
    await expireReservations();
    const eventId = Number(req.params.id), userId = req.user.id;
    const result = await transaction(async tx => {
      const event = await tx.event.update({ where: { id: eventId }, data: { updatedAt: new Date() } });
      if (event.status !== 'UPCOMING' || event.startDate <= new Date()) throw fail('Event registration is closed');
      const count = await tx.eventRegistration.count({ where: { eventId, status: 'ACTIVE' } });
      if (event.maxParticipants && count >= event.maxParticipants) throw fail('Event has reached maximum capacity');
      const old = await tx.eventRegistration.findUnique({ where: { eventId_userId: { eventId, userId } }, include: { payment: true } });
      if (old?.status === 'ACTIVE') throw fail('Already registered for this event');
      if (old?.payment && old.payment.status !== 'FAILED' && old.payment.status !== 'REFUNDED') throw fail('Previous registration requires refund reconciliation');
      if (old?.payment) await tx.payment.update({ where: { id: old.payment.id }, data: { eventRegId: null } });
      const registration = old ? await tx.eventRegistration.update({ where: { id: old.id }, data: { status: 'ACTIVE', attendedAt: null, createdAt: new Date() } }) : await tx.eventRegistration.create({ data: { eventId, userId } });
      if (event.fee > 0) {
        const payment = await tx.payment.create({ data: { userId, amount: event.fee, purpose: 'EVENT_REGISTRATION', eventRegId: registration.id, status: 'PENDING', expiresAt: deadline() } });
        registration.paymentId = payment.id;
      }
      return registration;
    });
    res.status(201).json({ success: true, data: result });
  } catch (e) { if (e.code === 'P2002') e = fail('Already registered for this event'); if (e.code === 'P2025') e.status = 404; handleError(e, req, res); }
};

const cancelRegistration = async (req, res, next) => {
  try {
    const eventId = Number(req.params.id), registrationId = Number(req.params.registrationId);
    await transaction(async tx => {
      const event = await tx.event.update({ where: { id: eventId }, data: { updatedAt: new Date() } });
      const reg = await tx.eventRegistration.findUnique({ where: { id: registrationId }, include: { payment: true } });
      if (!reg || reg.eventId !== eventId) throw fail('Registration not found', 404);
      if (reg.userId !== req.user.id && req.user.role !== 'ADMIN') throw fail('Not authorized', 403);
      if (reg.status !== 'ACTIVE' || reg.attendedAt) throw fail('Registration cannot be cancelled');
      if (!hasNotice(event.startDate, req.user.role)) throw fail('Cancel at least 2 hours before the event', 400);
      await cancelPayment(tx, reg.payment);
      await tx.eventRegistration.update({ where: { id: reg.id }, data: { status: 'CANCELLED' } });
    });
    res.json({ success: true, message: 'Registration cancelled. Paid fees are queued for a full refund.' });
  } catch (e) { next(e); }
};

const attend = async (req, res, next) => {
  try {
    const eventId = Number(req.params.id), registrationId = Number(req.params.registrationId);
    const data = await transaction(async tx => {
      const event = await tx.event.update({ where: { id: eventId }, data: { updatedAt: new Date() } });
      const reg = await tx.eventRegistration.findUnique({ where: { id: registrationId }, include: { payment: true } });
      if (!reg || reg.eventId !== eventId) throw fail('Registration not found', 404);
      if (event.status === 'CANCELLED' || event.status === 'COMPLETED' || Date.now() < event.startDate.getTime() - 1800000 || Date.now() >= (event.endDate?.getTime() || event.startDate.getTime() + 7200000)) throw fail('Attendance opens 30 minutes before the event and closes at its end');
      if (reg.status !== 'ACTIVE' || reg.attendedAt || (reg.payment && reg.payment.status !== 'PAID')) throw fail('Attendance requires an active paid entry that has not checked in');
      return tx.eventRegistration.update({ where: { id: reg.id }, data: { attendedAt: new Date() } });
    });
    res.json({ success: true, data });
  } catch (e) { next(e); }
};
module.exports = { getAllEvents, getEventById, createEvent, updateEvent, deleteEvent, registerForEvent, cancelRegistration, attend };
