const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

const authenticate = async (req, res, next) => {
  if (req.user) return next();
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, code: 'AUTH_REQUIRED', message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.firebaseUid) {
      try {
        if (!await require('../lib/firebase-auth').sessionValid(decoded.firebaseUid, decoded.firebaseAuthTime)) return res.status(401).json({ success: false, code: 'SESSION_INVALID', message: 'Firebase session was revoked. Sign in again.' });
      } catch (error) {
        if (['auth/user-not-found', 'auth/user-disabled'].includes(error.code)) return res.status(401).json({ success: false, code: 'SESSION_INVALID', message: 'Firebase account is unavailable' });
        return res.status(503).json({ success: false, code: 'SERVICE_UNAVAILABLE', message: 'Identity service is temporarily unavailable. Please retry.' });
      }
    }
    const user = await prisma.user.findUnique({ where: { id: decoded.id }, select: { id: true, role: true, isActive: true, firebaseUid: true } });
    if (!user || !user.isActive) return res.status(401).json({ success: false, code: 'SESSION_INVALID', message: 'Account is inactive or unavailable' });
    if (decoded.firebaseUid && decoded.firebaseUid !== user.firebaseUid) return res.status(401).json({ success: false, code: 'SESSION_INVALID', message: 'Firebase account link has changed. Sign in again.' });
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError' || err.name === 'NotBeforeError') {
      return res.status(401).json({ success: false, code: 'SESSION_INVALID', message: 'Invalid or expired token' });
    }
    return next(err);
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
};

module.exports = { authenticate, requireAdmin };
