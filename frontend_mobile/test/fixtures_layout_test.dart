import 'dart:convert';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:smart_sports_hub/providers/theme_provider.dart';
import 'package:smart_sports_hub/screens/fixtures_screen.dart';
import 'package:smart_sports_hub/services/api_service.dart';

class _FixtureApi implements HttpClientAdapter {
  @override
  Future<ResponseBody> fetch(RequestOptions options,
      Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    return ResponseBody.fromString(
        jsonEncode({
          'success': true,
          'data': options.path == '/tournaments'
              ? [
                  {
                    'id': 1,
                    'name': 'A long tournament name for a small screen',
                    'sportId': 1,
                    'status': 'UPCOMING'
                  }
                ]
              : [
                  {
                    'id': 1,
                    'name': 'Demo Padel Court',
                    'sportId': 1,
                    'isActive': true
                  }
                ]
        }),
        200,
        headers: {
          Headers.contentTypeHeader: ['application/json']
        });
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
    ApiService().socket.disconnect();
    ApiService().dio.httpClientAdapter = _FixtureApi();
  });
  for (final width in [320.0, 768.0]) {
    for (final brightness in [Brightness.light, Brightness.dark]) {
      testWidgets(
          'Fixture fields stay separated at $width in $brightness with large text',
          (tester) async {
        tester.view.physicalSize = Size(width, 760);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        await tester.pumpWidget(MaterialApp(
          theme: brightness == Brightness.light
              ? ThemeProvider.lightTheme
              : ThemeProvider.darkTheme,
          builder: (context, child) => MediaQuery(
              data: MediaQuery.of(context)
                  .copyWith(textScaler: const TextScaler.linear(1.6)),
              child: child!),
          home: const FixturesScreen(),
        ));
        await tester.pumpAndSettle();
        for (final pair in [
          ['Match duration', 'fixture-duration'],
          ['Time between match starts', 'fixture-interval'],
        ]) {
          final input = find.byKey(ValueKey(pair[1]));
          await tester.scrollUntilVisible(input, 180, scrollable: find.byType(Scrollable).first);
          await tester.pumpAndSettle();
          expect(tester.takeException(), isNull);
          final labelRect = tester.getRect(find.text(pair[0]));
          final inputRect = tester.getRect(input);
          expect(inputRect.top - labelRect.bottom, greaterThanOrEqualTo(9));
          expect(inputRect.width, lessThanOrEqualTo(width - 40));
        }
        await tester.scrollUntilVisible(find.text('Generate and save'), 180, scrollable: find.byType(Scrollable).first);
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
      });
    }
  }
}
