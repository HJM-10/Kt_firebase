# Android customer journey acceptance — task 1

Date: 17 October 2026 (Asia/Karachi). Device: Samsung Galaxy A72 (SM-A725F), physical Android over USB. Tested against the actual local Node API and isolated MariaDB demo database, using a separate QA customer and clearly marked QA fixtures.

## Scope and result

Customer journey checks are complete for the implemented non-payment flows listed below. Payment-method testing was stopped at the user's request. Registration, profile editing and password changes remain task 3; admin dashboard acceptance remains task 2; replacing the demo catalogue remains task 5.

The final debug app is installed on the phone. The test API address is `http://127.0.0.1:5000/api`, connected through `adb reverse tcp:5000 tcp:5000`; the computer's local API/database and USB connection are required for this test build.

| Journey | Device result and evidence |
|---|---|
| Customer sign-in | Passed with the isolated QA account. Correct customer home and navigation. |
| Startup and background behavior | Fresh app restart requires login as designed. Background/resume and final logout checked separately. |
| Sports and venues | Passed: Basketball, Chess, Cricket, Football, Hockey, Padel, Polo and Swimming each opened its matching venue list. |
| Availability | Past slots disabled; a reserved slot becomes disabled. Future-date selection works. |
| Free booking | Confirmed record and QR created. Corrected the message that incorrectly requested payment for free bookings. |
| Promo validation | Invalid code rejected before persistence. Valid 10% QA code produced a pending Rs. 90 reservation from a Rs. 100 venue. No real money was collected. |
| Rescheduling | Different duration rejected. Matching duration moved successfully; original slot released and new slot claimed. Two-hour cutoff rejection verified. |
| Cancellation | Dismissing confirmation preserved booking. Confirmed cancellation updated history and released availability. Two-hour cutoff rejection verified. |
| Booking history and QR | Confirmed, pending, cancelled and attended states displayed. Confirmed QR visibly rendered. Pending and cancelled cards have no customer QR action. |
| Tournaments and matches | Free registration persisted once; duplicate rejected. Fixed Registered state resetting after navigation. Match listing and schedules displayed. |
| Events | Free registration persisted once; duplicate rejected. Fixed saved-registration display on reopening. |
| Equipment | Free rental saved; fixed erroneous checkout/failure on zero-cost rental. Further rental rejected after stock exhausted. Relabelled total inventory so it does not claim date-specific availability. |
| Membership | Available tiers/prices and an active BASIC test card displayed. Purchase/upgrade testing omitted with payment-method testing. |
| Reviews | Review submitted from an attended QA booking and verified in the database. |
| Help and support | QA complaint submitted and displayed. Staff reply and RESOLVED status displayed. Added a clear required-fields message and submission guard. |
| In-app notifications | QA notification and reschedule notice displayed; read state verified in database. |
| Recommendations | Fixed booking navigation to preserve the recommended date rather than opening today. Final-build retest recorded in local evidence. |
| Device navigation | Android back, keyboard entry/dismissal, vertical scrolling, tabs and background/resume exercised. |
| Payments and invoices | Further checks skipped at the user's explicit request. Earlier pending-reservation check did not collect or confirm money. |

## Fixes delivered

- Persist customer tournament/event registration state from the server, returning only the current customer's registration details.
- Count later-today confirmed bookings as upcoming using the arena's UTC+05:00 slot start time.
- Preserve the date when booking from a recommendation.
- Correct free-booking and free-equipment messages; bypass checkout for zero-cost equipment.
- Explain empty complaint fields, prevent repeated submissions while a request is running, and surface API errors.
- Add labels for customer app-bar actions and guard home updates after navigation.

## Automated verification

- Backend: 37 tests passed across five suites, including customer-registration visibility restrictions.
- Flutter: six tests passed, including today/tomorrow, status and timezone boundaries for upcoming bookings.
- Flutter analysis: no issues found.
- Android debug build: successful using installed NDK 28.2.13676358 and cached build dependencies.
- NDK repair: official Google archive verified against its published checksum before extraction.

## Limits and deliberate exclusions

- Firebase background/push delivery was not tested because Firebase is not configured/enabled for this local test build. In-app notifications were tested.
- Payment gateways, payment return, invoices, paid membership changes and paid registrations/rentals were excluded after the user asked to skip payment testing.
- Equipment currently uses quantity one and an automatic rental date; there is no customer rental-history screen or return/cancellation journey in this Android implementation.
- Tournament/event full/closed-capacity controls have backend protections; exhaustive concurrency and every capacity/date boundary were not exercised on the phone in this pass.
- This is acceptance on one physical Android model, not a multi-device, orientation, accessibility or performance certification.
- No production catalogue, real payment settlement, refund or push delivery is claimed.

## Evidence and cleanup

Device action snapshots, screenshots and database assertions are retained locally under ignored `qa/evidence/`. They are not uploaded to GitHub. Temporary QA records are removed after persistence assertions, preserving the original demo users, venues and bookings. The phone is left at the signed-out login screen.

Tasks 2, 3 and 5 have not been started in this acceptance pass.
