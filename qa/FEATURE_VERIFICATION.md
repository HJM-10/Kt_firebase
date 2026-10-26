# Feature verification — 26 October 2026

Destination: https://github.com/HJM-10/Kt_firebase. MySQL remains the database; Firebase is used for Android messaging. No changes are published to the original repository by this workflow.

| Check | Result |
| --- | --- |
| Backend Jest tests | 70 passed across 9 suites |
| Existing MySQL acceptance groups | 9 passed |
| New MySQL feature acceptance groups | 6 passed |
| Web production build | Passed |
| Web session regression tests | 2 passed |
| Web lint | No errors; existing warnings remain |
| Flutter analyzer | No issues |
| Flutter tests | 39 passed |
| Firebase-enabled Android debug APK | Built and installed on connected Samsung SM-A725F |
| Firebase credential/API validation | Passed against `kt-sports-hub`; dry run only |
| Customer web screens | Demo account login, membership options, inbox, and administrator payment controls opened successfully |
| Device foreground/background push display | Passed: user confirmed foreground banner, Android background notification, and tapping to open the inbox |
| Live Stripe payment/refund | Deferred by user; credentials are not configured |

The isolated MySQL database accepted the membership-history migration. New acceptance checks cover concurrent purchase retries, cash activation, expiry, annual renewal, stable card numbers, upgrade settlement, duplicate settlement, admin reconciliation, downgrade safeguards, abandoned request expiry, review eligibility and moderation, complaint response-only notifications, inbox ownership/read status, invalid pagination, token registration/removal, and invoice access. Existing checks cover refund retry/idempotence and booking/registration expiry and races. Online provider interactions in acceptance tests are simulated; no money moves.

FCM credential validation initially failed because the computer clock was five hours behind Google's. After synchronization, the dry run passed. The private service account and Android client configuration are ignored by Git and are not included in this repository. They must be supplied separately when deploying/building.

QR entry-window boundaries, one-use check-in, stale/expired/cancelled passes and owner/admin access pass backend tests. Flutter QR/check-in screens pass the widget suite. Physical camera scanning has not been re-tested during this run.

All three test messages were subsequently marked read in MySQL after opening the inbox.

FCM accepted foreground test #96 and background tests #97/#98. The user confirmed the grey foreground banner, the background system notification, and opening the Notifications screen by tapping the resent notification.

Raw build and automated test results are in the adjacent `features-*.log` files. The APK is a debug build for local verification, using USB forwarding to the local API; it is not a production deployment.
