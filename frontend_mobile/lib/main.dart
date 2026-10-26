import 'package:flutter/material.dart';
import 'services/push_service.dart';
import 'package:provider/provider.dart';
import 'providers/auth_provider.dart';
import 'screens/login_screen.dart';
import 'screens/signup_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/sports_screen.dart';
import 'screens/tournaments_screen.dart';
import 'screens/matches_screen.dart';
import 'screens/my_bookings_screen.dart';
import 'screens/settings_screen.dart';
import 'providers/theme_provider.dart';

import 'screens/admin_dashboard_screen.dart';
import 'screens/events_screen.dart';
import 'screens/equipment_screen.dart';
import 'screens/membership_screen.dart';
import 'screens/complaints_screen.dart';
import 'screens/notifications_screen.dart';
import 'screens/payments_screen.dart';

final _messengerKey = GlobalKey<ScaffoldMessengerState>();
final _navigatorKey = GlobalKey<NavigatorState>();

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  PushService.onOpen = () => WidgetsBinding.instance.addPostFrameCallback((_) {
        _navigatorKey.currentState?.pushNamed('/notifications');
      });
  PushService.onForeground = (title, body) {
    _messengerKey.currentState?.showSnackBar(SnackBar(
      content: Text('$title: $body'),
      action: SnackBarAction(
          label: 'View',
          onPressed: () =>
              _navigatorKey.currentState?.pushNamed('/notifications')),
    ));
  };
  await PushService.initialize();
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()..checkAuth()),
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
      ],
      child: const SmartSportsHubApp(),
    ),
  );
}

class SmartSportsHubApp extends StatelessWidget {
  const SmartSportsHubApp({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<ThemeProvider>(
      builder: (context, themeProvider, _) {
        return MaterialApp(
          navigatorKey: _navigatorKey,
          scaffoldMessengerKey: _messengerKey,
          title: 'KT Smart Sport Hub',
          debugShowCheckedModeBanner: false,
          themeMode: themeProvider.themeMode,
          theme: ThemeProvider.lightTheme,
          darkTheme: ThemeProvider.darkTheme,
          home: const SessionGate(),
          routes: {
            '/login': (context) => const SessionGate(),
            '/signup': (context) => const SignupScreen(),
            '/events': (context) => const EventsScreen(),
            '/equipment': (context) => const EquipmentScreen(),
            '/membership': (context) => const MembershipScreen(),
            '/complaints': (context) => const ComplaintsScreen(),
            '/notifications': (context) => const NotificationsScreen(),
            '/payments': (context) => const PaymentsScreen(),
            '/settings': (context) => const SettingsScreen(),
            '/sports': (context) => const SportsScreen(),
            '/tournaments': (context) => const TournamentsScreen(),
            '/matches': (context) => const MatchesScreen(),
          },
        );
      },
    );
  }
}

class MainLayout extends StatefulWidget {
  const MainLayout({super.key});

  @override
  State<MainLayout> createState() => _MainLayoutState();
}

class _MainLayoutState extends State<MainLayout> {
  int _currentIndex = 0;

  final List<Widget> _screens = [
    const DashboardScreen(),
    const MyBookingsScreen(),
    const SettingsScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _screens[_currentIndex],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) => setState(() => _currentIndex = index),
        destinations: const [
          NavigationDestination(
              icon: Icon(Icons.explore_outlined),
              selectedIcon: Icon(Icons.explore),
              label: 'Discover'),
          NavigationDestination(
              icon: Icon(Icons.calendar_month_outlined), label: 'Bookings'),
          NavigationDestination(
              icon: Icon(Icons.person_outline),
              selectedIcon: Icon(Icons.person),
              label: 'Profile'),
        ],
      ),
    );
  }
}

class SessionGate extends StatelessWidget {
  const SessionGate({super.key});
  @override
  Widget build(BuildContext context) => Consumer<AuthProvider>(
        builder: (context, auth, _) {
          if (auth.isLoading) {
            return const Scaffold(
              body: Center(
                child: CircularProgressIndicator(),
              ),
            );
          }
          if (auth.isAuthenticated) {
            if (auth.user?['role'] == 'ADMIN') {
              return const AdminDashboardScreen();
            }
            return const MainLayout();
          }
          WidgetsBinding.instance.addPostFrameCallback((_) {
            _navigatorKey.currentState?.popUntil((route) => route.isFirst);
          });
          return const LoginScreen();
        },
      );
}
