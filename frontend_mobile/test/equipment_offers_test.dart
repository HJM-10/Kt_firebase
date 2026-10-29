import 'dart:convert';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:smart_sports_hub/providers/auth_provider.dart';
import 'package:smart_sports_hub/screens/equipment_screen.dart';
import 'package:smart_sports_hub/screens/promo_codes_screen.dart';
import 'package:smart_sports_hub/screens/venue_details_screen.dart';
import 'package:smart_sports_hub/services/api_service.dart';

class _Auth extends AuthProvider {
  @override
  Map<String, dynamic> get user => {'id': 1, 'role': 'CUSTOMER'};
}

class _Api implements HttpClientAdapter {
  bool fail = false;
  final requests = <RequestOptions>[];
  Map<String, dynamic> get item => {
        'id': 2,
        'name': 'Padel racket',
        'sport': {'name': 'Padel'},
        'venue': {'name': 'Court A'},
        'brand': 'Sample Brand',
        'model': 'Control',
        'material': 'Fibreglass',
        'ballType': 'Padel ball',
        'condition': 'Good',
        'pricePerSlot': 25,
        'quantity': 2,
        'availableQuantity': 2,
        'isActive': true
      };
  @override
  Future<ResponseBody> fetch(RequestOptions options,
      Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    requests.add(options);
    dynamic data = [];
    if (options.path == '/equipment') data = [item];
    if (options.path == '/venues/1') {
      data = {
        'id': 1,
        'name': 'Court A',
        'sport': {'name': 'Padel'},
        'pricePerSlot': 2000,
        'openingTime': '06:00',
        'closingTime': '23:00',
        'equipment': [item]
      };
    }
    if (options.path == '/promo') {
      data = [
        {
          'code': 'PLAY20',
          'discountType': 'PERCENTAGE',
          'discountValue': 20,
          'perCustomerLimit': 1,
          'remainingUses': 0,
          'available': false
        }
      ];
    }
    return ResponseBody.fromString(
        jsonEncode(fail
            ? {'message': 'Service unavailable'}
            : {'success': true, 'data': data}),
        fail ? 503 : 200,
        headers: {
          Headers.contentTypeHeader: [Headers.jsonContentType]
        });
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late _Api api;
  late _Auth auth;
  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
    api = _Api();
    ApiService().dio.httpClientAdapter = api;
    ApiService().socket.disconnect();
    auth = _Auth();
  });
  tearDown(() => auth.dispose());
  Future<void> mount(WidgetTester tester, Widget screen) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(ChangeNotifierProvider<AuthProvider>.value(
        value: auth, child: MaterialApp(home: screen)));
    await tester.pumpAndSettle();
  }

  testWidgets(
      'venue menu displays staff-supplied specifications and rental navigation',
      (tester) async {
    await mount(tester, const VenueDetailsScreen(venueId: 1));
    expect(find.text('Ball type: Padel ball'), findsOneWidget);
    expect(find.text('Material / surface: Fibreglass'), findsOneWidget);
    await tester.tap(find.text('Reserve venue equipment'));
    await tester.pumpAndSettle();
    expect(
        api.requests.any(
            (r) => r.path == '/equipment' && r.queryParameters['venueId'] == 1),
        isTrue);
    expect(tester.takeException(), isNull);
  });
  testWidgets(
      'rental quantity preview is priced and request dates are explicit',
      (tester) async {
    await mount(tester, const EquipmentScreen());
    await tester.tap(find.text('Reserve equipment'));
    await tester.pumpAndSettle();
    expect(find.text('Total: PKR 25.00'), findsOneWidget);
    await tester.enterText(find.byType(TextFormField), '2');
    await tester.pumpAndSettle();
    expect(find.text('Total: PKR 50.00'), findsOneWidget);
    await tester.enterText(find.byType(TextFormField), '3');
    await tester.tap(find.text('Reserve'));
    await tester.pumpAndSettle();
    expect(find.text('Enter an available quantity'), findsOneWidget);
    expect(api.requests.where((r) => r.method == 'POST'), isEmpty);
    expect(tester.takeException(), isNull);
  });
  testWidgets('offers explain customer allowance and unavailable state',
      (tester) async {
    await mount(tester, const PromoCodesScreen());
    expect(find.text('PLAY20'), findsOneWidget);
    expect(find.text('1 uses per customer · 0 remaining'), findsOneWidget);
    expect(find.text('Allowance used or offer unavailable'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
  testWidgets('equipment failure offers retry and recovers without signing out',
      (tester) async {
    api.fail = true;
    await mount(tester, const EquipmentScreen());
    expect(find.byIcon(Icons.refresh), findsOneWidget);
    api.fail = false;
    await tester.tap(find.byIcon(Icons.refresh));
    await tester.pumpAndSettle();
    expect(find.text('Padel racket'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
