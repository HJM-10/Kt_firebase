import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:smart_sports_hub/screens/login_screen.dart';

void main() {
  testWidgets('Login displays credentials and opens signup', (tester) async {
    await tester.pumpWidget(MaterialApp(
      home: const LoginScreen(),
      routes: {
        '/signup': (_) => const Scaffold(body: Text('Registration form'))
      },
    ));
    expect(find.text('KT Smart Sport Hub'), findsOneWidget);
    expect(find.widgetWithText(TextField, 'Email'), findsOneWidget);
    expect(find.widgetWithText(TextField, 'Password'), findsOneWidget);
    await tester.enterText(
        find.widgetWithText(TextField, 'Email'), 'qa@example.com');
    expect(find.text('qa@example.com'), findsOneWidget);
    await tester.ensureVisible(find.text("Don't have an account? Sign up"));
    await tester.tap(find.text("Don't have an account? Sign up"));
    await tester.pumpAndSettle();
    expect(find.text('Registration form'), findsOneWidget);
  });
}
