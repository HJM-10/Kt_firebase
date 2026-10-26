# Arena Desk mobile admin implementation

Implemented 25 October 2026 on the existing `New-UI` branch. The customer navigation and customer court hierarchy are outside this change.

## Screens and actions

- **Overview:** the selected Pakistan calendar day, a photo header, a horizontally scrollable facility timetable, booking count, gross paid activity, walk-in creation, arrivals and pending-payment attention cards. The timetable draws only persisted published slots; blank intervals are not advertised as available. It starts near the first published session instead of filling the initial view with unused early-morning hours.
- **Bookings:** date-specific All / Pending / Confirmed / Checked in / Cancelled filters; customer, facility, time, price and payment/entry states. Cash confirmation requires an explicit “Money received” decision. Confirmed customers can be checked in after confirming arrival, using the existing single-use entry endpoint. The quick arrival action is limited to the current Pakistan day and sessions that have not ended.
- **Courts:** photo-led facility cards, sport filters, actual availability and published-session counts, capacity, session price, current/next reservation and drawn sport diagrams. Diagrams are labelled as illustrations of the sport, not measured plans of real courts. Add/edit supports name, sport, description, price, capacity, optional photo URL and activation state. Session management supports publishing non-overlapping times and selecting an open session for a walk-in.
- **More:** preserves access to sports, users, tournaments, events, fixtures, payments, reports, entry-token verification, profile/appearance and sign-out. The sports catalogue now uses the matching photo set instead of generic sports glyphs.

The main admin navigation and operational actions use a custom set of line symbols drawn directly in Flutter, with consistent strokes. The eight bundled sport images are reused. Forest, cream, brass and deep pine are retained in both themes, including brass pending-payment blocks. Layouts adapt to narrow screens and enlarged text.

## Data and API

`GET /api/reports/arena-desk?date=YYYY-MM-DD` is protected by the existing admin authorization middleware. It returns all facilities (including inactive facilities), their published slots and booking states for the requested day, the sports catalogue, a sorted day booking list and summary values. Daily reads are not capped by the old 100-booking list default. Entry tokens and passwords are excluded from the overview payload.

The date is validated as a real calendar date. Payment day boundaries use UTC+05:00, including the 19:00 UTC midnight transition. Gross paid activity uses the existing payment `updatedAt` convention for records currently marked PAID; the screen explicitly states this definition and that refunds are not deducted. A dedicated settlement timestamp would be needed for a separate cash-ledger accounting feature.

Venue records remain the existing independently bookable facilities. No synthetic Court 01/02 records, arena subdivisions, physical occupancy measurements or maintenance ratings are fabricated. The current schema does not hold maintenance condition assessments or an arena-to-court hierarchy. The customer-side hierarchy discussion remains separate.

Live resource updates, booking changes, reconnects, pull-to-refresh and a one-minute refresh keep the desk current. Refresh failures preserve the previous snapshot with a visible warning and disable operational changes until a successful refresh. Date changes clear the prior day's snapshot so actions cannot use the wrong day.

Walk-ins send the customer's name and phone to the existing booking API. The server decides the price, slot claim and initial payment state; the UI never marks a paid walk-in as collected automatically. Existing payment and single-use check-in protections are retained. No real payment or customer booking was created as part of these checks.

## Verification and review captures

- Backend suite: **44 tests passed across six suites**, including seven new Arena Desk cases for authorization, date validation, Pakistan day boundaries, empty results, cancellations and overview field selection.
- The initial Flutter admin pass completed six cases, including both-theme rendering, walk-in payloads, failure presentation and scrolling all four tabs at 320px width with 150% text size. Two cases stopped because the test needed to scroll/pump before tapping controls; those test interactions were corrected.
- The subsequent Flutter test run was declined at the permission prompt. The final full Flutter rerun remains pending and is not claimed as passing.
- Full Dart analysis of `lib` and `test`: **no issues found**. JavaScript syntax checks and the Git whitespace check also passed.

`implementation/` contains **first-pass Flutter renders with sample fixture data**, not screenshots from a newly installed Android build. The timetable starting range and brass pending-payment styling were refined after those captures. The original design boards remain in this folder for comparison.

To regenerate final captures and rerun the interaction checks when permitted:

```powershell
flutter test --no-pub --dart-define=RENDER_ARENA_DESK=true test/arena_desk_test.dart
flutter test --no-pub
```

The Android debug app was subsequently built and installed on the connected Samsung Galaxy A72 at the user's request. The API was restarted and its Arena Desk route was verified against the actual isolated local database. The user then requested a populated visual preview; see [DEMO_PREVIEW.md](DEMO_PREVIEW.md) for the additive fixture script and simulated payment data. These phone checks supplement the earlier widget checks; a full final Flutter test rerun remains pending.
