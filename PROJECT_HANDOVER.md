# Smart Sports Hub — project handover

**Checklist update, 25 October 2026:** The six requested areas (facilities, bookings, cancellations/rescheduling, tournaments, fixtures/results, and events) have been updated and tested with demo data. See [CHECKLIST_COMPLETION.md](CHECKLIST_COMPLETION.md) for current behavior, verification, and the remaining live-payment configuration limit. The corresponding gap descriptions below are the earlier audit, not the current checklist status.

**Later demo setup, 16 October 2026:** The user requested dummy logins. A separate local MariaDB demo database is now running, Prisma generation and all four migrations succeeded, and both clients were signed in with real backend authentication. See DEMO_ACCESS.md for credentials, sample data and restart commands. The missing-database statements below describe the initial audit environment, before this demo setup; the friend's original database/configuration is still unavailable. Feature limitations remain applicable.

Reviewed on 16 October 2026. This describes the current checkout, the checks performed in this session, and the work needed to continue it. The older PROJECT_AUDIT.md describes another environment and earlier verification; its results are not assumed to apply to this machine.

## Current running previews

| Application | Local URL | Verified in this session |
|---|---|---|
| Flutter application compiled for the browser | http://localhost:5173 | Login screen visibly rendered; no captured browser warnings/errors at that check |
| Separate React website | http://localhost:5174 | Login page visibly rendered |
| Node API | Expected at http://localhost:5000/api | Not started: backend configuration/database missing and Prisma client generation incomplete |

These are local development previews, not public deployments. Their server processes must remain running. Login, signup, and all saved-data operations require the API and database; the visible login screens do not establish that those operations work.

The user confirmed that the friend's backend configuration and database export are not available yet. No MySQL/MariaDB Windows service, running database process, or listener on port 3306 was found in the checks performed. This does not prove no database software exists elsewhere on the computer. No database was created, migrated, or seeded.

## What the project is

Smart Sports Hub is a multi-sport arena booking and management system. Customers browse facilities, reserve time slots, join competitions/events, rent equipment, manage memberships and see payment/booking records. Administrators manage the catalogue, availability, customers, bookings, competitions and reports.

The proposal names Cricket, Football, Basketball, Hockey, Polo, Swimming, Chess and Padel. The seed file includes those sports; their presence in a real database has not been verified here. Administrators can add other sports.

This is three applications in one repository, not just Flutter:

| Folder | Purpose | Main technologies |
|---|---|---|
| frontend_mobile | Customer app plus some admin screens; browser build used for this preview | Flutter/Dart, Provider, Dio, secure storage, Socket.IO, Firebase Messaging, QR rendering |
| frontend_web | Separate browser interface with extensive admin features and customer pages | React, Vite, React Router, Zustand, Axios, Socket.IO, HTML5 QR scanner |
| backend | Shared API, authorization, business rules, payments and persistence | Node.js, Express, Prisma, MySQL, JWT, bcrypt, Zod, Socket.IO; optional Stripe and Firebase Admin |

Both clients send requests to the same API, which reads/writes MySQL through Prisma. Socket.IO broadcasts changes so clients can refresh data. Stripe checkout/webhooks handle the implemented online-payment integration; Firebase Messaging is optional push delivery.

The proposal primarily describes a Flutter Android customer app and a React admin dashboard. Both clients now have broader overlapping capabilities. Flutter web is useful for previewing the mobile code, but it does not replace testing on an Android device. Android, web and Windows project directories exist; there is no iOS project directory in this checkout.

## Feature inventory

“Present” below means screens/routes/business logic exist, not that every path was tested against a real database today.

