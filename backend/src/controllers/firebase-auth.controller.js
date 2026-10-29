const prisma = require('../lib/prisma');
const firebase = require('../lib/firebase-auth');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('node:crypto');
const handleError = require('../middleware/errorHandler');

async function exchange(req, res) {
  try {
    if (!firebase.enabled()) return res.status(503).json({ success: false, message: 'Firebase sign-in is not configured. Use your existing account sign-in.' });
    const identity = await firebase.verify(req.body.idToken);
    if (!identity.email || !identity.email_verified) return res.status(403).json({ success: false, message: 'Verify your email in Firebase before signing in.' });
    const email = identity.email.trim().toLowerCase();
    let user = await prisma.user.findUnique({ where: { firebaseUid: identity.uid } });
    if (!user) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        // Email ownership alone must never grant an existing local admin account.
        if (existing.firebaseUid || typeof req.body.existingPassword !== 'string' || !await bcrypt.compare(req.body.existingPassword, existing.password)) return res.status(409).json({ success: false, message: 'This email already has a local account. Enter its existing password to link Firebase securely.' });
        const linked = await prisma.user.updateMany({ where: { id: existing.id, firebaseUid: null, isActive: true }, data: { firebaseUid: identity.uid } });
        if (!linked.count) return res.status(409).json({ success: false, message: 'Account could not be linked. Refresh and retry.' });
        user = { ...existing, firebaseUid: identity.uid };
      } else {
        user = await prisma.user.create({ data: { email, firebaseUid: identity.uid, name: identity.name || email.split('@')[0], password: await bcrypt.hash(randomUUID(), 10), role: 'CUSTOMER' } });
      }
    }
    if (!user.isActive) return res.status(401).json({ success: false, message: 'Account is inactive' });
    const token = jwt.sign({ id: user.id, firebaseUid: identity.uid, firebaseAuthTime: identity.auth_time }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const { password: _, firebaseUid: __, ...publicUser } = user;
    res.json({ success: true, data: { user: publicUser, token } });
  } catch (error) {
    if (['auth/argument-error', 'auth/invalid-id-token', 'auth/id-token-expired', 'auth/id-token-revoked', 'auth/user-disabled', 'auth/user-not-found'].includes(error.code)) return res.status(401).json({ success: false, message: 'Firebase identity is invalid, revoked, disabled or expired. Sign in again.' });
    if (error.code?.startsWith('auth/')) return res.status(503).json({ success: false, code: 'SERVICE_UNAVAILABLE', message: 'Firebase sign-in is unavailable or needs project configuration. Use your existing account or retry later.' });
    if (error.code === 'P2002') return res.status(409).json({ success: false, message: 'Account changed during sign-in. Please retry.' });
    handleError(error, req, res);
  }
}
module.exports = { exchange };
