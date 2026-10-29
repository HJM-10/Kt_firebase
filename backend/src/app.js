require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const authRoutes = require('./routes/auth.routes');
const sportsRoutes = require('./routes/sports.routes');
const venuesRoutes = require('./routes/venues.routes');
const bookingsRoutes = require('./routes/bookings.routes');
const tournamentsRoutes = require('./routes/tournaments.routes');
const matchesRoutes = require('./routes/matches.routes');
const paymentsRoutes = require('./routes/payments.routes');
const reviewsRoutes = require('./routes/reviews.routes');
const complaintsRoutes = require('./routes/complaints.routes');
const eventsRoutes = require('./routes/events.routes');
const equipmentRoutes = require('./routes/equipment.routes');
const promoRoutes = require('./routes/promo.routes');
const membershipRoutes = require('./routes/membership.routes');
const notificationsRoutes = require('./routes/notifications.routes');
const recommendationsRoutes = require('./routes/recommendations.routes');
const reportsRoutes = require('./routes/reports.routes');
const usersRoutes = require('./routes/users.routes');
const errorHandler = require('./middleware/errorHandler');
const { authenticate } = require('./middleware/auth');

const app = express();
app.disable('x-powered-by');
app.use(require('helmet')());
app.use('/api/auth', require('express-rate-limit').rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: 'draft-7', legacyHeaders: false }));

// Middleware
app.use(cors({
  origin: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173').split(','),
  credentials: true
}));
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), require('./controllers/checkout.controller').webhook);
app.use(express.json({ limit: '100kb' }));
app.use(morgan('dev'));

// The payment provider redirects here without the customer's bearer token.
app.get('/api/payments/return', (req, res) => res.type('text').send('Return to Smart Sports Hub and refresh your payments. Confirmation is recorded after the payment provider verifies the transaction.'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    message: 'Smart Sports Hub API is running!',
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/api/auth', authRoutes);

// Apply authentication middleware globally for all subsequent API routes
app.use('/api', authenticate);
app.use('/api', require('./middleware/businessValidation'));
app.use('/api', (req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const resource = req.path.split('/')[1];
    res.once('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try { require('./lib/socket').getIO().emit('resource_changed', { resource }); } catch {}
        if (['bookings', 'venues', 'sports', 'payments', 'equipment', 'promo', 'events', 'tournaments', 'matches'].includes(resource)) require('./lib/reservation-lifecycle').emitChange();
      }
    });
  }
  next();
});

app.use('/api/sports', sportsRoutes);
app.use('/api/venues', venuesRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/tournaments', tournamentsRoutes);
app.use('/api/matches', matchesRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/complaints', complaintsRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/promo', promoRoutes);
app.use('/api/membership', membershipRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/recommendations', recommendationsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/users', usersRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
});

// Error handler
app.use(errorHandler);

module.exports = app;

