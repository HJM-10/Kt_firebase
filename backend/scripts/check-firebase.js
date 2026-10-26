require('dotenv').config({ quiet: true });
// Validate credentials/API access without delivering a notification to any device.
async function main() {
  if (process.env.FIREBASE_ENABLED !== 'true' || !process.env.FIREBASE_PROJECT_ID) throw new Error('Configure FIREBASE_ENABLED and FIREBASE_PROJECT_ID first');
  const { initializeApp, applicationDefault } = require('firebase-admin/app');
  const { getMessaging } = require('firebase-admin/messaging');
  initializeApp({ credential: applicationDefault(), projectId: process.env.FIREBASE_PROJECT_ID });
  await getMessaging().send({ topic: 'configuration-validation-only', notification: { title: 'Configuration validation', body: 'Dry run only; never delivered.' } }, true);
  console.log(`PASS Firebase credentials and FCM API access for ${process.env.FIREBASE_PROJECT_ID}. Dry run only; no notification delivered.`);
}
main().catch(error => { console.error(`Firebase validation failed: ${error.code || ''} ${error.message}`); process.exitCode = 1; });
