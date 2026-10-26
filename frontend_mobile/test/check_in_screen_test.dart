import 'dart:convert';
import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:smart_sports_hub/providers/theme_provider.dart';
import 'package:smart_sports_hub/screens/check_in_screen.dart';
import 'package:smart_sports_hub/services/api_service.dart';
import 'package:smart_sports_hub/widgets/arena_desk.dart';

class _Camera extends MobileScannerPlatform {
  final captures = StreamController<BarcodeCapture?>.broadcast();
  bool deny = false;
  int stops = 0;
  @override
  Stream<BarcodeCapture?> get barcodesStream => captures.stream;
  @override
  Stream<TorchState> get torchStateStream => const Stream.empty();
  @override
  Stream<double> get zoomScaleStateStream => const Stream.empty();
  @override
  Future<MobileScannerViewAttributes> start(StartOptions options) async {
    if (deny) {
      throw const MobileScannerException(
          errorCode: MobileScannerErrorCode.permissionDenied);
    }
    return const MobileScannerViewAttributes(
        cameraDirection: CameraFacing.back,
        currentTorchMode: TorchState.off,
        size: Size(640, 480),
        numberOfCameras: 1);
  }

  @override
  Widget buildCameraView() => const SizedBox.expand();
  @override
  Future<void> stop() async {
    stops++;
  }

  @override
  Future<void> dispose() async {}
}

