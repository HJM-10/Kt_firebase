const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { register, login, getMe, updateProfile, changePassword } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { authSchemas } = require('../validations');

const loginLimiter = rateLimit({
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
router.get('/me', authenticate, getMe);
router.put('/me', authenticate, validate(authSchemas.updateProfile), updateProfile);
router.put('/password', authenticate, validate(authSchemas.changePassword), changePassword);

module.exports = router;
