import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:smart_sports_hub/providers/theme_provider.dart';
import 'package:smart_sports_hub/screens/login_screen.dart';

void main() {
  testWidgets('Theme switch works on compact login and persists selection',
      (tester) async {
    SharedPreferences.setMockInitialValues({'theme': 'ThemeMode.dark'});
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final provider = ThemeProvider();
    await tester.pumpWidget(ChangeNotifierProvider.value(
      value: provider,
      child: Consumer<ThemeProvider>(
          builder: (_, theme, __) => MaterialApp(
                theme: ThemeData.light(),
                darkTheme: ThemeData.dark(),
                themeMode: theme.themeMode,
                home: const LoginScreen(),
              )),
    ));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Toggle light or dark theme'));
    await tester.pumpAndSettle();
    expect(provider.themeMode, ThemeMode.light);
    expect((await SharedPreferences.getInstance()).getString('theme'),
        'ThemeMode.light');
    expect(tester.takeException(), isNull);
    provider.toggleTheme(ThemeMode.system);
    await tester.pumpAndSettle();
    final restored = ThemeProvider();
    await tester.pumpAndSettle();
    expect(restored.themeMode, ThemeMode.system);
    restored.dispose();
    await tester.pumpWidget(const SizedBox());
    provider.dispose();
  });
}
