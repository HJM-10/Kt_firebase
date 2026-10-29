import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../services/live_refresh.dart';
import '../utils/booking_time.dart';
import '../widgets/clubhouse.dart';
import '../widgets/venue_card.dart';
import 'sports_screen.dart';
import 'venues_screen.dart';
import 'slots_screen.dart';
import 'my_bookings_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});
  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen>
    with LiveRefresh<DashboardScreen> {
  final _api = ApiService();
  List<dynamic> _sports = [],
      _venues = [],
      _recommendations = [],
      _bookings = [];
  bool _loading = true;
  final Set<String> _failed = {};
  int _version = 0;
  @override
  List<String> get liveResources => ['sports', 'venues', 'bookings', 'recommendations'];
  @override
  Future<void> refreshForLiveUpdates() => _fetch();
  @override
  void initState() {
    super.initState();
    _fetch();
    _api.socket.on('booking_updated', _onUpdate);
  }

  void _onUpdate(dynamic _) {
    if (mounted) _fetch();
  }

  @override
  void dispose() {
    _api.socket.off('booking_updated', _onUpdate);
    super.dispose();
  }

  Future<void> _fetch() async {
    final version = ++_version;
    final failed = <String>{};
    Future<List<dynamic>?> get(String path) async {
      try {
        final response = await _api.dio.get(path);
        return response.data['data'] as List;
      } catch (_) {
        failed.add(path);
        return null;
      }
    }

    final result = await Future.wait([
      get('/sports'),
      get('/venues'),
      get('/recommendations/slots'),
      get('/bookings/my')
    ]);
    if (!mounted || version != _version) return;
    setState(() {
      _sports = result[0] ?? _sports;
      _venues = result[1] ?? _venues;
      _recommendations = result[2] ?? _recommendations;
      _bookings = result[3] ?? _bookings;
      _failed
        ..clear()
        ..addAll(failed);
      _loading = false;
    });
  }

  void _explore() => Navigator.push(
      context, MaterialPageRoute(builder: (_) => const SportsScreen()));
  void _openVenue(Map<String, dynamic> venue, {DateTime? date}) =>
      Navigator.push(
          context,
          MaterialPageRoute(
              builder: (_) => SlotsScreen(
                  venueId: venue['id'],
                  initialDate: date,
                  initialVenue: venue)));

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final user = context.watch<AuthProvider>().user;
    final name = (user?['name'] as String? ?? '').trim().split(' ').first;
    final upcoming = _bookings
        .where((b) =>
            isUpcomingBooking(Map<String, dynamic>.from(b), DateTime.now()))
        .toList()
      ..sort((a, b) => slotStartsAt(Map<String, dynamic>.from(a['slot']))
          .compareTo(slotStartsAt(Map<String, dynamic>.from(b['slot']))));
    final hour = DateTime.now().hour;
    final greeting = hour < 12
        ? 'Good morning'
        : hour < 17
            ? 'Good afternoon'
            : 'Good evening';
    return Scaffold(
      appBar: AppBar(
        centerTitle: true,
        title: const Text('KT Smart Sport Hub',
            textAlign: TextAlign.center,
            maxLines: 2,
            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
        leading: IconButton(
            tooltip: 'Notifications',
            icon: const Icon(Icons.notifications_outlined),
            onPressed: () => Navigator.pushNamed(context, '/notifications')),
        actions: const [ThemeToggle()],
      ),
      body: RefreshIndicator(
          onRefresh: _fetch,
          child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
              children: [
                ClubhouseEntrance(
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                      Text('$greeting${name.isEmpty ? '' : ', $name'}.',
                          style: TextStyle(
                              color: colors.onSurfaceVariant, fontSize: 16)),
                      const SizedBox(height: 8),
                      const Text('Find your next game.',
                          style: TextStyle(
                              fontSize: 32,
                              fontWeight: FontWeight.w800,
                              height: 1.05,
                              letterSpacing: -1.5)),
                      const SizedBox(height: 12),
                      Text('Great courts. Good people. More time for play.',
                          style: TextStyle(
                              color: colors.onSurfaceVariant, height: 1.4)),
                    ])),
                const SizedBox(height: 22),
                if (_failed.isNotEmpty)
                  Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Card(
                          child: ListTile(
                        leading: Icon(Icons.wifi_off_outlined,
                            color: colors.secondary),
                        title: const Text('Some information could not refresh'),
                        subtitle: const Text('Pull down to try again.'),
                        trailing: IconButton(
                            tooltip: 'Retry',
                            onPressed: _fetch,
                            icon: const Icon(Icons.refresh)),
                      ))),
                if (_loading)
                  const Padding(
                      padding: EdgeInsets.all(24),
                      child: Center(child: CircularProgressIndicator())),
                if (_sports.isNotEmpty)
                  SizedBox(
                      height: 92,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: _sports.length,
                        separatorBuilder: (_, __) => const SizedBox(width: 10),
                        itemBuilder: (_, index) {
                          final sport = _sports[index];
                          return Material(
                              color: colors.primaryContainer,
                              borderRadius: BorderRadius.circular(14),
                              child: InkWell(
                                borderRadius: BorderRadius.circular(14),
                                onTap: () => Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                        builder: (_) => VenuesScreen(
                                            sportId: sport['id'],
                                            sportName: sport['name']))),
                                child: SizedBox(
                                    width: 84,
                                    child: Column(
                                        mainAxisAlignment:
                                            MainAxisAlignment.center,
                                        children: [
                                          Icon(sportIcon(sport['name']),
                                              color: colors.onPrimaryContainer,
                                              size: 28),
                                          const SizedBox(height: 8),
                                          Text(sport['name'],
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                              style: TextStyle(
                                                  color:
                                                      colors.onPrimaryContainer,
                                                  fontSize: 12,
                                                  fontWeight: FontWeight.w600)),
                                        ])),
                              ));
                        },
                      )),
                if (upcoming.isNotEmpty) ...[
                  const SizedBox(height: 24),
                  Card(
                      margin: EdgeInsets.zero,
                      child: ListTile(
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 18, vertical: 8),
                        leading: Icon(Icons.calendar_month_outlined,
                            color: colors.secondary),
                        title: Text(upcoming.first['slot']['venue']['name'],
                            style:
                                const TextStyle(fontWeight: FontWeight.w700)),
                        subtitle: Text(
                            'Next booking · ${DateFormat.MMMd().format(DateTime.parse(upcoming.first['slot']['date']))} · ${upcoming.first['slot']['startTime']}'),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => Navigator.push(
                            context,
                            MaterialPageRoute(
                                builder: (_) => const MyBookingsScreen())),
                      )),
                ],
                const SizedBox(height: 24),
                Row(children: [
                  const Expanded(
                      child: Text('Find your court',
                          style: TextStyle(
                              fontSize: 23,
                              fontWeight: FontWeight.w800,
                              letterSpacing: -.5))),
                  TextButton(onPressed: _explore, child: const Text('See all'))
                ]),
                const SizedBox(height: 8),
                if (!_loading && _venues.isEmpty)
                  ClubhouseEmpty(
                    title: _failed.contains('/venues')
                        ? 'Courts could not load'
                        : 'More games ahead',
                    message: _failed.contains('/venues')
                        ? 'Check your connection and try again.'
                        : 'Venues will appear here when they are available.',
                    onRetry: _failed.contains('/venues') ? _fetch : null,
                  ),
                ..._venues.take(3).map((v) => VenueCard(
                    venue: Map<String, dynamic>.from(v),
                    onBook: () => _openVenue(Map<String, dynamic>.from(v)))),
                if (_recommendations.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  const ClubhouseHeading('A session for you',
                      subtitle: 'Available sessions based on your activity.'),
                  const SizedBox(height: 16),
                  ..._recommendations.take(3).map((rec) => VenueCard(
                        venue: Map<String, dynamic>.from(rec['venue']),
                        session:
                            '${DateFormat.MMMd().format(DateTime.parse(rec['date']))} · ${rec['startTime']} – ${rec['endTime']}',
                        onBook: () => _openVenue(
                            Map<String, dynamic>.from(rec['venue']),
                            date: DateTime.parse(rec['date'])),
                      )),
                ],
                const SizedBox(height: 8),
                const ClubhouseHeading('Beyond the court',
                    subtitle: 'Find your people. Make it a regular thing.'),
                const SizedBox(height: 16),
                Wrap(spacing: 10, runSpacing: 10, children: [
                  _feature('Tournaments', Icons.emoji_events_outlined,
                      '/tournaments'),
                  _feature('Matches', Icons.sports, '/matches'),
                  _feature('Events', Icons.event_outlined, '/events'),
                  _feature('Offers & discounts', Icons.local_offer_outlined, '/promo'),
                  _feature('Equipment', Icons.sports_tennis, '/equipment'),
                  _feature('Membership', Icons.card_membership, '/membership'),
                  _feature('Support', Icons.support_agent, '/complaints'),
                ]),
              ])),
    );
  }

  Widget _feature(String label, IconData icon, String route) => ActionChip(
        avatar: Icon(icon,
            size: 18, color: Theme.of(context).colorScheme.secondary),
        label: Text(label),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
        onPressed: () => Navigator.pushNamed(context, route),
      );
}
