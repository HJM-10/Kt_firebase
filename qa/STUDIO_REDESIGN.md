# Arena Desk web admin revision

Implemented the selected boards in `design-concepts/react-admin`: Arena Desk overview, Matchday Workspace, Ledger Console and Venue & Gear Studio. The sidebar remains white in both themes. The final readability revision increases body text to 18px, navigation and primary controls to 17px, standard input height to 50px, equipment titles to 22px, and table text to 15–16px. Layouts stack when larger text needs more room; narrow tables scroll within their panels.

## Implemented behavior

- Overview: venue photos, four-hour court timeline, date/venue controls, arrivals and attention queues backed by actual API data.
- Schedule: day agenda, booking search/status filters, selected booking details, court timeline toggle, venue-aware walk-in and session publication dialogs.
- Ledger: gross/completed refund/net figures, separate pending refund banner, monthly net revenue chart, date/status/method/search filters, pagination, invoices and filtered CSV export with spreadsheet formula escaping. Refund and payment confirmations retain their existing safeguards.
- Venue & gear: inventory, overview, rental desk and offer navigation; six product illustrations; material, size and ball specifications; dated stock availability; inventory pagination; return inspection review.
- Club management: expandable navigation, searchable member directory, role/status filters and summary cards.

## Local sample data and assets

Run from `backend`: `node scripts/seed-arena-preview.js`, then `node scripts/seed-studio-preview.js`. The studio script only accepts the isolated local demo database, is additive and repeatable, and creates simulated equipment/rentals/payments. Pending holds expire normally. It does not revive expired transactions or process real payments. Runtime database files and credentials remain ignored.

The integration run verified six equipment types, 58 matching sample rental/payment records, six revenue months, image delivery, pricing, venue associations, ball specifications and report arithmetic. See [integration results](studio-integration-results.json). Product assets and exact generation prompts are in [asset documentation](../frontend_web/public/gear/README.md) and [prompts](../frontend_web/public/gear/prompts.json).

## Verification

- Web: 16 tests passed; production build passed. Lint reports warnings but no errors.
- Backend: 108 tests across 14 suites passed.
- Real local API/database integration passed, including unchanged counts on consecutive seed runs.
- Browser: light/dark themes, schedule filters/view switch, venue-aware booking dialog, ledger dates/pagination/invoice/CSV download/refund review, inventory search/category/pagination/return review, member search/role filters. No financial or role changes were submitted during browser checks.
- After the final size increase, all four major pages loaded real rows/cards at 390px and 320px without document-level horizontal overflow. See [viewport checks](studio/viewport-checks.json). Desktop ledger table verified fully visible at 1440px.
- Browser console error log: zero errors during final preview capture.

Actual browser captures: [overview](studio/arena-desk-enlarged.jpg), [schedule](studio/matchday-light.jpg), [gear](studio/gear-studio-light.jpg), [ledger](studio/ledger-light.jpg). Matching dark theme captures are in the same folder. Full-page captures are taller than the viewport and may appear reduced in document viewers.

Before editing, the requested checkpoint was pushed to KT_SportM main at `096c7df05cbbc90a8232eba6561881b8fd421ccf` and Kt_firebase main at `571ee5b11892534fd7c87fac046248fc34fa2208`. Final publication preserves each repository's existing history with matching project trees.