class _EntryApi implements HttpClientAdapter {
  final requests = <RequestOptions>[];
  bool reject = false;
  @override
  Future<ResponseBody> fetch(RequestOptions options,
      Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    requests.add(options);
    return ResponseBody.fromString(
        jsonEncode(reject
            ? {'success': false, 'message': 'Booking already used'}
            : {
                'success': true,
                'data': {
                  'id': 42,
                  'user': {'name': 'Demo Player'},
                  'slot': {
                    'date': '2026-10-25',
                    'startTime': '18:00',
                    'endTime': '19:00',
                    'venue': {'name': 'Padel Court 01'}
                  }
                }
              }),
        reject ? 409 : 200,
        headers: {
          Headers.contentTypeHeader: ['application/json']
        });
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  late _EntryApi api;
  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
    ApiService().socket.disconnect();
    api = _EntryApi();
    ApiService().dio.httpClientAdapter = api;
  });
  Future<void> mount(WidgetTester tester,
      {Brightness brightness = Brightness.light,
      double width = 390,
      double scale = 1}) async {
    tester.view.physicalSize = Size(width, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(MaterialApp(
      theme: brightness == Brightness.light
          ? ThemeProvider.lightTheme
          : ThemeProvider.darkTheme,
      builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context)
              .copyWith(textScaler: TextScaler.linear(scale)),
          child: child!),
      home: const CheckInScreen(),
    ));
    await tester.pumpAndSettle();
  }

  Future<void> verify(WidgetTester tester) async {
    final button = find.byKey(const ValueKey('verify-entry'));
    await tester.ensureVisible(button);
    await tester.pumpAndSettle();
    await tester.tap(button);
    await tester.pumpAndSettle();
  }

  testWidgets('Camera capture fills code once and requires explicit check-in',
      (tester) async {
    final original = MobileScannerPlatform.instance;
    final camera = _Camera();
    MobileScannerPlatform.instance = camera;
    addTearDown(() async {
      MobileScannerController.resetPlatformSessionOwner();
      MobileScannerPlatform.instance = original;
      await camera.captures.close();
    });
    await mount(tester);
    await tester.tap(find.text('Scan QR code'));
    await tester.pumpAndSettle();
    const capture =
        BarcodeCapture(barcodes: [Barcode(rawValue: 'camera-entry')]);
    camera.captures.add(capture);
    camera.captures.add(capture);
    await tester.pumpAndSettle();
    expect(find.text('Scan entry pass'), findsNothing);
    expect(
        tester
            .widget<TextField>(find.byKey(const ValueKey('entry-code')))
            .controller!
            .text,
        'camera-entry');
    expect(api.requests, isEmpty);
    expect(camera.stops, greaterThanOrEqualTo(1));
    await verify(tester);
    expect(api.requests.single.data, {'qrToken': 'camera-entry'});
  });

  testWidgets('Denied camera keeps a manual-entry escape route',
      (tester) async {
    final original = MobileScannerPlatform.instance;
    final camera = _Camera()..deny = true;
    MobileScannerPlatform.instance = camera;
    addTearDown(() async {
      MobileScannerController.resetPlatformSessionOwner();
      MobileScannerPlatform.instance = original;
      await camera.captures.close();
    });
    await mount(tester);
    await tester.tap(find.text('Scan QR code'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Camera unavailable'), findsOneWidget);
    await tester.tap(find.text('Enter code instead'));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('entry-code')), findsOneWidget);
    expect(api.requests, isEmpty);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Arena icons keep their proportions in a full-width list',
      (tester) async {
    await tester.pumpWidget(MaterialApp(
        home: Scaffold(
            body: ListView(
                children: const [ArenaIcon(ArenaSymbol.scan, size: 48)]))));
    final paint = find.descendant(
        of: find.byType(ArenaIcon), matching: find.byType(CustomPaint));
    expect(tester.getSize(paint), const Size(48, 48));
  });
  for (final brightness in [Brightness.light, Brightness.dark]) {
    testWidgets(
        'Entry form stays usable at 320 pixels with large text in $brightness',
        (tester) async {
      await mount(tester, brightness: brightness, width: 320, scale: 1.6);
      expect(find.text('Player entry'), findsOneWidget);
      await verify(tester);
      expect(api.requests, isEmpty);
      expect(find.text('Enter the code from the player’s booking pass.'),
          findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }
  testWidgets(
      'QR contents check in only on confirmation and show a clear receipt',
      (tester) async {
    await mount(tester);
    await tester.enterText(find.byKey(const ValueKey('entry-code')),
        '{"bookingId":42,"token":"  entry-code-42  "}');
    expect(api.requests, isEmpty);
    await verify(tester);
    expect(api.requests.single.path, '/bookings/scan');
    expect(api.requests.single.data, {'qrToken': 'entry-code-42'});
    expect(find.text('Checked in'), findsOneWidget);
    expect(find.text('Demo Player'), findsOneWidget);
    expect(find.text('Booking #42'), findsOneWidget);
    expect(find.text('Padel Court 01'), findsOneWidget);
    await tester.ensureVisible(find.text('Verify another pass'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Verify another pass'));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('entry-code')), findsOneWidget);
    expect(api.requests, hasLength(1));
    expect(tester.takeException(), isNull);
  });
  testWidgets('Rejected pass retains the code and explains the server response',
      (tester) async {
    api.reject = true;
    await mount(tester);
    await tester.enterText(
        find.byKey(const ValueKey('entry-code')), 'used-code');
    await verify(tester);
    expect(find.text('Booking already used'), findsOneWidget);
    expect(find.text('Checked in'), findsNothing);
    expect(
        tester
            .widget<TextField>(find.byKey(const ValueKey('entry-code')))
            .controller!
            .text,
        'used-code');
    expect(tester.takeException(), isNull);
  });
  testWidgets('Paste fills the field without checking the player in',
      (tester) async {
    tester.binding.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, (call) async {
      if (call.method == 'Clipboard.getData') {
        return {'text': 'clipboard-entry'};
      }
      if (call.method == 'Clipboard.hasStrings') return {'value': true};
      return null;
    });
    addTearDown(() => tester.binding.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, null));
    await mount(tester);
    await tester.ensureVisible(find.text('Paste code'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Paste code'));
    await tester.pumpAndSettle();
    expect(
        tester
            .widget<TextField>(find.byKey(const ValueKey('entry-code')))
            .controller!
            .text,
        'clipboard-entry');
    expect(api.requests, isEmpty);
  });
}
