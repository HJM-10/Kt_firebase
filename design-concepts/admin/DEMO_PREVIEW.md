# Local Arena Desk visual preview

The user requested dummy data on 25 October 2026 so the installed mobile UI could be reviewed with a populated schedule.

Run from `backend`:

```powershell
node scripts/seed-arena-preview.js
```

The script refuses production mode and any database other than `127.0.0.1:3307/smart_sports_hub_demo`. It adds data without clearing, renaming or resetting existing records. It preserves existing bookings and avoids overlapping existing slots. Repeated calls reuse the same dated preview records instead of replacing their current state.

The initial preview adds six clearly named demo customers, two independent Padel court fixtures, sessions across all eight sports for today and the following two days, and 26 labelled example bookings. Examples include pending payment, confirmed, checked-in and cancelled states. A current-session example is added when the day's time permits it. The original demo administrator and customer logins are unchanged.

**Payments are simulated database records. No real money was collected, refunded or sent to a payment provider.** Preview customer emails use the reserved `example.test` domain. Notes carry the `ARENA_DESK_DEMO` marker, and the mobile overview displays a Demo preview label when these bookings are present.

Court and booking cards use the existing matching Clubhouse photographs for Basketball, Chess, Cricket, Football, Hockey, Padel, Polo and Swimming. These remain generated illustrative images, not verified venue photographs. The new Padel court fixtures use the bundled Padel imagery.

The overview prioritizes facilities with bookings, then facilities with published sessions, before empty facilities. This keeps the operational timetable useful when the facility catalogue is larger than the compact overview. The Courts tab still contains the complete facility catalogue.

The initial live verification for 25 October showed ten facilities, nine non-cancelled bookings for the day, two unpaid bookings, and PKR 24,800 in simulated gross paid activity. These numbers can change as the demo is used. Sample bookings for future sessions can be paid in advance, so gross paid activity does not necessarily equal the selected day's booking value.
