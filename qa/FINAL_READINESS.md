# Venue location and system readiness — 29 October 2026

## Delivered locally

- Web and Flutter admin venue editors: address/gate instructions, interactive entrance-pin picker, editable coordinates, clear pin, server-side coordinate-pair/range validation. Existing venues are left without invented locations. Coordinates omitted during an update remain unchanged.
- Web and Flutter venue details: embedded entrance map, readable address/coordinates, Google Maps directions action, and honest missing-location state. Google Maps determines the current position or asks for an origin; customer GPS is not stored in this database.
- Google Maps JavaScript and native Android components are available when the existing project's restricted keys are configured. OpenStreetMap is the working local fallback. Native Google Maps rendering with a real key has not been exercised.
- MySQL migration adds venue locations, a unique nullable Firebase UID, a venue/date/start-time slot index and a payment-status/expiry index. Applied successfully to the isolated demo database; production migration has not run.
- Optional verified Firebase account sign-in for web/mobile, secure existing-account linking, customer-only provisioning, short app sessions, Firebase revocation/disabled-user checks, and database-owned role/activation/link enforcement. Existing local sign-in/signup remains available. A read-only check identified the existing project `kt-sports-hub` but returned `auth/configuration-not-found`; live sign-in remains blocked by project configuration. No accounts were changed. Mocked policy tests pass.
- Readiness endpoint validates MySQL, configured Redis and live-update subscription. Shared Redis pub/sub and login-rate-limit stores support API replicas. Single-process mode needs no Redis.
- Web offline message, labelled location fields, loading/errors, accessible directions action, editor keyboard focus/Escape and duplicate-submit protection.
- Container definitions, HTTPS/sticky-routing gateway, two API process configuration, private managed database/Redis template, CI workflow and deployment/recovery runbook in `deploy/README.md`.
- Android release build requires a private upload keystore; the previous debug-key fallback for release was removed. Private key files are ignored.

## Executed checks

| Check | Result | Evidence |
| --- | --- | --- |
| Backend regression suite | 108 tests, 14 suites passed | `final-backend-tests.log` |
| Web tests | 13 passed | `final-web-tests.log` |
| Web production build | Passed | `final-web-build.log` |
| Web lint | No errors; existing warnings remain | `final-web-lint.log` |
| Flutter tests | 45 passed | `final-flutter-tests.log` |
| Flutter analysis | No issues found | `final-flutter-analyze.log` |
| Android debug APK | Built successfully; incremental rebuild also passed | `final-android-build.log` |
| Existing Firebase Authentication access | `kt-sports-hub`: `auth/configuration-not-found`; configuration pending | `final-firebase-auth-access.log` |
| Backend production dependency audit | 0 vulnerabilities reported | `final-backend-audit.log` |
| Web dependency audit after compatible fixes | 0 vulnerabilities reported | installer audit result; lockfile updated |
| Deployment and workflow YAML | Both parsed with js-yaml | local validation |
| Location migration | Applied to isolated MariaDB | Prisma migration deploy |
| Browser admin journey | Click map -> coordinates -> create demo venue -> view saved map/directions | `location/venue-location-desktop.png` |
| Responsive location page | document width <= viewport at 320 and 390 px | browser DOM measurements |
| Compact admin editor | Fits 320 px; Escape closes and returns focus to Edit | browser interaction |
| Load/integrity test | Passed, fixture cleanup complete | `load-integrity-results.json`, `load-integrity.log` |

Compatible dependency fixes were applied without forcing major changes. The full backend development audit still reports 5 low-severity advisories through Jest/deepmerge; the suggested force fix downgrades Jest across major versions and was not applied. No production advisories remained at this check.

## Measured local load

Real HTTP requests through the actual Express authentication/controllers and local MariaDB, one API process, demo dataset. These are a short local ramp, not a long soak or hosted capacity guarantee.

| Concurrent clients | Requests | Errors | Throughput req/s | p95 ms |
| --- | --- | --- | --- | --- |
| 1 | 100 | 0 | 127.6 | 10.5 |
| 10 | 300 | 0 | 356.7 | 42.3 |
| 40 | 600 | 0 | 362.4 | 130.1 |

Thirty simultaneous requests for the same session produced exactly one active hold and 29 conflicts. Twenty simultaneous one-unit rental requests for three units produced exactly three holds and 17 conflicts. There were no duplicate active bookings or oversold units. Four corresponding pending payments summed to exactly PKR 175. The script checked map persistence, unauthorized customer updates, invalid pins, omitted location updates, explicit clearing and removed its own fixtures afterward.

The browser demo created one clearly labelled `Map Preview Court (sample pin)` in the isolated demo database. Its coordinates are illustrative and are explicitly not a real court location. No actual venue address/GPS was inferred. No live payment/refund, Firebase account change or production database operation was performed.

## Still requires the existing hosting/Cloud configuration

1. Identify the provider/domain and confirm whether the existing `kt-sports-hub` project should also host Maps; configure restricted web and Android Maps keys, project billing/API access and real venue entrance pins. Current local maps use the fallback, not the unconfigured Google API.
2. Initialize/configure Authentication in the existing Firebase project, enable Email/Password and provide verified test accounts; run live sign-in/linking/revocation/outage checks before enabling optional Firebase authentication. The read-only access check returned `auth/configuration-not-found`. Firebase signup/migration of existing local accounts is not automatic.
3. Deploy and validate HTTPS, migrations, cross-replica Redis updates/shared limits, load-balancer failover, monitoring and alerts against the actual hosting. Redis integration currently has unit coverage; live multi-instance/Redis failover and Docker builds were not run locally because Docker/Redis are unavailable.
4. Enable managed database backups/PITR and carry out an isolated restore drill. Multi-zone/host availability depends on the provider; two local containers alone do not supply it.
5. Supply the existing upload keystore for a signed release. Test map taps, navigation app handoff, GPS denied/unavailable, offline/reconnect, permissions and accessibility on physical Android devices.
6. Run a representative mixed-traffic staging load/soak test with realistic data volume and record resource usage before setting capacity/availability commitments.

CI configuration was added, but no GitHub Actions run or production rollout was triggered in this task. The user requested the original-documentation acceptance pass after these changes; that comparison has not been represented as complete.
