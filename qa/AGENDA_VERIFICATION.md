# Inventory, offers and reporting — 29 October 2026

## Delivered

- Web and mobile venue landing pages show venue hours, session price, equipment inventory and staff-entered brand, model/size, material/surface, ball type and condition. Open them from the booking screen; mobile venue discovery also opens the landing page.
- Web inventory administration supports assigning equipment to a venue of the same sport, maintaining specifications, price, quantity and availability. Existing stock without a venue remains explicitly labelled shared inventory. No brands, ball types or locations are inferred from sport names.
- Web and mobile customers choose collection/return dates and quantities, see prices, review rental/payment history, resume payment and cancel. Both rental desks allow staff to record returns and damage. Web administrators create and activate/deactivate offers; both clients provide a customer offers page.
- Web booking recommendations explain their ranking. Both clients use the corrected recommendation API, including future sessions today and fallback sports, excluding closures, events, tournament conflicts and inactive facilities.
- Web and mobile reports accept date ranges and show gross receipts, completed refunds, pending refunds and net revenue. Utilization uses confirmed/scanned session minutes over eligible published capacity; unpaid holds do not count as confirmed usage. CSV export honours the booking creation-date filter.
- Socket invalidation now covers inventory, promos, recommendations and reports after relevant changes and payment expiry/settlement/refunds. Shared web subscriptions refresh on reconnect and remove only their own handlers. Mobile slots reload venue details and availability after reconnect.

## Business rules

- Rental price is **daily rate × units × calendar days**, inclusive of collection and return dates, in Pakistan time. `pricePerSlot` remains the existing database/API field name but is labelled as the daily equipment rate in the new UI. Rentals are limited to 90 days.
- Paid rentals begin as `PENDING_PAYMENT`, holding stock for 30 minutes. Cash confirmation or verified provider settlement confirms the rental atomically with payment. Free rentals confirm immediately. Expired holds release stock; late provider success queues a refund and cannot resurrect the rental.
- Capacity checks lock the equipment row and use peak overlapping demand, allowing non-overlapping rentals to reuse stock. Overdue confirmed rentals remain reserved until returned. Existing live reservations prevent stock reductions or relocation through the inventory editor.
- Customers can cancel confirmed rentals before collection day and pending rentals before confirmation. Staff handles collection-day changes. Paid cancellations queue a full refund; cash refunds require the existing explicit staff receipt workflow. Only staff can record a return, once, on/after collection day. Damaged units leave rentable stock and require inspection notes; no automatic damage charge is imposed.
- Promo codes are trimmed and normalized to uppercase. Default per-customer limit is one; administrators set the limit. Limits are checked under the promo row lock. Cancellation and payment expiry restore both global and customer allowances exactly once. Rescheduling keeps the existing booking/promo allowance.
- Membership and promo discounts are rounded to currency precision. Membership savings apply first, minimum order value uses the original venue price, and promo savings cannot exceed the remaining price.
- Financial report dates use payment `paidAt` and completed refund timestamps. Pending/failed refunds remain liabilities and do not reduce recognized receipts until completion. Duplicate provider captures/refunds are accounted for separately. Pakistan date filters use an exclusive upper bound at the next midnight.
- Booking counts/CSV use booking creation dates; utilization uses session dates. Customer count is cumulative through the selected end date; top spenders use net cash flow in the selected interval. These measures intentionally have different date meanings, explained in the UI.

## Verification

| Check | Result |
| --- | --- |
| Backend Jest | 84 tests passed, 11 suites |
| Flutter full regression suite | 43 tests passed |
| Flutter analyzer | No issues |
| New mobile screen tests | Venue specifications/navigation, rental price preview/quantity validation, exhausted offers and retry recovery passed |
| Web production build | Passed |
| Web session and reconnect tests | 3 passed |
| Web lint | No errors; warnings remain |
| New isolated MySQL acceptance script | Passed |
| Existing checklist acceptance | 9 groups passed |
| Existing feature acceptance | 6 groups passed |
| Browser inspection | Equipment filters at narrow width, desktop inventory editor, promo management, report date persistence and venue landing-page navigation verified |
| Diff whitespace check | Passed |

The new database acceptance checks exercise inventory races, duration pricing, authorization, expiry, late provider settlement, cash refund accounting, repeat/damaged returns, normalized codes, concurrent per-customer limits, capped fixed discounts, cancellation/expiry promo reversal and report validation. Disposable records are removed afterward. Provider settlement is simulated and Firebase delivery disabled in acceptance scripts.

The migration `20261029000000_inventory_and_promos` was applied successfully to the existing isolated local demo database, `127.0.0.1:3307/smart_sports_hub_demo`. It preserves legacy equipment as shared inventory, converts unpaid confirmed rentals into expiring holds, and backfills legacy receipt timestamps from payment `updatedAt`; historic receipt dates therefore reflect the best timestamp previously available.

Actual venue equipment specifications and venue assignments require staff entry. Missing values remain visibly unspecified. Live Stripe charges/refunds and a fresh physical Android-device run were not performed. No production database or deployment was changed.

Run the new database checks with `node scripts/agenda-acceptance.js` in `backend`; the script refuses production and any database other than the isolated demo. Raw new acceptance/backend/web results are saved in adjacent `agenda-*.log` files.
