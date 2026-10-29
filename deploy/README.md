# Deployment and availability

This repository now contains deployment configuration; it has not been deployed to the existing hosting account. The provider/domain still need to be identified. The local Firebase credentials identify `kt-sports-hub`; a read-only Auth check returned `auth/configuration-not-found`, so Authentication setup remains pending. Confirm whether Maps uses that same Cloud project. Do not treat a local load test as a production capacity or availability guarantee.

## Existing hosting

Use the supplied API and web Dockerfiles with your provider's container hosting, private managed MySQL and managed Redis. The API runs as an unprivileged user. Keep the API/database private behind the HTTPS gateway. Supply secrets through the provider's secret manager; never commit `.env.production`, service-account files or upload keys.

For a Docker-capable host, copy `.env.production.example` to `.env.production`, fill the existing resource names, then run from this directory:

```sh
docker compose --env-file .env.production build
docker compose --env-file .env.production run --rm api_a npx prisma migrate deploy
docker compose --env-file .env.production up -d
```

Take a database snapshot before applying migrations. The location migration is additive. Roll back application images without dropping the new columns. MySQL DDL is not an all-or-nothing transaction: inspect migration status before retrying a failed migration.

Caddy obtains/renews HTTPS certificates for the configured real domain (DNS must resolve to the host; ports 80/443 must be reachable). `/api/ready` checks the database, Redis connection when configured and live-update subscription. `/api/health` checks process liveness. Caddy uses readiness checks and sticky routing for Socket.IO polling. The two API containers share login limits and live updates through Redis. Do not run multiple instances without Redis. Do not publicly expose database/Redis ports.

The supplied Compose layout survives one API process failing; it remains a single-host deployment. For host/zone high availability, place API instances across zones behind the existing provider's managed load balancer, use zone-redundant MySQL/Redis, maintain sticky sessions, and deploy the web build to redundant static hosting/CDN. Set `TRUST_PROXY_HOPS` to the actual trusted proxy count, limit direct API ingress and configure the existing provider's real-IP forwarding. Database connection limits apply per API instance, so reserve capacity for migrations, backups and recovery.

## Backups, monitoring and recovery

Enable managed MySQL automated daily backups and point-in-time recovery on the existing provider. Suggested initial target: 7 days retention, RPO <=15 minutes and RTO <=60 minutes; these are targets to validate with the owner, not measured results. Encrypt backups and restrict restore access. Schedule a weekly restore into a separate private database; verify migration status, user/venue counts, booking/payment relationships and a customer/admin read journey. Record restore duration and recovery point. A backup is not verified until this restore drill succeeds.

Configure external checks for HTTPS `/api/ready` every minute from more than one location. Alert on failures, elevated 5xx rate, API p95 latency, database CPU/connections/lock waits/storage, Redis disconnects/evictions and refund backlog. Keep logs centralized with retention and redact authorization headers, passwords, tokens and payment payloads. The app only logs request method/path/status/duration. Test recovery by stopping one API replica during read traffic, reconnecting clients to the other, and restoring the stopped replica. Repeat for managed database/Redis failover in a staging environment. Docker builds, certificate issuance and hosted failover have not been executed on this Windows machine (Docker is unavailable).

## Venue maps and directions

The migration stores optional `address`, `latitude` and `longitude`. Staff can tap/click an entrance point or enter coordinates. No coordinates are fabricated for existing venues. Both coordinates are validated and cleared together; an edit omitting them preserves the current pin. Customers see a location card and a Google Maps directions button only when the pin is valid. Google Maps chooses the current location or asks for a starting point; the app does not collect or store customers' GPS locations. GPS denied/unavailable must be checked on a physical device.

For web Google maps, enable **Maps JavaScript API** in the existing Cloud project and configure `VITE_GOOGLE_MAPS_API_KEY` with HTTP-referrer restrictions for the deployed domain and local preview as needed. Configure a production map ID in `VITE_GOOGLE_MAPS_MAP_ID`. Keys are build-time public client configuration, so restrict APIs/referrers and set usage budgets.

