import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/theme_provider.dart';
import '../services/api_service.dart';
import '../services/api_errors.dart';
import '../services/live_refresh.dart';
import '../utils/arena_desk.dart';
import '../widgets/clubhouse.dart';
import '../widgets/arena_desk.dart';
import 'admin/walk_in_screen.dart';
import 'admin/sessions_screen.dart';
import 'admin/venue_editor.dart';
import 'admin_sports_screen.dart';
import 'admin_users_screen.dart';
import 'admin_tournaments_screen.dart';
import 'admin_events_screen.dart';
import 'admin_reports_screen.dart';
import 'equipment_screen.dart';
import 'promo_codes_screen.dart';
import 'payments_screen.dart';
import 'fixtures_screen.dart';
import 'check_in_screen.dart';
import 'booking_qr_screen.dart';
import 'settings_screen.dart';

class AdminDashboardScreen extends StatefulWidget {
  const AdminDashboardScreen({super.key, this.now});
  final DateTime Function()? now;
  @override
  State<AdminDashboardScreen> createState() => _AdminDashboardScreenState();
}

class _AdminDashboardScreenState extends State<AdminDashboardScreen>
    with LiveRefresh<AdminDashboardScreen> {
  late DateTime _date;
  DateTime get _now => (widget.now ?? DateTime.now)();
  Map<String, dynamic>? _data;
  String? _error;
  bool _loading = true;
  int _tab = 0, _version = 0;
  int? _sportId;
  String _filter = 'All';
  final Set<int> _busy = {};
  Timer? _timer;
  List<Map<String, dynamic>> get _venues => arenaMaps(_data?['venues']);
  List<Map<String, dynamic>> get _sports => arenaMaps(_data?['sports']);
  List<Map<String, dynamic>> get _bookings => arenaMaps(_data?['bookings']);
  bool get _ready => !_loading && _error == null && _data != null;
  @override
  List<String> get liveResources =>
      ['bookings', 'venues', 'sports', 'payments'];
  @override
  Future<void> refreshForLiveUpdates() => _fetch();
  @override
  void initState() {
    super.initState();
    _date = arenaToday(_now);
    _fetch();
    _timer = Timer.periodic(const Duration(minutes: 1), (_) {
      if (mounted && !_loading && _busy.isEmpty) _fetch();
    });
    ApiService().socket.on('booking_updated', _bookingChanged);
  }

  void _bookingChanged(dynamic _) {
    if (mounted) _fetch();
  }

  @override
  void dispose() {
    _timer?.cancel();
    ApiService().socket.off('booking_updated', _bookingChanged);
    super.dispose();
  }

  Future<void> _fetch() async {
    final version = ++_version;
    setState(() => _loading = true);
    try {
      final response = await ApiService().dio.get('/reports/arena-desk',
          queryParameters: {'date': arenaDate(_date)});
      if (mounted && version == _version) {
        setState(() {
          _data = Map<String, dynamic>.from(response.data['data']);
          _error = null;
          if (_sportId != null && !_sports.any((s) => s['id'] == _sportId)) {
            _sportId = null;
          }
        });
      }
    } catch (e) {
      if (mounted && version == _version) {
        setState(() => _error = apiErrorMessage(e));
      }
    } finally {
      if (mounted && version == _version) setState(() => _loading = false);
    }
  }

  Future<void> _push(Widget screen) async {
    await Navigator.push(context, MaterialPageRoute(builder: (_) => screen));
    if (mounted) _fetch();
  }

  Future<void> _pickDate() async {
    final date = await showDatePicker(
        context: context,
        initialDate: _date,
        firstDate: DateTime(2020),
        lastDate: arenaToday(_now).add(const Duration(days: 3650)));
    if (date != null && mounted) {
      setState(() {
        _date = date;
        _data = null;
      });
      _fetch();
    }
  }

  void _walkIn({int? venueId, int? slotId}) {
    if (!_ready) return;
    _push(AdminWalkInScreen(
        venues: _venues, date: _date, venueId: venueId, slotId: slotId));
  }

  void _slot(Map<String, dynamic> venue, Map<String, dynamic> slot) {
    if (!_ready) return;
    final booking = slotBooking(slot);
    if (booking == null &&
        slot['isBooked'] != true &&
        arenaInstant(arenaDate(_date), slot['startTime']).isAfter(_now) &&
        venue['isActive'] != false &&
        venue['sport']?['isActive'] != false) {
      _walkIn(venueId: venue['id'], slotId: slot['id']);
      return;
    }
    showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        showDragHandle: true,
        builder: (c) => SafeArea(
            child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(venue['name'],
                          style: const TextStyle(
                              fontSize: 24, fontWeight: FontWeight.w800)),
                      const SizedBox(height: 8),
                      Text(
                          '${DateFormat.yMMMd().format(_date)} · ${arenaTime(slot['startTime'])} – ${arenaTime(slot['endTime'])}'),
                      const SizedBox(height: 16),
                      ArenaStatus(slotLabel(slot, arenaDate(_date), _now)),
                      if (booking != null) ...[
                        const SizedBox(height: 16),
                        Text(booking['user']?['name'] ?? 'Customer',
                            style: const TextStyle(
                                fontWeight: FontWeight.w700, fontSize: 20)),
                        const SizedBox(height: 6),
                        Text(
                            'Booking #${booking['id']} · ${clubPrice(booking['finalPrice'])}')
                      ],
                      const SizedBox(height: 20),
                      SizedBox(
                          width: double.infinity,
                          child: OutlinedButton(
                              onPressed: () {
                                Navigator.pop(c);
                                setState(() => _tab = 1);
                              },
                              child: const Text('Open bookings'))),
                    ]))));
  }

  Future<void> _cash(Map<String, dynamic> booking) async {
    final id = booking['id'] as int;
    if (!_ready || _busy.contains(id)) return;
    setState(() => _busy.add(id));
    try {
      final confirmed = await showDialog<bool>(
          context: context,
          builder: (c) => AlertDialog(
                  title: const Text('Record payment received'),
                  content: Text(
                      'Booking #$id · ${clubPrice(booking['finalPrice'])}\n\nConfirm only after collecting the full amount in person. Online payments must be verified by the provider.'),
                  actions: [
                    TextButton(
                        onPressed: () => Navigator.pop(c, false),
                        child: const Text('Cancel')),
                    ElevatedButton(
                        onPressed: () => Navigator.pop(c, true),
                        child: const Text('Money received'))
                  ]));
      if (confirmed != true || !mounted) return;
      await ApiService()
          .dio
          .put('/bookings/$id/confirm', data: {'receivedInPerson': true});
      if (mounted) {
        _message('Payment recorded. Booking confirmed.');
        await _fetch();
      }
    } catch (e) {
      if (mounted) {
        _message(apiErrorMessage(e));
        await _fetch();
      }
    } finally {
      if (mounted) setState(() => _busy.remove(id));
    }
  }

  Future<void> _checkIn(Map<String, dynamic> booking) async {
    final id = booking['id'] as int;
    if (!_ready || _busy.contains(id)) return;
    setState(() => _busy.add(id));
    try {
      final confirmed = await showDialog<bool>(
          context: context,
          builder: (c) => AlertDialog(
                  title: const Text('Customer has arrived?'),
                  content: Text(
                      'Check in ${booking['user']?['name'] ?? 'this customer'} for ${booking['slot']['venue']['name']}?\n\nThis uses the booking’s single-use entry pass.'),
                  actions: [
                    TextButton(
                        onPressed: () => Navigator.pop(c, false),
                        child: const Text('Not yet')),
                    ElevatedButton(
                        onPressed: () => Navigator.pop(c, true),
                        child: const Text('Confirm arrival'))
                  ]));
      if (confirmed != true || !mounted) return;
      final qr = await ApiService().dio.get('/bookings/$id/qr');
      if (qr.data['data']['qrToken'] == null) {
        if (mounted) _message(qr.data['data']['entryPass']['message']);
        return;
      }
      await ApiService().dio.post('/bookings/scan',
          data: {'qrToken': qr.data['data']['qrToken']});
      if (mounted) {
        _message('Customer checked in.');
        await _fetch();
      }
    } catch (e) {
      if (mounted) {
        _message(apiErrorMessage(e));
        await _fetch();
      }
    } finally {
      if (mounted) setState(() => _busy.remove(id));
    }
  }

  void _message(String text) =>
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context), colors = theme.colorScheme;
    return Scaffold(
      appBar: AppBar(
          centerTitle: true,
          title: const Column(children: [
            Text('KT Smart Sport Hub',
                style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
            Text('Arena Desk · Admin',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w400))
          ]),
          leading: IconButton(
              tooltip: 'Admin menu',
              onPressed: () => setState(() => _tab = 3),
              icon: const ArenaIcon(ArenaSymbol.more)),
          actions: [
            IconButton(
                tooltip: 'Toggle light or dark theme',
                onPressed: () => context.read<ThemeProvider>().toggleTheme(
                    theme.brightness == Brightness.dark
                        ? ThemeMode.light
                        : ThemeMode.dark),
                icon: ArenaIcon(theme.brightness == Brightness.dark
                    ? ArenaSymbol.sun
                    : ArenaSymbol.moon))
          ]),
      body: RefreshIndicator(
          onRefresh: _fetch,
          child: ListView(
              key: ValueKey(_tab),
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(18, 8, 18, 28),
              children: [
                if (_tab != 3) ...[
                  Row(children: [
                    Expanded(
                        child: Text(
                            _tab == 0
                                ? 'Your arena, at a glance.'
                                : _tab == 1
                                    ? 'Bookings'
                                    : 'Courts & venues',
                            style: const TextStyle(
                                fontSize: 24,
                                fontWeight: FontWeight.w800,
                                letterSpacing: -.5))),
                    IconButton(
                        tooltip: 'Refresh schedule',
                        onPressed: _loading ? null : _fetch,
                        icon: const ArenaIcon(ArenaSymbol.refresh, size: 21))
                  ]),
                  const SizedBox(height: 8),
                  Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        OutlinedButton.icon(
                            onPressed: _pickDate,
                            icon:
                                const ArenaIcon(ArenaSymbol.calendar, size: 17),
                            label:
                                Text(DateFormat('EEE, d MMM').format(_date))),
                        if (!DateUtils.isSameDay(_date, arenaToday(_now)))
                          TextButton(
                              onPressed: () {
                                setState(() {
                                  _date = arenaToday(_now);
                                  _data = null;
                                });
                                _fetch();
                              },
                              child: const Text('Today')),
                      ]),
                  const SizedBox(height: 12),
                  if (_loading) const LinearProgressIndicator(minHeight: 2),
                  if (_error != null)
                    Card(
                        child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text('Could not refresh Arena Desk',
                                      style: TextStyle(
                                          fontWeight: FontWeight.w700)),
                                  const SizedBox(height: 6),
                                  Text(_error!),
                                  if (_data != null)
                                    const Text(
                                        'Showing the last loaded information. Refresh before making changes.'),
                                  TextButton(
                                      onPressed: _fetch,
                                      child: const Text('Try again'))
                                ]))),
                  if (_data == null && _loading)
                    const Padding(
                        padding: EdgeInsets.all(48),
                        child: Center(child: CircularProgressIndicator())),
                ],
                if (_tab == 3)
                  _more()
                else if (_data != null) ...[
                  if (_tab == 0)
                    ..._overview()
                  else if (_tab == 1)
                    ..._bookingList()
                  else
                    ..._courtList(),
                  const SizedBox(height: 18),
                  Text(
                      'Pakistan time · Last updated ${DateFormat.jm().format(pakistanNow(DateTime.parse(_data!['generatedAt'])))}',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                          color: colors.onSurfaceVariant, fontSize: 11)),
                ],
              ])),
      bottomNavigationBar: NavigationBar(
          selectedIndex: _tab,
          onDestinationSelected: (value) => setState(() => _tab = value),
          destinations: const [
            NavigationDestination(
                icon: ArenaIcon(ArenaSymbol.overview), label: 'Overview'),
            NavigationDestination(
                icon: ArenaIcon(ArenaSymbol.calendar), label: 'Bookings'),
            NavigationDestination(
                icon: ArenaIcon(ArenaSymbol.court), label: 'Courts'),
            NavigationDestination(
                icon: ArenaIcon(ArenaSymbol.more), label: 'More'),
          ]),
    );
  }

  List<Widget> _overview() {
    final colors = Theme.of(context).colorScheme;
    final summary = _data!['summary'];
    final scheduleVenues = [..._venues]..sort((a, b) {
        int priority(Map<String, dynamic> venue) {
          final slots = arenaMaps(venue['slots']);
          return slots.any((slot) => slotBooking(slot) != null)
              ? 2
              : slots.isNotEmpty
                  ? 1
                  : 0;
        }

        final rank = priority(b).compareTo(priority(a));
        return rank != 0
            ? rank
            : (a['name'] as String).compareTo(b['name'] as String);
      });
    final name =
        (context.watch<AuthProvider>().user?['name'] as String? ?? 'Admin')
            .trim()
            .split(' ')
            .first;
    final arrivals = _bookings
        .where((b) =>
            ['CONFIRMED', 'PENDING_PAYMENT'].contains(b['status']) &&
            arenaInstant(arenaDate(_date), b['slot']['endTime']).isAfter(_now))
        .take(4)
        .toList();
    return [
      if (_bookings.any((b) =>
          (b['notes'] as String? ?? '').startsWith('ARENA_DESK_DEMO'))) ...[
        Wrap(
            spacing: 8,
            runSpacing: 6,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              const ArenaStatus('Demo preview'),
              Text('Sample bookings and simulated payments',
                  style:
                      TextStyle(color: colors.onSurfaceVariant, fontSize: 11))
            ]),
        const SizedBox(height: 8),
      ],
      const SizedBox(height: 12),
      ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: Stack(children: [
            ClubhouseImage(
                height: 150 *
                    MediaQuery.textScalerOf(context).scale(1).clamp(1, 2)),
            Positioned.fill(
                child: DecoratedBox(
                    decoration: BoxDecoration(
                        gradient: LinearGradient(colors: [
              Colors.black.withValues(alpha: .72),
              Colors.transparent
            ], begin: Alignment.centerLeft, end: Alignment.centerRight)))),
            Positioned(
                left: 18,
                top: 22,
                right: 70,
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Welcome, $name',
                          style: const TextStyle(
                              color: Colors.white, fontSize: 13)),
                      const SizedBox(height: 8),
                      const Text('Keeping your arena\nin play.',
                          style: TextStyle(
                              color: Colors.white,
                              fontSize: 25,
                              fontWeight: FontWeight.w800,
                              height: 1.1))
                    ])),
          ])),
      const SizedBox(height: 24),
      _section('Daily court schedule',
          action: 'All courts', onTap: () => setState(() => _tab = 2)),
      const SizedBox(height: 12),
      ArenaSchedule(
          venues: scheduleVenues.take(4).toList(),
          date: arenaDate(_date),
          now: _now,
          onSlot: _slot),
      const SizedBox(height: 20),
      LayoutBuilder(builder: (_, constraints) {
        final items = [
          _stat('${summary['bookings']}', 'Bookings', ArenaSymbol.calendar,
              'Excludes cancelled'),
          _stat(
              'PKR ${NumberFormat('#,##0.##').format(summary['collected'] ?? 0)}',
              'Gross collected',
              ArenaSymbol.money,
              '${summary['paymentCount']} paid records')
        ];
        if (constraints.maxWidth < 310 ||
            MediaQuery.textScalerOf(context).scale(1) > 1.2) {
          return Column(children: [
            ...items.map((w) =>
                Padding(padding: const EdgeInsets.only(bottom: 10), child: w))
          ]);
        }
        return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(child: items[0]),
          const SizedBox(width: 10),
          Expanded(child: items[1])
        ]);
      }),
      const SizedBox(height: 8),
      Text(
          'Gross totals include paid payment records updated on the selected date, before refunds.',
          style: TextStyle(
              color: colors.onSurfaceVariant, fontSize: 11, height: 1.4)),
      const SizedBox(height: 16),
      ElevatedButton.icon(
          onPressed: _ready ? _walkIn : null,
          icon: const ArenaIcon(ArenaSymbol.add, size: 20, color: Colors.white),
          label: const Text('Add walk-in booking')),
      const SizedBox(height: 24),
      _section('Next arrivals',
          action: 'View all', onTap: () => setState(() => _tab = 1)),
      const SizedBox(height: 12),
      if (arrivals.isEmpty)
        const ArenaEmpty(
            title: 'No arrivals ahead.',
            message: 'Upcoming confirmed and unpaid bookings appear here.',
            symbol: ArenaSymbol.calendar)
      else
        ...arrivals.map((b) => _bookingCard(b, compact: true)),
      if ((summary['pendingBookings'] as num) > 0) ...[
        const SizedBox(height: 12),
        Card(
            child: ListTile(
                title: Text(
                    '${summary['pendingBookings']} bookings awaiting payment',
                    style: const TextStyle(fontWeight: FontWeight.w700)),
                subtitle: const Text('Review before confirming attendance.'),
                trailing: const ArenaIcon(ArenaSymbol.arrow, size: 20),
                onTap: () {
                  setState(() {
                    _filter = 'Pending';
                    _tab = 1;
                  });
                }))
      ],
    ];
  }

  Widget _section(String title, {String? action, VoidCallback? onTap}) =>
      Row(children: [
        Expanded(
            child: Text(title,
                style: const TextStyle(
                    fontSize: 19, fontWeight: FontWeight.w800))),
        if (action != null) TextButton(onPressed: onTap, child: Text(action))
      ]);
  Widget _stat(String value, String label, ArenaSymbol symbol, String hint) =>
      Card(
          margin: EdgeInsets.zero,
          child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    ArenaIcon(symbol,
                        size: 22,
                        color: Theme.of(context).colorScheme.secondary),
                    const SizedBox(height: 12),
                    Text(value,
                        style: const TextStyle(
                            fontSize: 22, fontWeight: FontWeight.w800)),
                    const SizedBox(height: 5),
                    Text(label,
                        style: const TextStyle(fontWeight: FontWeight.w600)),
                    const SizedBox(height: 5),
                    Text(hint,
                        style: TextStyle(
                            color:
                                Theme.of(context).colorScheme.onSurfaceVariant,
                            fontSize: 11))
                  ])));
  List<Widget> _bookingList() {
    final visible = _bookings
        .where((b) =>
            _filter == 'All' ||
            (_filter == 'Pending'
                ? b['status'] == 'PENDING_PAYMENT'
                : _filter == 'Confirmed'
                    ? b['status'] == 'CONFIRMED'
                    : _filter == 'Checked in'
                        ? b['status'] == 'SCANNED'
                        : b['status'] == 'CANCELLED'))
        .toList();
    return [
      const SizedBox(height: 8),
      ElevatedButton.icon(
          onPressed: _ready ? _walkIn : null,
          icon: const ArenaIcon(ArenaSymbol.add, size: 20, color: Colors.white),
          label: const Text('Add walk-in booking')),
      const SizedBox(height: 16),
      Wrap(
          spacing: 8,
          runSpacing: 6,
          children: ['All', 'Pending', 'Confirmed', 'Checked in', 'Cancelled']
              .map((label) => ChoiceChip(
                  label: Text(label),
                  selected: _filter == label,
                  onSelected: (_) => setState(() => _filter = label)))
              .toList()),
      const SizedBox(height: 16),
      if (visible.isEmpty)
        const ArenaEmpty(
            title: 'Nothing here for this day.',
            message: 'Try another date or booking status.',
            symbol: ArenaSymbol.calendar)
      else
        ...visible.map((b) => _bookingCard(b)),
    ];
  }

  Widget _bookingCard(Map<String, dynamic> booking, {bool compact = false}) {
    final slot = booking['slot'], venue = slot['venue'];
    final colors = Theme.of(context).colorScheme;
    final id = booking['id'] as int,
        busy = _busy.contains(id),
        status = booking['status'];
    final canCheckIn = status == 'CONFIRMED' &&
        DateUtils.isSameDay(_date, arenaToday(_now)) &&
        !arenaInstant(arenaDate(_date), slot['startTime']).isAfter(_now) &&
        arenaInstant(arenaDate(_date), slot['endTime']).isAfter(_now);
    return Card(
        margin: const EdgeInsets.only(bottom: 12),
        child: Padding(
            padding: const EdgeInsets.all(14),
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                ClipRRect(
                    borderRadius: BorderRadius.circular(9),
                    child: SizedBox(
                        width: 54,
                        child: ClubhouseImage(
                            sport: venue['sport']?['name'] ?? '',
                            imageUrl: venue['imageUrl'],
                            height: 58,
                            showCaption: false))),
                const SizedBox(width: 12),
                Expanded(
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                      Text(booking['user']?['name'] ?? 'Customer',
                          style: const TextStyle(
                              fontSize: 16, fontWeight: FontWeight.w800)),
                      const SizedBox(height: 5),
                      Text(venue['name'],
                          style: TextStyle(
                              color: colors.onSurfaceVariant, fontSize: 12)),
                      const SizedBox(height: 5),
                      Text(
                          '${arenaTime(slot['startTime'])} – ${arenaTime(slot['endTime'])}',
                          style: const TextStyle(
                              fontSize: 12, fontWeight: FontWeight.w600))
                    ]))
              ]),
              const SizedBox(height: 12),
              Wrap(
                  spacing: 12,
                  runSpacing: 8,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text('#$id · ${clubPrice(booking['finalPrice'])}',
                        style: const TextStyle(fontWeight: FontWeight.w700)),
                    ArenaStatus(status == 'PENDING_PAYMENT'
                        ? 'Awaiting payment'
                        : status == 'SCANNED'
                            ? 'Checked in'
                            : status == 'CANCELLED'
                                ? 'Cancelled'
                                : 'Confirmed')
                  ]),
              if (!compact &&
                  (booking['user']?['phone'] as String? ?? '').isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(booking['user']['phone'],
                    style: TextStyle(color: colors.onSurfaceVariant))
              ],
              if (!compact &&
                  (booking['notes'] as String? ?? '').isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(
                    (booking['notes'] as String).startsWith('ARENA_DESK_DEMO')
                        ? 'Demo preview booking. No real money collected.'
                        : booking['notes'],
                    style: TextStyle(color: colors.onSurfaceVariant))
              ],
              if (status == 'PENDING_PAYMENT' || status == 'CONFIRMED') ...[
                const SizedBox(height: 12),
                Wrap(spacing: 8, runSpacing: 8, children: [
                  if (status == 'CONFIRMED')
                    OutlinedButton.icon(
                        onPressed: () => Navigator.push(
                            context,
                            MaterialPageRoute(
                                builder: (_) =>
                                    BookingQrScreen(bookingId: id))),
                        icon: const Icon(Icons.qr_code_2),
                        label: const Text('View entry pass')),
                  if (status == 'PENDING_PAYMENT')
                    OutlinedButton(
                        onPressed:
                            _ready && !busy ? () => _cash(booking) : null,
                        child: Text(busy ? 'Please wait…' : 'Record payment')),
                  if (canCheckIn)
                    ElevatedButton(
                        onPressed:
                            _ready && !busy ? () => _checkIn(booking) : null,
                        child: Text(busy ? 'Please wait…' : 'Check in')),
                ])
              ],
            ])));
  }

  List<Widget> _courtList() {
    final visible = _venues
        .where((v) =>
            _sportId == null || (v['sportId'] ?? v['sport']?['id']) == _sportId)
        .toList();
    return [
      const Text('Every bookable facility, with its own sessions.'),
      const SizedBox(height: 14),
      Wrap(spacing: 8, runSpacing: 6, children: [
        ChoiceChip(
            label: const Text('All sports'),
            selected: _sportId == null,
            onSelected: (_) => setState(() => _sportId = null)),
        ..._sports.map((s) => ChoiceChip(
            label: Text(s['name']),
            selected: _sportId == s['id'],
            onSelected: (_) => setState(() => _sportId = s['id'])))
      ]),
      const SizedBox(height: 16),
      OutlinedButton.icon(
          onPressed: _ready && _sports.isNotEmpty
              ? () => _push(AdminVenueEditor(sports: _sports))
              : null,
          icon: const ArenaIcon(ArenaSymbol.add, size: 19),
          label: const Text('Add a court or facility')),
      const SizedBox(height: 16),
      if (visible.isEmpty)
        const ArenaEmpty(
            title: 'A place for your next game.',
            message: 'Add a facility or choose another sport.')
      else
        ...visible.map((v) => _courtCard(v)),
    ];
  }

  Widget _courtCard(Map<String, dynamic> venue) {
    final colors = Theme.of(context).colorScheme,
        sport = venue['sport']?['name'] ?? 'Sport';
    final next = arenaMaps(venue['slots'])
        .where((s) =>
            slotBooking(s) != null &&
            arenaInstant(arenaDate(_date), s['endTime']).isAfter(_now))
        .firstOrNull;
    return Card(
        margin: const EdgeInsets.only(bottom: 20),
        clipBehavior: Clip.antiAlias,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          ClubhouseImage(
              sport: sport, imageUrl: venue['imageUrl'], height: 175),
          Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(venue['name'],
                        style: const TextStyle(
                            fontSize: 23, fontWeight: FontWeight.w800)),
                    const SizedBox(height: 8),
                    Wrap(
                        spacing: 10,
                        runSpacing: 8,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          Text(sport,
                              style: TextStyle(color: colors.onSurfaceVariant)),
                          ArenaStatus(
                              venueStatus(venue, arenaDate(_date), _now))
                        ]),
                    const SizedBox(height: 16),
                    Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          SizedBox(
                              width: 100,
                              child: Column(children: [
                                ArenaCourtPlan(sport),
                                const SizedBox(height: 5),
                                Text('Sport diagram',
                                    style: TextStyle(
                                        color: colors.onSurfaceVariant,
                                        fontSize: 10))
                              ])),
                          const SizedBox(width: 14),
                          Expanded(
                              child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                Text(clubPrice(venue['pricePerSlot']),
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w800,
                                        fontSize: 18)),
                                Text('per session',
                                    style: TextStyle(
                                        color: colors.onSurfaceVariant,
                                        fontSize: 12)),
                                if (venue['capacity'] != null) ...[
                                  const SizedBox(height: 10),
                                  Text('Capacity: ${venue['capacity']}',
                                      style: const TextStyle(fontSize: 12))
                                ],
                                const SizedBox(height: 10),
                                Text(
                                    '${arenaMaps(venue['slots']).length} published sessions',
                                    style: TextStyle(
                                        color: colors.onSurfaceVariant,
                                        fontSize: 12)),
                              ]))
                        ]),
                    if (next != null) ...[
                      const Divider(height: 28),
                      Text('Next / current reservation',
                          style: TextStyle(
                              color: colors.onSurfaceVariant, fontSize: 11)),
                      const SizedBox(height: 6),
                      Text(slotBooking(next)?['user']?['name'] ?? 'Customer',
                          style: const TextStyle(fontWeight: FontWeight.w700)),
                      Text(
                          '${arenaTime(next['startTime'])} – ${arenaTime(next['endTime'])}')
                    ],
                    const SizedBox(height: 16),
                    Wrap(spacing: 8, runSpacing: 8, children: [
                      ElevatedButton(
                          onPressed: _ready
                              ? () => _push(AdminSessionsScreen(
                                  venue: venue, date: _date))
                              : null,
                          child: const Text('Manage sessions')),
                      TextButton(
                          onPressed: _ready
                              ? () => _push(AdminVenueEditor(
                                  venue: venue, sports: _sports))
                              : null,
                          child: const Text('Edit facility'))
                    ]),
                  ])),
        ]));
  }

  Widget _more() =>
      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const SizedBox(height: 12),
        const ClubhouseHeading('Manage your hub.',
            subtitle: 'The tools behind a better day of sport.'),
        const SizedBox(height: 24),
        _module('Sports catalogue', 'Manage your sports and categories',
            ArenaSymbol.court, const AdminSportsScreen()),
        _module('Customers & staff', 'Accounts, roles and access',
            ArenaSymbol.user, const AdminUsersScreen()),
        _module('Tournaments', 'Teams, registration and results',
            ArenaSymbol.trophy, const AdminTournamentsScreen()),
        _module('Events', 'Coaching, camps and community', ArenaSymbol.events,
            const AdminEventsScreen()),
        _module('Fixtures', 'Match schedules and results', ArenaSymbol.fixtures,
            const FixturesScreen()),
        _module('Payments & invoices', 'Review payments and receipts',
            ArenaSymbol.money, const PaymentsScreen(admin: true)),
        _module('Equipment rentals', 'Inventory and returns',
            ArenaSymbol.equipment, const EquipmentScreen()),
        _module('Offers & discounts', 'Current promo code terms',
            ArenaSymbol.money, const PromoCodesScreen()),
        _module('Reports', 'Revenue and performance', ArenaSymbol.report,
            const AdminReportsScreen()),
        _module('Verify an entry pass', 'Scan or enter a booking pass',
            ArenaSymbol.scan, const CheckInScreen()),
        _module('Profile & appearance', 'Your account and theme',
            ArenaSymbol.settings, const SettingsScreen()),
        const SizedBox(height: 20),
        TextButton.icon(
            onPressed: () => context.read<AuthProvider>().logout(),
            icon: ArenaIcon(ArenaSymbol.logout,
                color: Theme.of(context).colorScheme.error, size: 20),
            label: Text('Sign out',
                style: TextStyle(color: Theme.of(context).colorScheme.error))),
      ]);
  Widget _module(
          String title, String subtitle, ArenaSymbol symbol, Widget screen) =>
      Card(
          margin: const EdgeInsets.only(bottom: 10),
          child: ListTile(
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              leading: ArenaIcon(symbol,
                  color: Theme.of(context).colorScheme.secondary),
              title: Text(title,
                  style: const TextStyle(fontWeight: FontWeight.w700)),
              subtitle: Text(subtitle),
              trailing: const ArenaIcon(ArenaSymbol.arrow, size: 18),
              onTap: () => _push(screen)));
}
