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
import 'package:smart_sports_hub/providers/auth_provider.dart';
import 'package:smart_sports_hub/providers/theme_provider.dart';
import 'package:smart_sports_hub/services/api_service.dart';
import 'package:smart_sports_hub/screens/admin_dashboard_screen.dart';
import 'package:smart_sports_hub/screens/admin/walk_in_screen.dart';
import 'package:smart_sports_hub/screens/admin/venue_editor.dart';
import 'package:smart_sports_hub/utils/arena_desk.dart';

class _Admin extends AuthProvider {
  @override
  Map<String, dynamic> get user =>
      {'id': 1, 'name': 'Ayesha Khan', 'role': 'ADMIN'};
}

class _DeskApi implements HttpClientAdapter {
  bool fail = false, paid = false, checkedIn = false;
  final requests = <RequestOptions>[];
  List<Map<String, dynamic>> get sports => [
        {'id': 1, 'name': 'Padel', 'isActive': true},
        {'id': 2, 'name': 'Basketball', 'isActive': true},
        {'id': 3, 'name': 'Swimming', 'isActive': true}
      ];
  List<Map<String, dynamic>> venues(String date) => [
        {
          'id': 1,
          'sportId': 1,
          'name': 'Padel Court 01',
          'sport': sports[0],
          'isActive': true,
          'capacity': 4,
          'pricePerSlot': 2000,
          'slots': [
            {
              'id': 10,
              'venueId': 1,
              'date': date,
              'startTime': '18:00',
              'endTime': '19:00',
              'isBooked': true,
              'bookings': [
                {
                  'id': 21,
                  'status': checkedIn ? 'SCANNED' : 'CONFIRMED',
                  'user': {'name': 'Ali Khan', 'phone': '03001234567'},
                  'finalPrice': 2000,
                  'payment': {'id': 31, 'status': 'PAID', 'amount': 2000}
                }
              ]
            },
            {
              'id': 11,
              'venueId': 1,
              'date': date,
              'startTime': '19:00',
              'endTime': '20:30',
              'isBooked': false,
              'bookings': []
            },
          ]
        },
        {
          'id': 2,
          'sportId': 2,
          'name': 'Basketball Court 02',
          'sport': sports[1],
          'isActive': true,
          'capacity': 10,
          'pricePerSlot': 1500,
          'slots': [
            {
              'id': 12,
              'venueId': 2,
              'date': date,
              'startTime': '18:00',
              'endTime': '19:00',
              'isBooked': true,
              'bookings': [
                {
                  'id': 22,
                  'status': paid ? 'CONFIRMED' : 'PENDING_PAYMENT',
                  'user': {'name': 'Sara Ahmed'},
                  'finalPrice': 1500,
                  'payment': {
                    'id': 32,
                    'status': paid ? 'PAID' : 'PENDING',
                    'amount': 1500
                  }
                }
              ]
            },
          ]
        },
        {
          'id': 3,
          'sportId': 3,
          'name': 'Community Pool',
          'sport': sports[2],
          'isActive': false,
          'capacity': 12,
          'pricePerSlot': 500,
          'slots': []
        },
      ];
  Map<String, dynamic> snapshot(String date) {
    final v = venues(date);
    final bookings = [
      for (final venue in v)
        for (final slot in arenaMaps(venue['slots']))
          for (final b in arenaMaps(slot['bookings']))
            {
              ...b,
              'slot': {...slot, 'venue': venue}
            }
    ];
    return {
      'date': date,
      'generatedAt': '2026-10-25T12:00:00Z',
      'timezone': 'Asia/Karachi',
      'venues': v,
      'sports': sports,
      'bookings': bookings,
      'summary': {
        'bookings': 2,
        'pendingBookings': paid ? 0 : 1,
        'collected': paid ? 3500 : 2000,
        'paymentCount': paid ? 2 : 1
      }
    };
  }