| Area | Existing implementation | Remaining work or limitation |
|---|---|---|
| Accounts | Registration, login, profile/password changes, CUSTOMER/ADMIN roles, active-account checks, hashed passwords and JWT authorization | No password recovery or email verification flow found. Flutter clears the saved token at startup; network login failures are shown as credential failures. |
| Sports and venues | Dynamic catalogue, prices, capacity, active/inactive records and admin editing | Real facilities, opening hours, closures and verified pricing need configuration. Booking checks venue activity but does not load/check its parent sport's activity. |
| Slots and booking | Admin-created slots, overlap checks, transactional slot claims, customer history, admin walk-ins, discounts, cancellation and rescheduling | No automatic expiry of unpaid holds found. Cancellation and rescheduling policies need acceptance tests and clear presentation. Booking time calculations assume UTC+05:00. |
| Payments | Server-priced payment records, admin cash confirmation, Stripe hosted checkout, signature-verified webhook settlement, invoices | Provider configuration absent here. Cancellation does not execute refunds. Reconciliation of late payments, duplicate sessions and failed/cancelled bookings needs a complete workflow. |
| QR check-in | Booking QR generation, React camera scanner, Flutter token-entry screen, single-use state update | Flutter camera scanning is absent. The scan endpoint checks payment/status but does not restrict entry to the booked date/time. |
| Tournaments | Creation, registration, capacity checks on customer registration, league pairing, knockout round generation, scores/winners | No byes for non-power-of-two knockout entries; generation stops once one winner remains rather than finalizing a champion. Venue clashes, standings and rest-aware scheduling are incomplete. |
| Events | Types, dates, capacity, registration, fees and admin management | Attendance, registration cancellation/refunds and unpaid-capacity expiry need completion. |
| Membership | BASIC/SILVER/GOLD, card number, paid activation, booking discounts | Purchase does not assign an expiry. Existing active memberships/payment history block self-service changes. Renewal, upgrade and history design need work. |
| Equipment | Inventory, dated rental requests, overlapping-stock checks and payments | Rentals are CONFIRMED before payment. Price is unit price times quantity regardless of duration. Return/damage/deposit/cancellation workflows are missing. |
| Promo codes | Fixed/percentage discounts, expiry, minimum order and usage limits | Redemption/reversal rules for cancelled bookings and per-customer policy need definition. |
| Reviews and complaints | Venue feedback tied to a customer's booking, complaint tracking and admin responses | A future CONFIRMED booking can qualify for a review; attendance is not required. Moderation policy and mobile admin access need review. |
| Notifications | Persisted in-app notifications, read state, push integration code, refresh events | Push is off by default and credentials are absent. Physical-device/background delivery and browser push setup are unverified. |
| Recommendations | Preference counts from past confirmed/scanned bookings; up to five upcoming available slots | A rule-based heuristic, not a trained model. Date filtering compares a date-only column with the current timestamp, which can exclude today's remaining slots. Active venue/sport filtering is missing. |
| Reports | Paid revenue, booking statuses, utilisation, top customers and CSV export | Utilisation is booked slots divided by all slots across time; it is not a selected-period occupancy metric. Refund and settlement accounting require agreed definitions. |

## Highest-priority code findings

These are source-review findings. Database race scenarios and payment-provider behaviour were not reproduced live in this session.

1. **Unpaid reservations can retain capacity indefinitely.** Booking creation immediately marks a slot booked; no hold deadline or expiry worker exists in the inspected backend. Equipment rentals similarly consume stock while payment is PENDING. Start with an explicit hold/payment/expiry lifecycle.
2. **Cancellation and money are disconnected.** cancelBooking marks a booking CANCELLED and pending payments FAILED, but paid money is not refunded. A late provider webhook can then fail settlement and require reconciliation. Design refund states and retries before real payment use.
3. **Manual tournament registration bypasses safeguards used by customer registration.** manualRegister checks capacity before its transaction, does not lock/recheck capacity or enforce UPCOMING status, and defaults a paid-entry payment to PAID when paymentStatus is omitted. Simultaneous admin requests can exceed capacity, and accounting can record payment without the explicit receipt acknowledgement used elsewhere. FREE entries in paid tournaments are also excluded by fixture eligibility because they have no PAID payment record.
4. **Check-in lacks a time window.** A CONFIRMED booking can be scanned regardless of whether its slot is in the future or past. Add an arena-timezone policy and boundary tests.
5. **Money uses floating-point database fields.** Prices, discounts and payment amounts are Float. Define decimal or integer minor-unit storage and migrate deliberately when the database is available.
6. **Authentication errors can hide outages.** Backend authentication maps any exception, including a database failure, to an invalid-token 401. Flutter deletes tokens on 401 but does not consistently reset authenticated UI state, and its login catch presents server/network failures as bad credentials. Separate these cases.
7. **Release setup remains development-oriented.** Android uses an example application ID and debug signing for release. API addresses default to localhost/emulator addresses. Web metadata is still partly template text. These must be configured before distribution.

Useful source locations: backend/src/controllers/{bookings,payments,checkout,tournaments,fixtures,equipment,membership,recommendations}.controller.js, backend/src/middleware/auth.js, backend/prisma/schema.prisma, frontend_mobile/lib/providers/auth_provider.dart, frontend_mobile/lib/services/api_service.dart, and frontend_mobile/android/app/build.gradle.kts.

## What was actually tested

| Check | Result | Scope |
|---|---|---|
| Flutter browser run | Passed | Compiled and visually confirmed login screen |
| Flutter analyze --no-pub | Passed: no issues | Static analysis, not functional acceptance |
| Flutter test --no-pub | Passed: 1 test | Login fields and navigation to a placeholder signup route |
| React production build | Passed | Bundled successfully |
| React lint | Completed with warnings | Unused symbols, effect/dependency patterns, refresh exports and scanner callback warning; not a clean lint result |
| Backend Jest | Passed: 17 tests, 3 suites | Mocked database; authentication, validation, authorization and limited booking checks |
| Prisma client generation | Incomplete | Engine download first failed under network restrictions; permission for the retry was declined |
| Real-database API smoke test | Not run | Missing database/environment/client setup |
| Android build/device, camera, push and online payment settlement | Not tested here | Earlier audit claims are not fresh evidence |

