const enums = {
  events: { type: ['TRAINING', 'COACHING', 'CAMP', 'LEAGUE', 'FRIENDLY'], status: ['UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED'] },
  tournaments: { format: ['LEAGUE', 'KNOCKOUT'], status: ['UPCOMING', 'ONGOING', 'COMPLETED'] },
  complaints: { status: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'] },
  promo: { discountType: ['PERCENTAGE', 'FIXED'] },
};
module.exports = (req, res, next) => {
  if (!['POST', 'PUT', 'PATCH'].includes(req.method)) return next();
  const body = req.body || {};
  const resource = req.path.split('/')[1];
  const reject = message => res.status(400).json({ success: false, message });
  if (resource === 'venues') {
    for (const key of ['openingTime', 'closingTime']) if (body[key] !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(body[key])) return reject(`${key} must be HH:MM`);
    if (body.openingTime && body.closingTime && body.openingTime >= body.closingTime) return reject('Closing time must follow opening time');
    if (body.closedWeekdays !== undefined && (!Array.isArray(body.closedWeekdays) || body.closedWeekdays.some(d => !Number.isInteger(d) || d < 0 || d > 6))) return reject('Closed weekdays must be numbers from Sunday (0) to Saturday (6)');
    if (body.closures !== undefined && (!Array.isArray(body.closures) || body.closures.length > 100 || body.closures.some(c => !c || !Number.isFinite(Date.parse(c.startAt)) || !Number.isFinite(Date.parse(c.endAt)) || new Date(c.startAt) >= new Date(c.endAt) || typeof c.reason !== 'string' || !c.reason.trim() || c.reason.length > 191))) return reject('Closures require a start, later end and reason');
  }
  for (const key of ['pricePerSlot', 'entryFee', 'fee', 'discountValue', 'minOrderAmount']) {
    if (body[key] !== undefined && body[key] !== null && (!Number.isFinite(Number(body[key])) || Number(body[key]) < 0)) return reject(`${key} must be a nonnegative amount`);
  }
  for (const key of ['sportId', 'tournamentId', 'venueId', 'slotId', 'quantity', 'capacity', 'maxParticipants', 'maxTeams', 'maxUses']) {
    if (body[key] !== undefined && body[key] !== null && (!Number.isSafeInteger(Number(body[key])) || Number(body[key]) < 1)) return reject(`${key} must be a positive integer`);
  }
  for (const key of ['startDate', 'endDate', 'scheduledAt', 'rentalDate', 'returnDate', 'expiresAt']) {
    if (body[key] && !Number.isFinite(Date.parse(body[key]))) return reject(`${key} must be a valid date`);
  }
  if (body.startDate && body.endDate && new Date(body.endDate) < new Date(body.startDate)) return reject('End date must not precede start date');
  for (const [key, allowed] of Object.entries(enums[resource] || {})) {
    if (body[key] !== undefined && !allowed.includes(body[key])) return reject(`Invalid ${key}`);
  }
  if (resource === 'promo' && body.discountType === 'PERCENTAGE' && Number(body.discountValue) > 100) return reject('Percentage discount must not exceed 100');
  if (resource === 'matches' && body.team1 && body.team2 && body.team1.trim().toLowerCase() === body.team2.trim().toLowerCase()) return reject('A team cannot play against itself');
  next();
};
