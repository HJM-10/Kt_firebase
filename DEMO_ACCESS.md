# Local demo access

Created 16 October 2026. Both apps use the real Node API, JWT authentication and an isolated local MariaDB database compatible with the project's MySQL schema. Firebase remains the optional push-notification integration.

| Preview | Signed-in role | Email | Demo password |
|---|---|---|---|
| http://localhost:5173 | Flutter customer | user@smartsportshub.com | customer123 |
| http://localhost:5174 | React administrator | admin@smartsportshub.com | admin123 |

Either account can be used in either client. Flutter deliberately signs out on app startup, so a page reload may require signing in again. These published credentials are only for this local demo.

Data includes 8 sports, 8 venues, 168 slots across the next week, one confirmed sample booking, one unpaid sample booking, a tournament/match, an event, equipment, a basic membership, a promo code, a notification and a support request. The paid record is simulated seed data; no real money was collected. Payment-provider keys and Firebase are not enabled.

## Running services

- MariaDB listens only on 127.0.0.1:3307; database name: smart_sports_hub_demo.
- API listens only on 127.0.0.1:5000 through backend/scripts/demo-server.js.
- Flutter preview: localhost:5173.
- React preview: localhost:5174.

Data persists in .local-demo/data. Private local credentials/configuration and downloaded database binaries are ignored by Git. backend/.env contains the private local connection settings. No Windows service was installed.

## Restart after closing the servers

Use four terminals. From the project root, start the database:

```powershell
& ./.local-demo/mariadb-11.4.12-winx64/bin/mariadbd.exe --defaults-file=D:/python/project/kt_ssh/.local-demo/data/my.ini --console
```

From backend, start the API:

```powershell
node scripts/demo-server.js
```

From frontend_mobile:

```powershell
flutter run -d web-server --web-hostname localhost --web-port 5173 --no-pub
```

From frontend_web:

```powershell
npm run dev -- --host localhost --port 5174 --strictPort
```

Do not start a second copy when a service is already running. Database client generation and the four existing migrations were completed for this demo. backend/scripts/seed-demo.js is restricted to this exact local database and can add missing demo records without resetting existing accounts/bookings. It is not a production seed or a reset tool.

Verified in this session: migration deployment, demo seeding, real customer/admin browser login, successful dashboard API reads and visible dashboard values in both applications. This does not replace full feature, Android-device or payment testing.

Portable MariaDB was obtained from the [official 11.4.12 Windows package listing](https://dlm.mariadb.com/browse/mariadb_server/300/2501/winx64-packages/), and its SHA-256 matched the vendor's checksum file.
