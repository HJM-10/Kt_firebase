import 'dart:convert';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:smart_sports_hub/screens/booking_qr_screen.dart';
import 'package:smart_sports_hub/services/api_service.dart';
import 'package:smart_sports_hub/services/api_errors.dart';

class _QrApi implements HttpClientAdapter {
  String status = 'VALID';
  bool reject = false;
  int requests = 0;
  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? stream,
      Future<void>? cancel) async {
    requests++;
    return ResponseBody.fromString(
        jsonEncode(reject
            ? {'message': 'Could not load pass'}
            : {
                'data': {
                  'qrToken': ['VALID', 'UPCOMING'].contains(status)
                      ? 'opaque-entry-token'
                      : null,
                  'entryPass': {
                    'status': status,
                    'validFrom': '2026-10-25T20:00:00+05:00',
                    'expiresAt': '2026-10-25T21:00:00+05:00',
                    'serverTime': status == 'UPCOMING'
                        ? '2026-10-25T19:00:00+05:00'
                        : '2026-10-25T20:45:00+05:00',
                    'message': 'Pass state: $status'
                  },
                  'booking': {
                    'user': {'name': 'Demo Player'},
                    'slot': {
                      'venue': {'name': 'Padel Court 01'}
                    }
                  }
                }
              }),
        reject ? 503 : 200,
        headers: {
          Headers.contentTypeHeader: ['application/json']
        });
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  late _QrApi api;
  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
    ApiService().socket.disconnect();
    api = _QrApi();
    ApiService().dio.httpClientAdapter = api;
  });
  Future<void> mount(WidgetTester tester) async {
    tester.view.physicalSize = const Size(320, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester
        .pumpWidget(const MaterialApp(home: BookingQrScreen(bookingId: 42)));
    await tester.pumpAndSettle();
  }

  for (final status in ['VALID', 'UPCOMING']) {
    testWidgets('$status pass shows QR and booked end deadline at narrow width',
        (tester) async {
      api.status = status;
      await mount(tester);
      expect(find.byKey(const ValueKey('booking-qr')), findsOneWidget);
      expect(find.text('8:00 PM – 9:00 PM PKT'), findsOneWidget);
      await tester.scrollUntilVisible(
          find.textContaining('Arrive during'), 160);
      expect(find.textContaining('before 9:00 PM PKT'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    });
  }
  for (final status in ['EXPIRED', 'USED', 'CANCELLED', 'PAYMENT_REQUIRED']) {
    testWidgets('$status pass never displays a QR or copy action',
        (tester) async {
      api.status = status;
      await mount(tester);
      expect(find.byKey(const ValueKey('booking-qr')), findsNothing);
      expect(find.text('Copy entry code'), findsNothing);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    });
  }
  testWidgets('Failed load stays on pass screen with retry', (tester) async {
    api.reject = true;
    await mount(tester);
    expect(
        find.text(apiErrorMessage(DioException(
            requestOptions: RequestOptions(),
            response:
                Response(requestOptions: RequestOptions(), statusCode: 503)))),
        findsOneWidget);
    api.reject = false;
    await tester.tap(find.text('Try again'));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('booking-qr')), findsOneWidget);
    expect(api.requests, 2);
    await tester.pumpWidget(const SizedBox());
  });
}