  @override
  Future<ResponseBody> fetch(RequestOptions options,
      Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    requests.add(options);
    dynamic data;
    if (fail) {
      return ResponseBody.fromString(
          '{"message":"Service temporarily unavailable"}', 503,
          headers: {
            Headers.contentTypeHeader: [Headers.jsonContentType]
          });
    }
    if (options.path == '/reports/arena-desk') {
      data = snapshot(options.queryParameters['date']);
    } else if (options.path == '/bookings/22/confirm') {
      paid = true;
      data = {};
    } else if (options.path == '/bookings/21/qr') {
      data = {'qrToken': 'single-use-entry'};
    } else if (options.path == '/bookings/scan') {
      checkedIn = true;
      data = {'id': 21};
    } else if (options.path == '/bookings/slots') {
      data = [
        {
          'id': 11,
          'venueId': 1,
          'date': options.queryParameters['date'],
          'startTime': '19:00',
          'endTime': '20:30',
          'isBooked': false
        }
      ];
    } else if (options.path == '/bookings' && options.method == 'POST') {
      data = {'id': 99, 'status': 'PENDING_PAYMENT', 'finalPrice': 2000};
    } else if (options.path == '/venues/1' && options.method == 'GET') {
      data = venues('2026-10-25').first;
    } else if (options.path.startsWith('/venues') &&
        ['POST', 'PUT'].contains(options.method)) {
      data = {};
    } else if (options.path == '/payments') {
      data = [];
    } else if (options.path == '/sports') {
      data = sports;
    } else {
      return ResponseBody.fromString('{}', 404, headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType]
      });
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
  late _DeskApi api;
  late _Admin auth;
  late ThemeProvider theme;
  final boundary = GlobalKey();
  final now = DateTime.utc(2026, 10, 25, 12);
  setUpAll(() async {
    final config = File('.dart_tool/package_config.json').absolute;
    final packages = jsonDecode(config.readAsStringSync())['packages'] as List;
    final root = config.uri.resolve(
        '${packages.firstWhere((p) => p['name'] == 'flutter')['rootUri']}/');
    for (final entry in {
      'roboto-regular.ttf': 'Roboto',
      'roboto-bold.ttf': 'Roboto',
      'roboto-black.ttf': 'Roboto',
      'materialicons-regular.otf': 'MaterialIcons'
    }.entries) {
      final font = File.fromUri(root
          .resolve('../../bin/cache/artifacts/material_fonts/${entry.key}'));
      await (FontLoader(entry.value)
            ..addFont(
                Future.value(ByteData.sublistView(font.readAsBytesSync()))))
          .load();
    }
  });
  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
    SharedPreferences.setMockInitialValues({});
    api = _DeskApi();
    ApiService().socket.disconnect();
    ApiService().dio.httpClientAdapter = api;
    auth = _Admin();
    theme = ThemeProvider();
  });
  tearDown(() {
    auth.dispose();
    theme.dispose();
  });
  Future<void> mount(WidgetTester tester,
      {Widget? screen,
      Brightness brightness = Brightness.light,
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
            key: boundary,
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
                home: screen ?? AdminDashboardScreen(now: () => now)))));
    await tester.pumpAndSettle();
  }

  Future<void> shot(WidgetTester tester, String name) async {
    if (!const bool.fromEnvironment('RENDER_ARENA_DESK')) return;
    await tester.runAsync(() async {
      for (final sport in ['padel-v2', 'basketball', 'swimming']) {
        await precacheImage(
            ResizeImage(AssetImage('assets/clubhouse/$sport.png'), width: 1000),
            boundary.currentContext!);
      }
    });
    await tester.pumpAndSettle();
    await tester.runAsync(() async {
      final image = await (boundary.currentContext!.findRenderObject()
              as RenderRepaintBoundary)
          .toImage(pixelRatio: 2);
      final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
      final file = File('../design-concepts/admin/implementation/$name.png');
      await file.parent.create(recursive: true);
      await file.writeAsBytes(bytes!.buffer.asUint8List());
      image.dispose();
    });
  }

  Future<void> close(WidgetTester tester) async {
    await tester.pumpWidget(const SizedBox());
    await tester.pumpAndSettle();
  }

  test(
      'status helpers use Pakistan midnight, published sessions, and real booking states',
      () {
    expect(arenaDate(arenaToday(DateTime.utc(2026, 10, 24, 19))), '2026-10-25');
    final venue = api.venues('2026-10-25').first;
    expect(venueStatus(venue, '2026-10-25', DateTime.utc(2026, 10, 25, 13, 30)),
        'Reserved now');
    expect(
        slotLabel(arenaMaps(venue['slots'])[1], '2026-10-25',
            DateTime.utc(2026, 10, 25, 15)),
        'Past session');
    expect(venueStatus(api.venues('2026-10-25').last, '2026-10-25', now),
        'Inactive');
    expect(venueStatus({...venue, 'slots': []}, '2026-10-25', now),
        'No sessions published');
    expect(
        slotBooking({
          'bookings': [
            {'status': 'CANCELLED'}
          ]
        }),
        isNull);
  });
  for (final brightness in Brightness.values) {
    testWidgets('Arena Desk renders all four tabs in ${brightness.name}',
        (tester) async {
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await mount(tester, brightness: brightness);
      expect(find.text('Arena Desk · Admin'), findsOneWidget);
      expect(api.requests.first.queryParameters['date'], '2026-10-25');
      await shot(tester, 'overview-${brightness.name}');
      await tester.drag(find.byType(ListView).first, const Offset(0, -460));
      await tester.pumpAndSettle();
      await shot(tester, 'overview-activity-${brightness.name}');
      await tester.tap(find.text('Bookings').last);
      await tester.pumpAndSettle();
      expect(find.text('Ali Khan'), findsOneWidget);
      await shot(tester, 'bookings-${brightness.name}');
      await tester.tap(find.text('Courts').last);
      await tester.pumpAndSettle();
      await shot(tester, 'courts-${brightness.name}');
      await tester.drag(find.byType(ListView).first, const Offset(0, -320));
      await tester.pumpAndSettle();
      await shot(tester, 'court-details-${brightness.name}');
      await tester.tap(find.text('More').last);
      await tester.pumpAndSettle();
      expect(find.text('Sports catalogue'), findsOneWidget);
      await shot(tester, 'more-${brightness.name}');
      expect(tester.takeException(), isNull);
      await close(tester);
    });
  }
  testWidgets(
      'Payment and check-in cannot mutate records before explicit confirmation',
      (tester) async {
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await mount(tester,
        screen: AdminDashboardScreen(
            now: () => DateTime.utc(2026, 10, 25, 13, 15)));
    await tester.tap(find.text('Bookings').last);
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Record payment'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Record payment'));
    await tester.pumpAndSettle();
    expect(api.requests.where((r) => r.method == 'PUT'), isEmpty);
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    expect(api.paid, isFalse);
    await tester.tap(find.text('Record payment'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Money received'));
    await tester.pumpAndSettle();
    expect(api.paid, isTrue);
    expect(
        api.requests.singleWhere((r) => r.path == '/bookings/22/confirm').data,
        {'receivedInPerson': true});
    await tester.ensureVisible(find.text('Check in').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Check in').first);
    await tester.pumpAndSettle();
    expect(api.checkedIn, isFalse);
    expect(api.requests.where((r) => r.path == '/bookings/scan'), isEmpty);
    await tester.tap(find.text('Confirm arrival'));
    await tester.pumpAndSettle();
    expect(api.checkedIn, isTrue);
    expect(api.requests.singleWhere((r) => r.path == '/bookings/scan').data,
        {'qrToken': 'single-use-entry'});
    expect(find.text('Checked in').evaluate().length, greaterThanOrEqualTo(1));
    expect(tester.takeException(), isNull);
    await close(tester);
  });
  testWidgets(
      'Walk-in sends customer identity and never auto-confirms money received',
      (tester) async {
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final day = arenaToday().add(const Duration(days: 2));
    await mount(tester,
        screen: AdminWalkInScreen(
            venues: api.venues(arenaDate(day)),
            date: day,
            venueId: 1,
            slotId: 11));
    await tester.enterText(
        find.widgetWithText(TextFormField, 'Customer name'), 'Hassan Ali');
    await tester.enterText(
        find.widgetWithText(TextFormField, 'Phone number'), '03001234567');
    await shot(tester, 'walk-in-light');
    await tester.tap(find.byKey(const Key('create-walk-in')));
    await tester.pumpAndSettle();
    final request = api.requests
        .singleWhere((r) => r.path == '/bookings' && r.method == 'POST');
    expect(request.data['walkInName'], 'Hassan Ali');
    expect(request.data['walkInPhone'], '03001234567');
    expect(request.data['slotId'], 11);
    expect(api.requests.where((r) => r.path.endsWith('/confirm')), isEmpty);
    expect(find.text('Walk-in reserved'), findsOneWidget);
    await tester.tap(find.text('Done'));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    await close(tester);
  });
  testWidgets('Facility editor saves capacity, price, image and availability',
      (tester) async {
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await mount(tester,
        screen: AdminVenueEditor(
            venue: api.venues('2026-10-25').first, sports: api.sports));
    await tester.enterText(find.widgetWithText(TextFormField, 'Facility name'),
        'Padel Garden Court');
    await tester.scrollUntilVisible(find.text('Save facility'), 300,
        scrollable: find.byType(Scrollable).first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Save facility'));
    await tester.pumpAndSettle();
    final request = api.requests
        .singleWhere((r) => r.path == '/venues/1' && r.method == 'PUT');
    expect(request.data['name'], 'Padel Garden Court');
    expect(request.data['pricePerSlot'], 2000);
    expect(request.data['isActive'], isTrue);
    expect(tester.takeException(), isNull);
    await close(tester);
  });
  testWidgets(
      'Failed overview does not fabricate zero totals or offer a walk-in',
      (tester) async {
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    api.fail = true;
    await mount(tester);
    expect(find.text('Could not refresh Arena Desk'), findsOneWidget);
    expect(find.text('Gross collected'), findsNothing);
    expect(find.text('Add walk-in booking'), findsNothing);
    api.fail = false;
    await tester.tap(find.text('Try again'));
    await tester.pumpAndSettle();
    expect(find.text('Daily court schedule'), findsOneWidget);
    await close(tester);
  });
  testWidgets(
      'All admin tabs and scrolled content support compact large-text layouts',
      (tester) async {
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await mount(tester, size: const Size(320, 640), scale: 1.5);
    for (final tab in ['Overview', 'Bookings', 'Courts', 'More']) {
      await tester.tap(find.text(tab).last);
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      for (var i = 0; i < 8; i++) {
        await tester.drag(find.byType(ListView).first, const Offset(0, -300));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
      }
    }
    await close(tester);
  });
}
