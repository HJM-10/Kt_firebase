function enabled() { return process.env.FIREBASE_AUTH_ENABLED === 'true'; }
function auth() {
  if (!enabled()) throw Object.assign(new Error('Firebase sign-in is not configured'), { status: 503 });
  const { getApps, initializeApp, applicationDefault } = require('firebase-admin/app');
  if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: process.env.FIREBASE_PROJECT_ID });
  return require('firebase-admin/auth').getAuth();
}
async function verify(idToken) {
  if (typeof idToken !== 'string' || !idToken || idToken.length > 10000) throw Object.assign(new Error('A Firebase ID token is required'), { status: 400 });
  return auth().verifyIdToken(idToken, true);
}
async function sessionValid(uid, authTime) {
  const user = await auth().getUser(uid);
  return !user.disabled && Number.isFinite(authTime) && authTime * 1000 >= (Date.parse(user.tokensValidAfterTime || '') || 0);
}
module.exports = { enabled, auth, verify, sessionValid };
