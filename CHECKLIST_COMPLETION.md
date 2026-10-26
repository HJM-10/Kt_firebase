# Checklist implementation and demo verification

Updated 25 October 2026. This report covers the six rows in the user's screenshot. It supersedes the corresponding initial findings in PROJECT_HANDOVER.md. Work and tests use the isolated local demo database; production facilities and real payment credentials were not supplied or changed.

| Checklist area | Implemented behavior | Verification |
|---|---|---|
| Venue/court management | Editable session prices, capacity, daily opening/closing times, weekly closed days, dated closures and active/inactive facilities. Booking checks include the sport's active state. | Created **Checklist Demo Court** in Flutter: PKR 1,200, capacity 4, 08:00–22:00, Friday closed, maintenance on 26 October 10:00–11:00 PKT. API rejected times outside hours and during both closure types. |
| Live availability, bookings and history | Thirty-minute payment holds, automatic expiry worker, transactional court claims and overlap checks, retained cancelled booking history, live refresh after expiry. | Published 17:00–18:00 in Flutter, reserved a walk-in, verified customer history and rejected double booking. Deliberately expired a separate demo hold and verified the session reopened. Concurrent booking attempts are also tested against MariaDB. |
| Cancellation and rescheduling | Two-hour customer notice, admin override, same venue and duration on reschedule, retained original price, full-refund requests, explicit cash-return receipt, provider refund retry and late-payment reconciliation. | Customer booking #47 moved from 18:00 to 19:00 at PKR 1,200, then was cancelled. Staff completed its simulated refund with receipt **DEMO-REFUND-47-SIMULATED**; payment #89 and refund both show REFUNDED. Exact policy boundaries are tested. |
| Tournament creation and registration | Parent-row locking with current committed capacity checks, closed-registration rejection, distinct eligible teams, default PENDING manual fees, explicit cash-receipt acknowledgement and reasoned zero-value fee waivers. Unpaid team places expire. | Saved **Demo Manual Team** in Flutter with PENDING payment. Database checks exercise simultaneous registrations for one remaining place, cash acknowledgement, expiry, closed tournaments and waived-fee eligibility. |
| Fixtures, scheduling and results | Knockout byes and round progression, champion finalization, league table and completion, registered-venue and sport checks, date-range/closure/booking/event/match conflict checks and 30-minute rest. Completed results are locked. | Generated a three-team knockout in Flutter: one automatic bye, semifinal and final. Recorded results and verified **Knockout Team 1** as champion. The league finished with Team 1 on six points and the other two teams on one point each after a draw. Database checks reject schedule clashes and roll back partial generation. |
| Events and registration | Capacity locking, unpaid place expiry, customer and staff registration cancellation, whole-event cancellation with refund requests, and paid single-use attendance within the event window. | Customer coaching registration and cancellation were exercised in Flutter. Staff checked in **Demo Player** at **Checklist Demo Live Attendance**, cancelled the event while retaining attendance history, then completed payment #87's simulated PKR 100 refund with receipt **DEMO-EVENT-11-REFUND-SIMULATED**. Repeat and unauthorized check-in are also covered by database tests. |

## Flutter layout correction

The Generate Fixtures screen now has labels outside the fields, consistent vertical gaps, a registered-venue picker, a clear date/time button, a constrained wide-screen form and separate saved-fixture cards. Dates are shown in Pakistan time. Layout checks cover widths of 320 and 768 pixels, light and dark themes, and 160% text size.

## Checks

- Backend: **47 tests across 7 suites passed**.
- Flutter: **30 tests passed**, including four Fixtures layout cases and six entry-pass checks; analyzer clean.
- MariaDB/API acceptance: **9 groups passed**, covering actual persistence and concurrent requests. Provider responses in these checks are simulated; no money moves.
- React compatibility build passed. The redesigned interface demonstrated to the user is Flutter at **http://localhost:5173**, not the separate React interface.
- `git diff --check` passed.

Repeat from the respective application directories:

```powershell
# backend (normal regression tests)
npm test -- --runInBand
# backend (explicitly guarded to the isolated local demo database)
node scripts/checklist-acceptance.js
# frontend_mobile
flutter analyze --no-pub
flutter test --no-pub
```

The acceptance script creates temporary users and facilities, then deletes only its own test records. `prepare-checklist-demo.js` retains clearly named walkthrough data; `check-demo-boundaries.js` deliberately creates an expired demo hold. Neither is a production migration or production seed.

## Payment limits of this demonstration

Cash receipts and cash refunds shown in the preview are simulated demo records. Stripe checkout reuse, duplicate/late settlement, refund idempotency and provider-failure retry were tested with simulated provider responses. A live Stripe charge or refund has **not** been verified; that requires configured provider credentials and webhook delivery. REFUNDED is recorded only after explicit staff acknowledgement of cash returned or provider confirmation of an online refund.

Evidence is saved in `qa/evidence/checklist-*.png`; backend execution details are in `qa/checklist-unit-tests.log` and `qa/checklist-acceptance.log`.

The final persisted state was independently checked and saved in `qa/evidence/checklist-final-state.json`. It confirms both tournament champions, released cancelled/expired booking slots, completed booking and event refunds, retained attendance, and automatic expiry of the unpaid manual team entry.

## Entry-pass design follow-up

The entry verification page now uses a compact branded pass card, a separate code form with an explicit Paste action, readable errors, and a player/session receipt after successful check-in. Arena Desk icons retain their square proportions even in full-width lists. Tests cover narrow layouts in both themes with enlarged text, explicit verification before check-in, QR-token parsing, rejected passes, and paste without accidental check-in. Android revision: **1.0.2 (build 3)**.

## Session entry QR follow-up — 25 October 2026

Android revision: **1.0.3 (build 4)**. The user's final rule supersedes the proposed 15-minute cutoff and late fee: entry is allowed from the booked start (inclusive) until the booked end (exclusive). An 20:00–21:00 booking admits a player at 20:59:59.999 and rejects a scan at 21:00. No late fee was added.

Confirmed customers and staff can display an opaque, single-use QR pass. The pass page shows the venue, customer, session and PKT deadline, hides expired/unpaid/cancelled/used passes, refreshes on booking changes and app resume, and advances its display against server time. Booking and walk-in forms explain session-end expiry. Rescheduling rotates the token, invalidating old screenshots. General booking responses omit QR tokens and cached QR images.

The staff verification screen has camera scanning plus manual/paste fallback. Scanning fills the entry code; staff explicitly select **Verify & check in**. Camera denial has retry and manual-entry options. Android bundles the barcode decoder; no first-scan model download is needed. Internet access to the API is required for validation.

Verification: 65 backend tests and 39 Flutter tests passed; Flutter analyzer reported no issues; Android APK built successfully. `node qa/qr-entry-demo.cjs` verified real demo-database concurrent scans (exactly one admission), invalid pass rejection, and reschedule token/deadline replacement, cleaning up its own fixtures. The updated app was installed on Galaxy A72 R58R83NX3FE, and the user confirmed the physical camera captured the displayed QR and returned its code to the confirmation screen. A fresh free walkthrough booking is retained by `backend/scripts/prepare-qr-demo.js` (run from backend, isolated demo DB only). Browser evidence: `qa/evidence/session-entry-pass.png`.
