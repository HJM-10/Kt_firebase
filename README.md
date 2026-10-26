# KT Sports Hub

Sports venue bookings, entry passes, memberships, payments, reviews and complaints. The Express API uses **MySQL with Prisma**. Firebase Cloud Messaging (FCM) delivers Android push notifications; it does not replace MySQL or the existing account system.

## Run locally

1. Install Node.js and Flutter, and create a MySQL database.
2. In `backend`, run `npm ci`, copy `.env.example` to `.env`, and configure the database URL and JWT secret.
3. Run `npx prisma generate` and `npx prisma migrate deploy`, then `npm start`.
4. In `frontend_web`, run `npm ci` and `npm run dev`.
5. In `frontend_mobile`, run `flutter pub get` and `flutter run`. Set `API_BASE_URL` with a Dart define when the backend isn't at the Android emulator's default `http://10.0.2.2:5000/api`.

Only debug Android builds allow a local HTTP API. Use HTTPS for deployed apps.

## Firebase Android push setup

1. Create a Firebase project and register Android package `com.example.smart_sports_hub`.
2. Download its `google-services.json` into `frontend_mobile/android/app/`. The Google Services Gradle plugin is already configured and applies when this file exists.
3. Enable the Firebase Cloud Messaging HTTP V1 API in the project.
4. Download a Firebase Admin service-account key to a private local location. Configure `FIREBASE_ENABLED=true`, `FIREBASE_PROJECT_ID`, and `GOOGLE_APPLICATION_CREDENTIALS` in `backend/.env`. Never commit this key.
5. Verify the computer's date/time is synchronized, then run `node scripts/check-firebase.js` in `backend`. This validates credentials and messaging API access without sending a notification.
6. Build/run Flutter with `--dart-define=FIREBASE_ENABLED=true` and the `FIREBASE_PROJECT_ID`, `FIREBASE_API_KEY`, `FIREBASE_APP_ID` and `FIREBASE_SENDER_ID` values from the downloaded Android configuration, or use an ignored local JSON file with `--dart-define-from-file=path/to/file.json`.
7. Use a phone or emulator with Google Play services, sign in, and allow notifications. Trigger a booking payment, membership activation, complaint response or refund completion. Check the foreground banner and background system notification; tap the notification to open the inbox.

The Android app registers its token on sign-in, refreshes it when Firebase rotates it, and revokes it on sign-out. Foreground messages show an in-app banner; Android displays background notification payloads on the `arena_updates` channel. The inbox and read status remain in MySQL and work while Firebase is disabled. Browser push and iOS push are not configured by this Android setup. A user's most recently registered device receives pushes.

For a controlled device test, run `node scripts/test-device-push.js ACCOUNT_EMAIL foreground` or `background` in `backend` after the account has signed into the configured Android app. This saves an inbox message and sends a real notification to that account’s registered device.

Project configuration, private keys, environment files, local test data and downloaded dependencies are excluded from Git. Configure credentials independently on each machine or deployment environment. Firebase delivery is best effort; the MySQL inbox is the persistent source of notifications.

## Membership rules

Basic cards are free and do not expire. Silver costs PKR 1,000/year; Gold costs PKR 2,500/year. The current paid tier can be renewed, extending its expiry by one year. Upgrades charge the full annual price and start a new year at payment confirmation; existing benefits remain until then. Downgrades are allowed after expiry. The card number and every membership payment/change remain in history. Requests expire after 30 minutes and can be retried. Discounts stop at the exact membership expiry.

The membership-history migration backfills existing cards and gives active paid cards without an expiry a one-year term from their original start date. Review this policy against production data before deployment.

## Payments and moderation

Stripe is optional and deferred until account setup. Online checkout remains unavailable without provider credentials and a verified webhook. Staff can explicitly record cash received, record cash returned with a receipt reference, retry online refunds and reconcile a checkout with Stripe. Provider return pages do not confirm payments. Invoices include refund status and references.

Only the owner of a checked-in booking at the venue can review it. Owners and administrators can remove reviews. Complaint status changes and response-only updates notify the customer; other customers cannot read or moderate those complaints.

QR camera scanning is available on Android. The server permits check-in from the booked start time inclusive until its end time exclusive, in Pakistan time, and accepts a pass only once.

## Verification

- Backend: `npm test -- --runInBand` in `backend`.
- Web: `npm run build`, `npm run lint`, and `node --test tests/session.test.js` in `frontend_web`.
- Flutter: `flutter analyze --no-pub`, `flutter test --no-pub`, and a Firebase-enabled debug APK build in `frontend_mobile`.
- Database acceptance: `node scripts/checklist-acceptance.js` and `node scripts/feature-acceptance.js` in `backend`. Both refuse production or any database other than `127.0.0.1:3307/smart_sports_hub_demo`, create disposable test records, and disable real push delivery. Stripe interactions are simulated.

See `qa/FEATURE_VERIFICATION.md` for the recorded results and remaining live-service checks.

Official setup references: [FCM for Flutter](https://firebase.google.com/docs/cloud-messaging/flutter/get-started), [receiving messages](https://firebase.google.com/docs/cloud-messaging/flutter/receive-messages), and [Firebase Android configuration](https://firebase.google.com/docs/android/setup).
