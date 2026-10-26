import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ThemeProvider extends ChangeNotifier {
  ThemeMode _themeMode = ThemeMode.system;

  ThemeMode get themeMode => _themeMode;

  ThemeProvider() {
    _loadTheme();
  }

  void toggleTheme(ThemeMode mode) async {
    _themeMode = mode;
    notifyListeners();
    SharedPreferences prefs = await SharedPreferences.getInstance();
    prefs.setString('theme', mode.toString());
  }

  void _loadTheme() async {
    SharedPreferences prefs = await SharedPreferences.getInstance();
    String? theme = prefs.getString('theme');
    if (theme != null) {
      if (theme == ThemeMode.light.toString()) {
        _themeMode = ThemeMode.light;
      } else if (theme == ThemeMode.dark.toString()) {
        _themeMode = ThemeMode.dark;
      } else if (theme == ThemeMode.system.toString()) {
        _themeMode = ThemeMode.system;
      }
      notifyListeners();
    }
  }

  static ThemeData get lightTheme => _theme(Brightness.light);
  static ThemeData get darkTheme => _theme(Brightness.dark);
  static ThemeData _theme(Brightness brightness) {
    final dark = brightness == Brightness.dark;
    final scheme = ColorScheme.fromSeed(
            seedColor: const Color(0xFF174C36), brightness: brightness)
        .copyWith(
      primary: dark ? const Color(0xFFA3D9B9) : const Color(0xFF174C36),
      onPrimary: dark ? const Color(0xFF092B1E) : Colors.white,
      primaryContainer:
          dark ? const Color(0xFF194331) : const Color(0xFFE2ECDD),
      onPrimaryContainer:
          dark ? const Color(0xFFD5EFDC) : const Color(0xFF143D2B),
      secondary: dark ? const Color(0xFFD9BB78) : const Color(0xFF785C23),
      secondaryContainer:
          dark ? const Color(0xFF4B3C1D) : const Color(0xFFF0E3BC),
      onSecondaryContainer:
          dark ? const Color(0xFFF4DE9F) : const Color(0xFF4C3913),
      onSecondary: dark ? const Color(0xFF35290F) : Colors.white,
      surface: dark ? const Color(0xFF10271E) : const Color(0xFFFFFDF7),
      onSurface: dark ? const Color(0xFFEDF2E9) : const Color(0xFF142C21),
      onSurfaceVariant:
          dark ? const Color(0xFFB5C7BA) : const Color(0xFF526557),
      outline: dark ? const Color(0xFF5D7767) : const Color(0xFF819181),
      outlineVariant: dark ? const Color(0xFF2D4939) : const Color(0xFFDCDFD2),
    );
    final background = dark ? const Color(0xFF081C14) : const Color(0xFFF5F3E9);
    final shape = RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: BorderSide(color: scheme.outline.withValues(alpha: .5)));
    return ThemeData(
      useMaterial3: true,
      fontFamily: 'Roboto',
      brightness: brightness,
      colorScheme: scheme,
      primaryColor: scheme.primary,
      scaffoldBackgroundColor: background,
      textTheme: (dark
              ? ThemeData.dark().textTheme
              : ThemeData.light().textTheme)
          .apply(bodyColor: scheme.onSurface, displayColor: scheme.onSurface),
      appBarTheme: AppBarTheme(
          backgroundColor: background,
          foregroundColor: scheme.onSurface,
          elevation: 0,
          scrolledUnderElevation: 0,
          centerTitle: false),
      cardTheme:
          CardThemeData(color: scheme.surface, elevation: 0, shape: shape),
      dividerTheme:
          DividerThemeData(color: scheme.outline.withValues(alpha: .3)),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: scheme.surface,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(18)),
        enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(18),
            borderSide: BorderSide(color: scheme.outline)),
        focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(18),
            borderSide: BorderSide(color: scheme.primary, width: 2)),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
        backgroundColor: const Color(0xFF174C36),
        foregroundColor: Colors.white,
        elevation: 0,
        minimumSize: const Size(48, 48),
        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        textStyle: const TextStyle(
            fontFamily: 'Roboto', fontSize: 15, fontWeight: FontWeight.w700),
      )),
      outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
        foregroundColor: scheme.primary,
        side: BorderSide(color: scheme.outline),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
        shape: shape,
      )),
      navigationBarTheme: NavigationBarThemeData(
          height: 76,
          backgroundColor: scheme.surface,
          indicatorColor: scheme.primaryContainer),
      chipTheme: ChipThemeData(
        backgroundColor: scheme.surface,
        selectedColor: scheme.primaryContainer,
        side: BorderSide(color: scheme.outlineVariant),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: scheme.primaryContainer,
        foregroundColor: scheme.onPrimaryContainer,
      ),
      snackBarTheme:
          const SnackBarThemeData(behavior: SnackBarBehavior.floating),
    );
  }
}
