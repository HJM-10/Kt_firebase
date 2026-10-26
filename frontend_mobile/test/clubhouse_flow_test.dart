import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:smart_sports_hub/main.dart';
import 'package:smart_sports_hub/providers/auth_provider.dart';
import 'package:smart_sports_hub/providers/theme_provider.dart';
import 'package:smart_sports_hub/services/api_service.dart';
import 'package:smart_sports_hub/screens/login_screen.dart';
import 'package:smart_sports_hub/screens/signup_screen.dart';
import 'package:smart_sports_hub/screens/slots_screen.dart';
import 'package:smart_sports_hub/screens/sports_screen.dart';
import 'package:smart_sports_hub/screens/venues_screen.dart';
import 'package:smart_sports_hub/screens/my_bookings_screen.dart';
import 'package:smart_sports_hub/screens/settings_screen.dart';

class _Auth extends AuthProvider {
  @override
  Map<String, dynamic> get user => {
        'name': 'Ayesha Khan',
        'email': 'ayesha@example.com',
        'role': 'CUSTOMER'
      };
}

class _Fixtures implements HttpClientAdapter {
  final List<RequestOptions> requests = [];
  bool reserved = false, fail = false;
  final day = DateTime.now().add(const Duration(days: 2));
  String get date => day.toIso8601String().split('T').first;
  Map<String, dynamic> get venue => {
        'id': 1,
        'name': 'Model Town Arena',
        'description': 'A little time outdoors. A great game together.',
        'pricePerSlot': 2000,
        'sport': {'id': 1, 'name': 'Padel', 'icon': 'Target'}
      };
  List<Map<String, dynamic>> get slots => [
        {
          'id': 10,
          'venueId': 1,
          'date': date,
          'startTime': '17:00',
          'endTime': '18:30',
          'isBooked': reserved
        },
        {
          'id': 11,
          'venueId': 1,
          'date': date,
          'startTime': '19:00',
          'endTime': '20:00',
          'isBooked': true
        },
      ];
  @override
  Future<ResponseBody> fetch(RequestOptions options,
      Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    requests.add(options);
    if (fail) {
      return ResponseBody.fromString(
          '{"message":"Temporarily unavailable"}', 503,
          headers: {
            Headers.contentTypeHeader: [Headers.jsonContentType]
          });
    }
    dynamic data;
    switch (options.path) {
      case '/sports':
        data = [
          'Padel',
          'Football',
          'Cricket',
          'Swimming',
          'Basketball',
          'Chess',
          'Hockey',
          'Polo'
        ]
            .asMap()
            .entries
            .map((e) => {
                  'id': e.key + 1,
                  'name': e.value,
                  '_count': {'venues': 2}
                })
            .toList();
        break;
      case '/venues':
        data = [
          venue,
          {
            ...venue,
            'id': 2,
            'name': 'Community Football Ground',
            'sport': {'name': 'Football'}
          }
        ];
        break;
      case '/venues/1':
        data = venue;
        break;
      case '/recommendations/slots':
        data = [
          {...slots.first, 'venue': venue}
        ];
        break;
      case '/bookings/slots':
        data = slots;
        break;
      case '/bookings/my':
        data = [
          {
            'id': 42,
            'status': 'CONFIRMED',
            'finalPrice': 2000,
            'slot': {...slots.first, 'venue': venue}
          }
        ];
        break;
      case '/bookings':
        reserved = true;
        data = {'id': 43, 'status': 'CONFIRMED', 'finalPrice': 0};
        break;
      default:
        data = <String, dynamic>{};
    }
    return ResponseBody.fromString(
        jsonEncode({'success': true, 'data': data}), 200,
        headers: {
          Headers.contentTypeHeader: [Headers.jsonContentType]
        });
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late _Fixtures fixtures;
  late _Auth auth;
  late ThemeProvider theme;
  final boundaryKey = GlobalKey();
  setUpAll(() async {
    // Load the SDK's licensed Roboto fonts for readable implementation captures.
    final configFile = File('.dart_tool/package_config.json').absolute;
    final packages =
        (jsonDecode(configFile.readAsStringSync())['packages'] as List);
    final flutter = packages.firstWhere((p) => p['name'] == 'flutter');
    final packageRoot = configFile.uri.resolve('${flutter['rootUri']}/');
    for (final entry in {
      'roboto-regular.ttf': 'Roboto',
      'roboto-bold.ttf': 'Roboto',
      'roboto-black.ttf': 'Roboto',
      'materialicons-regular.otf': 'MaterialIcons',
    }.entries) {
      final font = File.fromUri(packageRoot
          .resolve('../../bin/cache/artifacts/material_fonts/${entry.key}'));
      final loader = FontLoader(entry.value)
        ..addFont(Future.value(ByteData.sublistView(font.readAsBytesSync())));
      await loader.load();
    }
  });
  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
    SharedPreferences.setMockInitialValues({});
    fixtures = _Fixtures();
    ApiService().socket.disconnect();
    ApiService().dio.httpClientAdapter = fixtures;
    auth = _Auth();
    theme = ThemeProvider();
  });
  tearDown(() {
    auth.dispose();
    theme.dispose();
  });

  Future<void> mount(WidgetTester tester, Widget screen,
      {Brightness brightness = Brightness.light,
      Size size = const Size(390, 844),
      double scale = 1}) async {
    tester.view.physicalSize = size;
    tester.view.devicePixelRatio = 1;
    await tester.pumpWidget(const SizedBox());
    await tester.pumpWidget(MultiProvider(
        providers: [
          ChangeNotifierProvider<AuthProvider>.value(value: auth),
          ChangeNotifierProvider.value(value: theme)
        ],
        child: RepaintBoundary(
            key: boundaryKey,
            child: MaterialApp(
                debugShowCheckedModeBanner: false,
                theme: ThemeProvider.lightTheme,
                darkTheme: ThemeProvider.darkTheme,
                themeMode: brightness == Brightness.dark
                    ? ThemeMode.dark
                    : ThemeMode.light,
                builder: (context, child) => MediaQuery(
                    data: MediaQuery.of(context)
                        .copyWith(textScaler: TextScaler.linear(scale)),
                    child: child!),
                routes: {
                  '/sports': (_) => const SportsScreen(),
                  '/tournaments': (_) =>
                      const Scaffold(body: Text('Tournaments')),
                  '/matches': (_) => const Scaffold(body: Text('Matches')),
                  '/signup': (_) => const SignupScreen()
                },
                home: screen))));
    await tester.pumpAndSettle();
  }

  Future<void> capture(WidgetTester tester, String name) async {
    if (!const bool.fromEnvironment('RENDER_CLUBHOUSE')) return;
    await tester.runAsync(() async {
      for (final sport in [
        'padel-v2',
        'football',
        'cricket',
        'basketball',
        'chess',
        'hockey',
        'polo',
        'swimming'
      ]) {
        await precacheImage(
            ResizeImage(AssetImage('assets/clubhouse/$sport.png'), width: 1000),
            boundaryKey.currentContext!);
      }
    });
    await tester.pumpAndSettle();
    await tester.runAsync(() async {
      final boundary = boundaryKey.currentContext!.findRenderObject()!
          as RenderRepaintBoundary;
      final image = await boundary.toImage(pixelRatio: 2);
      final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
      final file = File('../design-concepts/implementation/$name.png');
      await file.parent.create(recursive: true);
      await file.writeAsBytes(bytes!.buffer.asUint8List());
      image.dispose();
    });
  }

  for (final brightness in Brightness.values) {
    testWidgets(
        'Main screens render and navigation works in ${brightness.name}',
        (tester) async {
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await mount(tester, const MainLayout(), brightness: brightness);
      expect(find.text('Find your next game.'), findsOneWidget);
      await capture(tester, 'discover-${brightness.name}');
      await tester.tap(find.text('Bookings').last);
      await tester.pumpAndSettle();
      expect(find.text('Show QR'), findsOneWidget);
      await capture(tester, 'bookings-${brightness.name}');
      await tester.tap(find.text('Profile').last);
      await tester.pumpAndSettle();
      expect(find.text('Your appearance'), findsOneWidget);
      await capture(tester, 'profile-${brightness.name}');
      await mount(
          tester,
          SlotsScreen(
              venueId: 1,
              initialDate: fixtures.day,
              initialVenue: fixtures.venue),
          brightness: brightness);
      await capture(tester, 'session-${brightness.name}');
      await mount(tester, const LoginScreen(), brightness: brightness);
      await capture(tester, 'login-${brightness.name}');
      await mount(tester, const SportsScreen(), brightness: brightness);
      await capture(tester, 'sports-${brightness.name}');
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    });
  }

  testWidgets(
      'Reservation requires a selection, preserves date and honours server status',
      (tester) async {
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await mount(
        tester,
        SlotsScreen(
            venueId: 1,
            initialDate: fixtures.day,
            initialVenue: fixtures.venue));
    expect(
        tester
            .widget<ElevatedButton>(find.byKey(const Key('reserve-session')))
            .onPressed,
        isNull);
    expect(
        fixtures.requests
            .lastWhere((r) => r.path == '/bookings/slots')
            .queryParameters['date'],
        fixtures.date);
    await tester.ensureVisible(find.text('Available').last);
    await tester.tap(find.text('Available').last);
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('90 minutes'));
    expect(find.text('90 minutes'), findsOneWidget);
    await capture(tester, 'session-selected-light');
    await tester.tap(find.text('Reserve session'));
    await tester.tap(find.text('Reserve session'));
    await tester.pumpAndSettle();
    expect(find.text('You’re all booked.'), findsOneWidget);
    expect(
        fixtures.requests
            .where((r) => r.path == '/bookings' && r.method == 'POST')
            .length,
        1);
    expect(
        fixtures.requests
            .lastWhere((r) => r.path == '/bookings')
            .data['slotId'],
        10);
    await capture(tester, 'confirmation-light');
    await tester.tap(find.text('Done'));
    await tester.pumpAndSettle();
    expect(find.text('Reserve session'), findsNothing);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('Compact screens support larger text without layout exceptions',
      (tester) async {
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    for (final screen in [
      const LoginScreen(),
      const SignupScreen(),
      const MainLayout(),
      const MyBookingsScreen(),
      const SettingsScreen(),
      const SportsScreen(),
      const VenuesScreen(sportId: 1, sportName: 'Padel'),
      SlotsScreen(
          venueId: 1, initialDate: fixtures.day, initialVenue: fixtures.venue)
    ]) {
      await mount(tester, screen, size: const Size(320, 640), scale: 1.5);
      expect(tester.takeException(), isNull);
      for (var step = 0; step < 6; step++) {
        await tester.drag(find.byType(Scrollable).first, const Offset(0, -350));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
      }
    }
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('Failed discovery requests offer retry and do not invent venues',
      (tester) async {
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    fixtures.fail = true;
    await mount(tester, const MainLayout());
    expect(find.text('Courts could not load'), findsOneWidget);
    expect(find.text('Model Town Arena'), findsNothing);
    await tester.pumpWidget(const SizedBox());
  });
}
