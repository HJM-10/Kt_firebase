const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { register, login, getMe, updateProfile, changePassword } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { authSchemas } = require('../validations');

const loginLimiter = rateLimit({
  ...require('../lib/shared-state').rateLimitStore('login'),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 login requests per windowMs
  message: { success: false, message: 'Too many failed login attempts, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
  requestWasSuccessful: (req, res) => res.statusCode !== 401,
  skipSuccessfulRequests: true, // only count failed attempts
});

router.post('/register', validate(authSchemas.register), register);
router.post('/login', loginLimiter, validate(authSchemas.login), login);
router.get('/providers', (req, res) => res.json({ success: true, data: { firebase: process.env.FIREBASE_AUTH_ENABLED === 'true' && !!process.env.FIREBASE_WEB_API_KEY, firebaseApiKey: process.env.FIREBASE_AUTH_ENABLED === 'true' ? process.env.FIREBASE_WEB_API_KEY || null : null } }));
router.post('/firebase', loginLimiter, require('../controllers/firebase-auth.controller').exchange);
router.get('/me', authenticate, getMe);
router.put('/me', authenticate, validate(authSchemas.updateProfile), updateProfile);
router.put('/password', authenticate, validate(authSchemas.changePassword), changePassword);

module.exports = router;