Initial backend-test failures were sandbox-denied local connections; with local networking permitted, all 17 tests passed. Do not mistake the mocked test suite for proof of database transaction correctness. The existing backend/scripts/smoke.js creates and removes test records and should only run against a disposable local test database.

## Where to start working

1. **Make the complete system reproducible.** Obtain a development database export or create an explicitly separate demo database. Obtain the backend configuration securely, confirm the original Flutter version, generate Prisma, apply/check migrations, and document startup. Acceptance: both clients can sign in and read the same catalogue.
2. **Finish one complete booking journey.** Admin creates a sport, venue and future slot; customer reserves; staff records a demo cash receipt; customer sees a QR; admin checks in exactly once. Then test rejection of double bookings, unauthorized access, wrong-time scans and expired holds. This crosses all three applications and is the best foundation for continued work.
3. **Complete booking/payment lifecycle rules.** Expiry, cancellation, refund/reconciliation and rescheduling should be consistent in API, database and both clients. Add targeted database-backed tests for races and webhook retries.
4. **Finish tournament, membership and rental lifecycles.** Fix manual registration first, then byes/finals/standings, membership renewal/history, rental payment states and returns.
5. **Complete device and integration work.** Physical Android testing, camera check-in, Firebase delivery, reconnect/error behaviour and essential mobile admin gaps. Decide which admin tasks belong on mobile versus React based on the proposal and actual needs.
6. **Prepare acceptance and release.** Test customer/admin journeys, small screens, accessibility and failure states. Configure production URLs, signing, backups, monitoring and deployment only after the workflows pass.

This is a substantial prototype with reusable foundations. A completion percentage would be misleading until the database-backed acceptance tests are run. Begin by making the existing booking path work end to end, rather than adding more screens.

## Code navigation for a new maintainer

| Want to change… | Start here |
|---|---|
| Flutter app startup/navigation | frontend_mobile/lib/main.dart |
| Flutter screen behaviour | frontend_mobile/lib/screens/ |
| Flutter login/theme state | frontend_mobile/lib/providers/ |
| Flutter API address, HTTP and socket connection | frontend_mobile/lib/services/api_service.dart |
| React routes/role protection | frontend_web/src/App.jsx and src/components/ProtectedRoute.jsx |
| React screen/UI styling | frontend_web/src/pages/, src/components/, src/index.css |
| React auth and API calls | frontend_web/src/store/authStore.js and src/api/axios.js |
| API registration/security middleware | backend/src/app.js and src/middleware/ |
| API endpoint behaviour | backend/src/routes/ and src/controllers/ |
| Database entities/relationships | backend/prisma/schema.prisma and migrations/ |
| Fixtures, seed data and tests | backend/prisma/seed.js, backend/tests/, backend/scripts/smoke.js |

Prisma defines 19 models: User, Sport, Venue, BookingSlot, Booking, Payment, Tournament, Match, TeamRegistration, Review, Complaint, Event, EventRegistration, Equipment, EquipmentRental, PromoCode, PromoCodeUsage, Membership and Notification. Sport links to venues, tournaments, events and equipment. A venue has slots; a user books a slot. Payment can belong to a booking, tournament/event registration, membership or rental. Reviews link users, venues and bookings. Use the schema as the authoritative relationship map.

## Restart and setup notes

Flutter preview, from frontend_mobile:

```powershell
flutter pub get
flutter run -d web-server --web-hostname localhost --web-port 5173 --no-pub
```

React preview, from frontend_web:

```powershell
npm ci --ignore-scripts
npm run dev -- --host localhost --port 5174 --strictPort
```

Backend, once MySQL and a private .env are ready, from backend:

```powershell
npm ci --ignore-scripts
npx prisma generate
# On the intended local development database, after checking migration state:
npx prisma migrate deploy
npm start
```

An .env.example template is supplied. Its database credentials and JWT secret are placeholders and must be replaced. Do not run migrations on an unknown or production database. Seed only an intentionally disposable demo database: the existing seed contains published demo passwords and example business records.

Flutter web defaults to http://localhost:5000/api. Android emulator defaults to http://10.0.2.2:5000/api. Override with --dart-define=API_BASE_URL=... when needed. React proxies /api and /socket.io to port 5000. Flutter's preview port is fixed at 5173 to match the backend's existing default CORS settings. The example configuration includes both preview origins.

Installed SDK observed: Flutter 3.35.7 / Dart 3.9.2. Dependency resolution changed frontend_mobile/pubspec.lock to compatible versions; retain/review this diff or align the SDK with the friend's environment before choosing the team's baseline. No application feature code was changed. Dependencies and generated build artifacts were produced locally, and package caches are ignored. Added handover documentation and the backend configuration template.

The proposal mentions Firebase Authentication and Google Maps in its tentative tools list. Actual authentication is bcrypt/JWT, and no Maps integration was found. Clarify whether those tool-list items are acceptance requirements; Firebase Auth is not necessary for the existing JWT design to function.
