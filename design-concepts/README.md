# Clubhouse UI implementation

The approved direction is forest green, warm cream, muted brass, and deep pine dark surfaces. The design is implemented in the Flutter customer app; the separate React website is outside this change.

## What changed

- Discover uses live sports and venue records, photo-led cards, next-booking information and recommendations. All eight demo sports and dynamically added sports remain accessible.
- The customer navigation now has Discover, Bookings and Profile. Tournaments, matches, events, equipment, memberships and support remain available from Discover; payments are available from Profile.
- Venue and session screens share the new imagery and typography. Session selection shows availability, the actual slot duration, a price summary and a deliberate reservation action. Rescheduling, promotions, server pricing and checkout use the existing API.
- Login, signup, booking history and profile/appearance follow the new design. Light, dark and system preferences persist locally. Typography uses platform/bundled Flutter Roboto rather than fetching Google Fonts at runtime.
- Supporting customer and mobile admin screens inherit the global theme and use matching accents. Confirmation dialogs adapt to the active theme.
- Entrance and date selection animations respect the device's reduced-motion setting.

## Image assets and provenance

The completed catalogue now includes all eight sports. See [the full sports image set and generation prompts](SPORTS_IMAGES.md) for the latest assets, including the refreshed Padel image.

Generated with the built-in image-generation tool, then copied into the Flutter asset bundle:

- `../frontend_mobile/assets/clubhouse/padel.png`
- `../frontend_mobile/assets/clubhouse/football.png`
- `../frontend_mobile/assets/clubhouse/cricket.png`

These images are illustrations of plausible sports facilities, not verified photographs of the named venues. Cards prefer a venue's existing image URL. Bundled image fallbacks are labelled “Illustrative image”; sports without a matching photograph use a court-line illustration and sport icon. Images do not supply prices, ratings, distance, availability or other venue facts.

Final prompt set used for generation (one call per sport):

> Use case: photorealistic-natural. Asset type: landscape 3:2 in-app illustrative sports photograph for Clubhouse / Smart Sports Hub, a Pakistan sports venue booking Flutter app. Create a polished realistic editorial photograph of [SPORT SCENE]. Contemporary Pakistani urban sports club, mature trees, warm dusk floodlights, warm cream highlights and deep natural forest greens, premium welcoming community atmosphere. Physically plausible sporting geometry and equipment, sharp rich photographic textures, eye-level slightly elevated wide composition useful cropped to a wide phone card. No people, no logos, no text, no lettering, no watermarks, no blue or purple color cast. This is illustrative venue imagery, not a photograph of any named real venue. Full bleed image only, no UI, no board, no frame.

SPORT SCENE values:

- Padel: an inviting green padel court with correct net and glass enclosure, foreground net detail
- Football: a beautiful small five-a-side football pitch with white line markings and a goal
- Cricket: a well-kept cricket practice ground with practice nets and a wicket

## Implementation previews

`implementation/` contains rendered Flutter screens in both themes, using labelled test fixture data. These are actual Flutter widget renders, not AI-generated UI mockups. They are separate from the earlier concept boards.

The preview captures are reproducible with:

```powershell
flutter test --no-pub --dart-define=RENDER_CLUBHOUSE=true test/clubhouse_flow_test.dart
```

## Review scope

The new checks cover the main screens in both themes, three-tab navigation, narrow 320px screens with 150% text size and scrolling, API failure presentation, preserving the chosen session date, requiring a time selection, reporting actual duration, creating the intended reservation, and rendering the server's confirmed response. Existing booking-time, error-classification and theme-preference tests are retained.

No live payment was collected and the demo database was not modified by the new tests. Payment providers, production push notifications and full admin acceptance remain separate work.

The debug APK uses `http://127.0.0.1:5000/api`, matching the existing USB-connected demo setup. On a physical Android device, the local API/database must be running and USB port forwarding must be set with `adb reverse tcp:5000 tcp:5000`. This is a development build, not a public deployment.

## Validation — 24 October 2026

- Full Flutter suite: 12 tests passed.
- Dart analysis of `lib` and `test`: no issues found.
- Android debug APK: built successfully at `../frontend_mobile/build/app/outputs/flutter-apk/app-debug.apk`.
- Main screens rendered and inspected in light and dark themes. Narrow-screen checks include 320px width, 150% text size and scrolling through login, signup, discovery, bookings, profile, sports, venues and session selection.
- The reservation check also verifies that two immediate taps create only one reservation.
- The APK was installed on the connected Samsung Galaxy A72 and the new login screen was visually verified. A full on-device acceptance pass remains separate from the automated checks.

Branding update: visible app headings and the Android launcher name now use “KT Smart Sport Hub”. The login and Discover headings are centered horizontally, with balanced controls at the sides.
