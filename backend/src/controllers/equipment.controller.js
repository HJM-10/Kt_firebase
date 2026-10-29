const prisma = require('../lib/prisma');
const transaction = require('../lib/transaction');
const { fail, deadline } = require('../lib/arena-time');
const { expireReservations, cancelPayment, emitChange } = require('../lib/reservation-lifecycle');
const { period, money, overlap, peakReserved, today } = require('../lib/equipment-policy');
const wrap = fn => async (req, res, next) => { try { await fn(req, res); } catch (e) { if (e.code === 'P2025') e = fail('Equipment or rental not found', 404); if (e.code === 'P2003') e = fail('Choose an existing sport and venue', 400); next(e); } };
const id = value => { const n = Number(value); if (!Number.isSafeInteger(n) || n < 1) throw fail('A valid ID is required', 400); return n; };
const include = { sport: true, venue: { select: { id: true, name: true } } };
const rentalInclude = { equipment: { include }, payment: { include: { refunds: true } } };
function equipmentData(body, partial = false) {
  const data = {};
  for (const key of ['name', 'description', 'brand', 'model', 'material', 'ballType', 'condition', 'imageUrl']) {
    if (body[key] !== undefined) { if (typeof body[key] !== 'string' || body[key].length > 191) throw fail(`Invalid ${key}`, 400); data[key] = body[key].trim(); }
  }
  if ((!partial && !data.name) || data.name === '') throw fail('Equipment name is required', 400);
  if (body.sportId !== undefined || !partial) data.sportId = id(body.sportId);
  if (body.venueId !== undefined) data.venueId = body.venueId ? id(body.venueId) : null;
  for (const key of ['pricePerSlot', 'quantity']) {
    if (body[key] !== undefined || !partial) {
      const value = Number(body[key] ?? (key === 'quantity' ? 1 : 0));
      if (!Number.isFinite(value) || value < 0 || (key === 'quantity' && !Number.isSafeInteger(value))) throw fail(`Invalid ${key}`, 400);
      data[key] = key === 'pricePerSlot' ? money(value) : value;
    }
  }
  if (body.isActive !== undefined) { if (typeof body.isActive !== 'boolean') throw fail('Invalid active status', 400); data.isActive = body.isActive; }
  return data;
}
async function checkVenue(tx, data) {
  if (data.venueId) {
    const venue = await tx.venue.findUnique({ where: { id: data.venueId } });
    if (!venue || venue.sportId !== data.sportId) throw fail('Equipment must belong to a venue for the same sport', 400);
  }
}
exports.getAllEquipment = wrap(async (req, res) => {
  await expireReservations();
  const where = {};
  if (req.query.venueId) where.venueId = id(req.query.venueId);
  if (req.query.sportId) where.sportId = id(req.query.sportId);
  const range = req.query.rentalDate ? period(req.query) : null;
  const rows = await prisma.equipment.findMany({ where, include, orderBy: { name: 'asc' } });
  const data = await Promise.all(rows.map(async item => {
    if (!range) return item;
    const rentals = await prisma.equipmentRental.findMany({ where: overlap(item.id, range.start, range.end) });
    return { ...item, availableQuantity: Math.max(0, item.quantity - peakReserved(rentals, range.start, range.end)), rentalDays: range.days };
  }));
  res.json({ success: true, data });
});
exports.createEquipment = wrap(async (req, res) => {
  const data = equipmentData(req.body); await checkVenue(prisma, data);
  const item = await prisma.equipment.create({ data }); emitChange();
  res.status(201).json({ success: true, data: item });
});
exports.updateEquipment = wrap(async (req, res) => {
  const data = equipmentData(req.body, true);
  const item = await transaction(async tx => {
    const current = await tx.equipment.update({ where: { id: id(req.params.id) }, data: { updatedAt: new Date() } });
    await checkVenue(tx, { ...current, ...data });
    const reservations = await tx.equipmentRental.count({ where: { equipmentId: current.id, status: { in: ['PENDING_PAYMENT', 'CONFIRMED'] } } });
    if (reservations && (data.quantity !== undefined && data.quantity < current.quantity || data.venueId !== undefined && data.venueId !== current.venueId || data.sportId !== undefined && data.sportId !== current.sportId)) throw fail('Finish or cancel active rentals before reducing or relocating inventory');
    return tx.equipment.update({ where: { id: current.id }, data });
  }); emitChange(); res.json({ success: true, data: item });
});
exports.deleteEquipment = wrap(async (req, res) => {
  await prisma.equipment.update({ where: { id: id(req.params.id) }, data: { isActive: false } }); emitChange();
  res.json({ success: true, message: 'Equipment deactivated; history retained' });
});
exports.rentEquipment = wrap(async (req, res) => {
  const quantity = id(req.body.quantity), equipmentId = id(req.params.id);
  const { start, end, days } = period(req.body);
  await expireReservations();
  const rental = await transaction(async tx => {
    const item = await tx.equipment.update({ where: { id: equipmentId }, data: { updatedAt: new Date() }, include: { sport: true, venue: true } });
    if (!item.isActive || item.sport?.isActive === false || item.venue?.isActive === false) throw fail('Equipment or venue is unavailable');
    const reservations = await tx.equipmentRental.findMany({ where: overlap(equipmentId, start, end) });
    if (quantity + peakReserved(reservations, start, end) > item.quantity) throw fail('Insufficient equipment for the selected dates');
    const totalPrice = money(item.pricePerSlot * quantity * days);
    const rental = await tx.equipmentRental.create({ data: { userId: req.user.id, equipmentId, quantity, totalPrice, rentalDate: start, returnDate: end, status: totalPrice ? 'PENDING_PAYMENT' : 'CONFIRMED' } });
    const payment = await tx.payment.create({ data: { userId: req.user.id, rentalId: rental.id, purpose: 'EQUIPMENT_RENTAL', amount: totalPrice, status: totalPrice ? 'PENDING' : 'PAID', expiresAt: totalPrice ? deadline() : null } });
    return { ...rental, paymentId: payment.id, rentalDays: days };
  }); emitChange(); res.status(201).json({ success: true, data: rental });
});
exports.getMyRentals = wrap(async (req, res) => {
  await expireReservations();
  res.json({ success: true, data: await prisma.equipmentRental.findMany({ where: { userId: req.user.id }, include: rentalInclude, orderBy: { createdAt: 'desc' } }) });
});
exports.getAllRentals = wrap(async (req, res) => {
  await expireReservations();
  res.json({ success: true, data: await prisma.equipmentRental.findMany({ include: { ...rentalInclude, user: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } }) });
});
exports.cancelRental = wrap(async (req, res) => {
  await transaction(async tx => {
    const rentalId = id(req.params.id);
    const payment = await tx.payment.findUnique({ where: { rentalId } });
    if (payment) await tx.payment.update({ where: { id: payment.id }, data: { updatedAt: new Date() } });
    const rental = await tx.equipmentRental.findUnique({ where: { id: rentalId } });
    if (!rental) throw fail('Rental not found', 404);
    if (rental.userId !== req.user.id && req.user.role !== 'ADMIN') throw fail('Not authorized', 403);
    if (!['PENDING_PAYMENT', 'CONFIRMED'].includes(rental.status)) throw fail('Rental cannot be cancelled');
    if (rental.status === 'CONFIRMED' && rental.rentalDate.toISOString().slice(0, 10) <= today() && req.user.role !== 'ADMIN') throw fail('Contact staff to cancel a rental that has started');
    await cancelPayment(tx, payment);
    const changed = await tx.equipmentRental.updateMany({ where: { id: rentalId, status: rental.status }, data: { status: 'CANCELLED' } });
    if (!changed.count) throw fail('Rental changed; refresh and retry');
  }); emitChange(); res.json({ success: true, message: 'Rental cancelled. Paid amounts are queued for refund.' });
});
exports.returnRental = wrap(async (req, res) => {
  const data = await transaction(async tx => {
    const rentalId = id(req.params.id);
    const payment = await tx.payment.findUnique({ where: { rentalId } });
    if (payment) await tx.payment.update({ where: { id: payment.id }, data: { updatedAt: new Date() } });
    const rental = await tx.equipmentRental.findUnique({ where: { id: rentalId } });
    if (!rental || rental.status !== 'CONFIRMED') throw fail('Only confirmed rentals can be returned');
    if (rental.rentalDate.toISOString().slice(0, 10) > today()) throw fail('Cannot return a rental before its collection date');
    const damagedQuantity = Number(req.body.damagedQuantity ?? 0);
    const damageNotes = typeof req.body.damageNotes === 'string' ? req.body.damageNotes.trim() : '';
    if (!Number.isSafeInteger(damagedQuantity) || damagedQuantity < 0 || damagedQuantity > rental.quantity || damageNotes.length > 4000 || damagedQuantity > 0 && !damageNotes) throw fail('Specify damaged units and describe any damage', 400);
    await tx.equipment.update({ where: { id: rental.equipmentId }, data: { updatedAt: new Date() } });
    const changed = await tx.equipmentRental.updateMany({ where: { id: rentalId, status: 'CONFIRMED' }, data: { status: 'RETURNED', returnedAt: new Date(), damagedQuantity, damageNotes: damageNotes || null } });
    if (!changed.count) throw fail('Rental already returned or changed');
    if (damagedQuantity) await tx.equipment.update({ where: { id: rental.equipmentId }, data: { quantity: { decrement: damagedQuantity } } });
    return tx.equipmentRental.findUnique({ where: { id: rentalId }, include: rentalInclude });
  }); emitChange(); res.json({ success: true, data });
});
