# Smart Sports Hub — proposal audit and implementation review

Reviewed 6 October 2026 against the project proposal document. The document describes requirements; it is not authorization to configure third-party accounts or publish sensitive data.

## Current result

The project has a real MySQL-backed Node API, React web application and Flutter Android application. Substantial functional and security repairs were implemented in this review. It is usable locally, but is **not yet a complete production implementation of every proposal requirement**. A successful build or endpoint test does not prove complete usability, payment settlement, push delivery or production reliability.

Local web: http://localhost:5173/ . Backend: http://localhost:5000/api . Android debug artifact: `frontend_mobile/build/app/outputs/flutter-apk/app-debug.apk`. Local URLs require this computer and the development services to remain running. No public hosting deployment was configured.

## Proposal comparison

| Requirement | Web | Android | Remaining qualification |
|---|---|---|---|
| Authentication, profiles, roles | Implemented | Implemented | JWT used rather than Firebase Auth. Active-user and current-role enforcement repaired. Password recovery, verified identity and production credential policy need review. |
| Eight sports and dynamic catalogue | Implemented | Implemented | Existing catalogue contains disabled sports and legacy QA/example records. Availability must reflect the arena's actual facilities; disabled sports were not silently enabled. |
| Venues and published booking slots | Implemented | Implemented | Removed automatic fabricated availability. Admin publishes actual slots. Opening-hours calendars, closures and timezone configuration remain needed. |
| Concurrent bookings | Implemented | Implemented | Atomic claims verified with competing HTTP requests. Pending reservations still need expiry/hold jobs. |
| Cancellation and rescheduling | Implemented | Implemented | Rescheduling preserves venue, duration and original price, with customer notice policy. Refunds and broader price-change policies remain incomplete. |
| Tournaments and registration | Implemented | Implemented, partial admin parity | Paid/free eligibility enforced for generated fixtures. Native admin operations are less complete than web. Manual registration payment/capacity policy needs further hardening. |
| League/knockout fixtures | Persisted generation | Persisted generation | League produces all pairs. Knockout requires power-of-two eligible teams; byes, champion finalization, venue conflicts and rest-aware scheduling remain incomplete. |
| Results | Persisted | Persisted | Score types and winning-team validation repaired. Full bracket/standings presentation needs further work. |
| Events and capacity | Persisted | Persisted | Capacity checks serialized; deleting registered event history is blocked. Attendance/refund workflows remain incomplete. |
| Payments and invoices | Implemented UI/API, externally blocked | Implemented UI/API, externally blocked | New fake payment identifiers removed. Admin-only cash receipt confirmation. Hosted checkout refuses collection without a webhook secret. Actual merchant onboarding and verified settlement are required. |
| Push and notifications | In-app notifications | In-app notifications; push unverified | FCM server configuration exists, but Android Firebase project configuration was not present. End-to-end push was not verified. |
| QR check-in | QR display and scanner | QR display and manual token check-in | Server prevents repeated scanning. Android camera scanning and entry-time eligibility still need implementation. |
| Reviews and complaints | Persisted | Persisted | Mobile review route and complaint admin routing repaired. Moderation and verified-attendance review eligibility need review. |
| Memberships | Persisted purchase/card | Persisted purchase/card | Pending purchase retry repaired. Paid activation requires real payment. Renewal, upgrades and expiry jobs remain incomplete. |
| Equipment rental | Persisted, capacity protected | Persisted, capacity protected | Overlapping stock reservations checked transactionally. Multi-day pricing, unpaid rental state, returns, damages, deposits and cancellation remain incomplete. |
| Promo codes | Persisted | Booking application | Usage limits locked transactionally. Broader eligibility and customer redemption policy remain needed. |
| Recommendations | Existing history-based API | Existing integration | This is a simple heuristic, not trained AI. Recommendation quality and cold-start behaviour need product evaluation. |
| Revenue/bookings/utilisation/customer reports | Implemented | Admin reports | Revenue now uses paid payment records across purposes. Utilisation definition and consistent spend accounting across all views still need refinement. |
| Real-time updates | Socket refresh on major operational pages | Socket refresh on major customer pages | Reconnect triggers refresh. Some reports/admin/support views still lack equivalent live refresh; webhook settlement broadcast/push needs completion. |
| Responsive UI/UX | Improved and sampled visually | Builds and analyzes cleanly | Shared fixed label column, aligned inputs, row separators and narrow-screen stacking. Visual verification sampled booking, fixtures, settings and sport dialog; not every state/device or accessibility workflow. |