For Android, enable **Maps SDK for Android**, restrict a separate key to the existing package name and signing certificate SHA-1, set `GOOGLE_MAPS_ANDROID_API_KEY` in the build environment and build with `--dart-define=GOOGLE_MAPS_ENABLED=true`. Android manifest injection reads that environment variable. The repository currently contains Android/web/Windows clients, not an iOS target. For Flutter web with Google maps, add the key-restricted Google script to the deployed host's `web/index.html` as required by the plugin before enabling the flag; default web/mobile builds use OpenStreetMap.

Without Google keys, Leaflet/flutter_map provides an OpenStreetMap entrance picker and Google directions still works without an API key. Attribution is visible. Public OSM tiles have no service-level guarantee; for production scale configure a licensed tile provider using `VITE_MAP_TILE_URL`/`VITE_MAP_ATTRIBUTION` (web) and `MAP_TILE_URL`/`MAP_ATTRIBUTION` Dart defines, or enable your Google maps. Never load Google tiles through Leaflet/flutter_map.

## Firebase sign-in

The existing local sign-in remains available. Enable Email/Password in the existing Firebase project, set `FIREBASE_AUTH_ENABLED=true`, `FIREBASE_PROJECT_ID`, `FIREBASE_WEB_API_KEY` and application-default admin credentials on the server. Firebase notifications remain controlled separately by `FIREBASE_ENABLED`.

Web shows a Firebase option when `/api/auth/providers` advertises configured sign-in. Mobile shows it when built with `--dart-define=FIREBASE_AUTH_ENABLED=true`; it checks provider availability when used. This option signs in **existing verified Firebase users**. The current Sign up screen continues to create local accounts. Provision Firebase accounts/verification through the existing Firebase project before using Firebase sign-in. No existing accounts are migrated automatically.

The server verifies Firebase ID tokens including revocation, rejects unverified emails, gives new identities CUSTOMER access, and requires the current local password before linking an existing email. It does not infer admin access from Firebase claims. Linked app sessions last one hour and recheck disabled/revoked Firebase users on requests; local account activation/role and UID link are checked from MySQL. A Firebase outage returns 503 and retains the client session for retry. Test one verified customer, one existing staff link, unverified/disabled/revoked users and outage recovery against the actual project before enabling for production. The existing credentials were checked read-only; `auth/configuration-not-found` prevented live identity validation. No users were created or changed.

## Android release signing

Release builds now require the private upload keystore instead of using the debug key. Create `frontend_mobile/android/key.properties` locally:

```properties
storeFile=C:/private/path/upload-keystore.jks
storePassword=YOUR_PRIVATE_STORE_PASSWORD
keyAlias=upload
keyPassword=YOUR_PRIVATE_KEY_PASSWORD
```

Back up the upload keystore securely. Keep the existing application ID/signing identity when updating a published app. Supply the Maps key and release defines, then build an app bundle. A missing signing file stops a release build with a clear error; debug builds still work. Upload-key creation, Play Console upload and physical-device acceptance are owner/device steps that remain unverified.

## Checks

`backend/npm test`, `frontend_web/npm test`, `frontend_web/npm run build`, `frontend_mobile/flutter analyze`, and `frontend_mobile/flutter test` cover regressions. Run `npm run test:load` from backend only against the isolated demo database at 127.0.0.1:3307/smart_sports_hub_demo. It creates and removes its own fixtures, measures authenticated HTTP reads and verifies slot/rental contention and payment totals. It refuses production/non-demo database targets. `qa/load-integrity-results.json` records measured results and environment. Re-run representative mixed traffic and a longer soak on staging infrastructure before promising a user capacity figure.

References: [Google Maps directions URLs](https://developers.google.com/maps/documentation/urls/get-started), [Google map events](https://developers.google.com/maps/documentation/javascript/events), [Firebase token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens), [Firebase REST sign-in](https://firebase.google.com/docs/reference/rest/auth), [Socket.IO Redis/sticky routing](https://socket.io/docs/v4/redis-adapter/), [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/).