## Changes made

- Replaced variable-width inline label/input layout with a reusable form field and shared grid rules. Inputs begin at the same horizontal position and fill the control column. Smaller screens stack labels above fields. Modal forms inherit the structure.
- Added web booking/rescheduling, booking QR, fixtures, membership, notifications and payment/invoice pages, and matching Android payment, fixture and manual check-in workflows.
- Removed new dummy payment intents/client secrets. Customers cannot self-confirm payment. Cash confirmation explicitly requires an admin acknowledging money received in person.
- Added payment-owned invoices, transactional payment confirmation, safe checkout configuration checks and current-user authorization.
- Added atomic slot/promo/equipment/capacity handling, input validation and repeated-check-in protection.
- Fixed profile saving, event types, mobile tournament fees/review endpoint, reporting revenue/currency and async Flutter context issues.
- Added Socket.IO-driven list refresh, responsive navigation/focus/reduced-motion styling and lazy-loaded web pages.

## Verification

- Web production build: passed. Main JS bundle about 282 kB; largest individual route chunk about 372 kB.
- Backend Jest: 17 tests in 3 suites passed.
- Database-backed HTTP smoke: 61 checks passed, including competing same-slot requests, ownership/RBAC, rescheduling, published-slot conflicts, equipment availability, fixture persistence and invoice access. The latest run removed only its own QA records afterward; older QA records remain.
- Flutter analyzer: no issues found.
- Flutter widget test: passed (one login/navigation test). This is not full mobile end-to-end coverage.
- Android debug build and emulator launch were exercised. Native screen-by-screen interaction, background push and camera scanning were not verified.
- Browser visual samples: aligned desktop booking and fixture forms, profile/password settings, sport creation dialog, and 390 px booking layout.

## Work required before a real launch

1. Select the actual arena payment provider and merchant account. For a Pakistan-based operation, evaluate official JazzCash/Easypaisa merchant onboarding against business eligibility. Stripe availability must match the registered business jurisdiction. Never treat a provider key alone as working settlement.
2. Configure verified provider webhooks, payment reconciliation, refunds, reservation expiry and idempotent notification delivery. Complete rental and membership lifecycles.
3. Supply the real Firebase Android project configuration and test delivery on a physical device in foreground/background states.
4. Complete native admin parity, camera check-in, tournament byes/finals/standings, venue-conflict scheduling and report definitions.
5. Replace legacy/example catalogue entries with verified facilities, prices, opening hours and policies. Do not use smoke/demo seeds in production.
6. Configure a production domain/HTTPS, restricted origins, managed database/backups, secret storage, migrations, logging, monitoring and operational recovery. Use a release-signed Android build with a production API URL.
7. Complete role-based end-to-end, accessibility and physical-device acceptance testing. Verify all loading, error, empty, payment-failure and offline states before claiming full UI/UX coverage.

Official merchant references: https://stripe.com/global ; https://corporateonboarding.jazzcash.com.pk/online-payment ; https://merchantportal.easypaisa.com.pk/faq/ . These identify onboarding/availability information; no payment provider was newly connected or live charge executed during this review.

## Development commands

Run `npm run dev` from `backend` and `frontend_web` in separate terminals. Existing local database/environment configuration is required; keep secrets out of source control. Run `flutter run -d emulator-5554` from `frontend_mobile` for the emulator. Run `npm test -- --runInBand` and `node scripts/smoke.js` from `backend`, `npm run build` from `frontend_web`, and `flutter analyze`, `flutter test`, `flutter build apk --debug` from `frontend_mobile` for verification. The smoke script is a local development test that temporarily creates and removes its own records.
