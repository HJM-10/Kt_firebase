import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:dio/dio.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import '../services/payment_service.dart';
import '../providers/auth_provider.dart';
import '../utils/booking_time.dart';
import '../widgets/clubhouse.dart';
import 'my_bookings_screen.dart';

class SlotsScreen extends StatefulWidget {
  final int venueId;
  final int? rescheduleBookingId;
  final DateTime? initialDate;
  final Map<String, dynamic>? initialVenue;
  const SlotsScreen(
      {super.key,
      required this.venueId,
      this.rescheduleBookingId,
      this.initialDate,
      this.initialVenue});
  @override
  State<SlotsScreen> createState() => _SlotsScreenState();
}

class _SlotsScreenState extends State<SlotsScreen> {
  DateTime date = DateTime.now();
  List<dynamic> slots = [];
  Map<String, dynamic>? _venue;
  int? _selectedId;
  bool loading = true, booking = false, _venueLoading = true;
  String? error, _venueError;
  int _loadVersion = 0;
  final promo = TextEditingController();
  @override
  void initState() {
    super.initState();
    final today = DateUtils.dateOnly(DateTime.now());
    date = DateUtils.dateOnly(widget.initialDate ?? today);
    if (date.isBefore(today)) date = today;
    _venue = widget.initialVenue;
    _loadVenue();
    load();
    ApiService().socket.on('booking_updated', onUpdate);
  }

  void onUpdate(dynamic _) {
    if (mounted) load();
  }

  @override
  void dispose() {
    ApiService().socket.off('booking_updated', onUpdate);
    promo.dispose();
    super.dispose();
  }

  Future<void> _loadVenue() async {
    try {
      final response = await ApiService().dio.get('/venues/${widget.venueId}');
      if (mounted) {
        setState(() {
          _venue = Map<String, dynamic>.from(response.data['data']);
          _venueError = null;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => _venueError = 'Could not refresh venue details.');
      }
    } finally {
      if (mounted) setState(() => _venueLoading = false);
    }
  }

  bool _unavailable(dynamic slot) =>
      slot['isBooked'] == true ||
      !slotStartsAt(Map<String, dynamic>.from(slot)).isAfter(DateTime.now());
  Map<String, dynamic>? get _selected {
    for (final slot in slots) {
      if (slot['id'] == _selectedId && !_unavailable(slot)) {
        return Map<String, dynamic>.from(slot);
      }
    }
    return null;
  }

  int _duration(Map<String, dynamic> slot) {
    int minutes(String time) {
      final parts = time.split(':');
      return int.parse(parts[0]) * 60 + int.parse(parts[1]);
    }

    return minutes(slot['endTime']) - minutes(slot['startTime']);
  }

  String _time(String time) {
    final parts = time.split(':');
    return DateFormat.jm()
        .format(DateTime(2026, 1, 1, int.parse(parts[0]), int.parse(parts[1])));
  }

  Future<void> load() async {
    final version = ++_loadVersion;
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final response = await ApiService().dio.get('/bookings/slots',
          queryParameters: {
            'venueId': widget.venueId,
            'date': DateFormat('yyyy-MM-dd').format(date)
          });
      if (mounted && version == _loadVersion) {
        setState(() {
          slots = response.data['data'];
          if (_selected == null) _selectedId = null;
        });
      }
    } catch (_) {
      if (mounted && version == _loadVersion) {
        setState(() {
          error = 'Could not load sessions. Please retry.';
          _selectedId = null;
        });
      }
    } finally {
      if (mounted && version == _loadVersion) setState(() => loading = false);
    }
  }

  Future<void> reserve() async {
    final selected = _selected;
    if (selected == null || booking || loading) return;
    setState(() => booking = true);
    try {
      if (widget.rescheduleBookingId != null) {
        await ApiService().dio.put(
            '/bookings/${widget.rescheduleBookingId}/reschedule',
            data: {'slotId': selected['id']});
        if (mounted) Navigator.pop(context);
        return;
      }
      final response = await ApiService().dio.post('/bookings',
          data: {'slotId': selected['id'], 'promoCode': promo.text.trim()});
      if (!mounted) return;
      final record = response.data['data'];
      // The server decides the final amount, promotion and payment status.
      if ((record['finalPrice'] as num) > 0) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content:
                Text('Reservation created. Complete payment to confirm.')));
        await PaymentService.checkout(record['paymentId']);
      } else {
        await load();
        if (!mounted) return;
        setState(() => booking = false);
        await showDialog<void>(
            context: context,
            builder: (dialogContext) => AlertDialog(
                  icon: Icon(Icons.check_circle_outline,
                      size: 48, color: Theme.of(context).colorScheme.primary),
                  title: const Text('You’re all booked.'),
                  content: Text(
                      '${_venue?['name'] ?? 'Your court'}\n${DateFormat.yMMMd().format(date)} · ${_time(selected['startTime'])}\n\nYour booking and entry QR are in My Bookings.'),
                  actions: [
                    TextButton(
                        onPressed: () => Navigator.pop(dialogContext),
                        child: const Text('Done'))
                  ],
                ));
      }
      if (mounted) {
        setState(() => _selectedId = null);
        await load();
      }
    } catch (e) {
      final String message = e is DioException &&
              e.response?.data is Map &&
              e.response?.data?['message'] != null
          ? e.response!.data['message'].toString()
          : 'Could not complete checkout. Check My Bookings before trying again.';
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(message)));
        await load();
      }
    } finally {
      if (mounted) setState(() => booking = false);
    }
  }

  Future<void> publishSlot() async {
    final start = await showTimePicker(
        context: context, initialTime: const TimeOfDay(hour: 9, minute: 0));
    if (start == null || !mounted) return;
    final end = await showTimePicker(
        context: context, initialTime: const TimeOfDay(hour: 10, minute: 0));
    if (end == null || !mounted) return;
    String hhmm(TimeOfDay time) =>
        '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
    try {
      await ApiService().dio.post('/bookings/slots', data: {
        'venueId': widget.venueId,
        'date': DateFormat('yyyy-MM-dd').format(date),
        'startTime': hhmm(start),
        'endTime': hhmm(end)
      });
      if (mounted) await load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(e is DioException
                ? e.response?.data['message'] ?? 'Could not publish slot'
                : 'Could not publish slot')));
      }
    }
  }

  void _changeDate(DateTime day) {
    setState(() {
      date = day;
      _selectedId = null;
    });
    load();
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final selected = _selected;
    final today = DateUtils.dateOnly(DateTime.now());
    final startDay = date.difference(today).inDays > 6 ? date : today;
    return Scaffold(
      appBar: AppBar(
          title: Text(widget.rescheduleBookingId == null
              ? 'Book a court'
              : 'Reschedule booking'),
          actions: const [ThemeToggle()]),
      body: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          children: [
            ClipRRect(
                borderRadius: BorderRadius.circular(18),
                child: ClubhouseImage(
                    sport: _venue?['sport']?['name'] ?? 'Sport',
                    imageUrl: _venue?['imageUrl'],
                    height: 185)),
            const SizedBox(height: 18),
            Text(
                _venue?['name'] ??
                    (_venueLoading
                        ? 'Loading venue…'
                        : 'Venue details unavailable'),
                style: const TextStyle(
                    fontSize: 25,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -.6)),
            if (_venue != null) ...[
              const SizedBox(height: 10),
              Wrap(
                  spacing: 16,
                  runSpacing: 10,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Row(mainAxisSize: MainAxisSize.min, children: [
                      Icon(sportIcon(_venue?['sport']?['name'] ?? ''),
                          color: colors.secondary, size: 20),
                      const SizedBox(width: 8),
                      Text(_venue?['sport']?['name'] ?? 'Sport'),
                    ]),
                    Text('${clubPrice(_venue?['pricePerSlot'])} / session',
                        style: TextStyle(
                            color: colors.primary, fontWeight: FontWeight.w700))
                  ]),
              if ((_venue?['description'] as String? ?? '').isNotEmpty) ...[
                const SizedBox(height: 10),
                Text(_venue!['description'],
                    style:
                        TextStyle(color: colors.onSurfaceVariant, height: 1.4))
              ],
            ],
            if (_venueError != null)
              TextButton(
                  onPressed: _loadVenue,
                  child: Text('$_venueError Tap to retry.')),
            const Padding(
                padding: EdgeInsets.symmetric(vertical: 18), child: Divider()),
            const ClubhouseHeading('Choose your session',
                subtitle: 'A little time for a better day.'),
            const SizedBox(height: 18),
            SizedBox(
                height:
                    92 * MediaQuery.textScalerOf(context).scale(1).clamp(1, 2),
                child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: 7,
                    separatorBuilder: (_, __) => const SizedBox(width: 8),
                    itemBuilder: (_, index) {
                      final day = startDay.add(Duration(days: index));
                      final active = DateUtils.isSameDay(date, day);
                      return Semantics(
                          selected: active,
                          button: true,
                          label: DateFormat.yMMMMEEEEd().format(day),
                          child: InkWell(
                            borderRadius: BorderRadius.circular(12),
                            onTap: booking ? null : () => _changeDate(day),
                            child: AnimatedContainer(
                              duration: MediaQuery.disableAnimationsOf(context)
                                  ? Duration.zero
                                  : const Duration(milliseconds: 180),
                              width: 66 *
                                  MediaQuery.textScalerOf(context)
                                      .scale(1)
                                      .clamp(1, 2),
                              padding: const EdgeInsets.all(9),
                              decoration: BoxDecoration(
                                  color:
                                      active ? colors.primary : colors.surface,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                      color: active
                                          ? colors.primary
                                          : colors.outlineVariant)),
                              child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Text(
                                        DateUtils.isSameDay(day, today)
                                            ? 'Today'
                                            : DateFormat.E().format(day),
                                        style: TextStyle(
                                            color: active
                                                ? colors.onPrimary
                                                : colors.onSurface,
                                            fontSize: 12)),
                                    const SizedBox(height: 4),
                                    Text(DateFormat.d().format(day),
                                        style: TextStyle(
                                            color: active
                                                ? colors.onPrimary
                                                : colors.onSurface,
                                            fontSize: 24,
                                            fontWeight: FontWeight.w700)),
                                    Text(DateFormat.MMM().format(day),
                                        style: TextStyle(
                                            color: active
                                                ? colors.onPrimary
                                                : colors.onSurfaceVariant,
                                            fontSize: 11)),
                                  ]),
                            ),
                          ));
                    })),
            TextButton.icon(
                onPressed: booking
                    ? null
                    : () async {
                        final picked = await showDatePicker(
                            context: context,
                            initialDate: date,
                            firstDate: today,
                            lastDate: date.isAfter(
                                    today.add(const Duration(days: 365)))
                                ? date
                                : today.add(const Duration(days: 365)));
                        if (picked != null && mounted) _changeDate(picked);
                      },
                icon: const Icon(Icons.calendar_month_outlined, size: 18),
                label:
                    Text('${DateFormat.yMMMd().format(date)} · Change date')),
            if (context.watch<AuthProvider>().user?['role'] == 'ADMIN')
              OutlinedButton(
                  onPressed: booking ? null : publishSlot,
                  child: const Text('Publish a slot for selected date')),
            const SizedBox(height: 12),
            const Text('Available times',
                style: TextStyle(fontSize: 19, fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            Text('Times shown in Pakistan time (UTC+05:00).',
                style: TextStyle(fontSize: 12, color: colors.onSurfaceVariant)),
            const SizedBox(height: 14),
            if (loading)
              const Padding(
                  padding: EdgeInsets.all(24),
                  child: Center(child: CircularProgressIndicator()))
            else if (error != null)
              ClubhouseEmpty(
                  title: 'Sessions could not load',
                  message: error!,
                  onRetry: load)
            else if (slots.isEmpty)
              const ClubhouseEmpty(
                  title: 'A different day, perhaps?',
                  message: 'No sessions on this date. Choose another date.',
                  icon: Icons.calendar_today_outlined)
            else
              LayoutBuilder(
                  builder: (_, constraints) => Wrap(
                      spacing: 10,
                      runSpacing: 10,
                      children: slots.map((slot) {
                        final unavailable = _unavailable(slot);
                        final active = selected?['id'] == slot['id'];
                        final fg = active
                            ? colors.onPrimary
                            : unavailable
                                ? colors.onSurfaceVariant
                                : colors.onSurface;
                        return SizedBox(
                            width: (constraints.maxWidth - 10) / 2,
                            child: Semantics(
                              selected: active,
                              enabled: !unavailable && !booking,
                              button: true,
                              child: Material(
                                color: active ? colors.primary : colors.surface,
                                shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(12),
                                    side: BorderSide(
                                        color: active
                                            ? colors.primary
                                            : colors.outlineVariant)),
                                child: InkWell(
                                  borderRadius: BorderRadius.circular(12),
                                  onTap: unavailable || booking
                                      ? null
                                      : () => setState(
                                          () => _selectedId = slot['id']),
                                  child: Padding(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 8, vertical: 16),
                                      child: Column(children: [
                                        Text(
                                            '${_time(slot['startTime'])} – ${_time(slot['endTime'])}',
                                            textAlign: TextAlign.center,
                                            style: TextStyle(
                                                color: fg,
                                                fontWeight: FontWeight.w700,
                                                fontSize: 13)),
                                        const SizedBox(height: 6),
                                        Text(
                                            active
                                                ? 'Selected'
                                                : slot['isBooked'] == true
                                                    ? 'Booked'
                                                    : unavailable
                                                        ? 'Passed'
                                                        : 'Available',
                                            style: TextStyle(
                                                color: fg, fontSize: 12)),
                                      ])),
                                ),
                              ),
                            ));
                      }).toList())),
            const SizedBox(height: 22),
            if (widget.rescheduleBookingId == null)
              TextField(
                  controller: promo,
                  enabled: !booking,
                  textCapitalization: TextCapitalization.characters,
                  decoration: const InputDecoration(
                      labelText: 'Promo code (optional)',
                      prefixIcon: Icon(Icons.local_offer_outlined),
                      helperText: 'Valid discounts are applied at checkout.',
                      helperMaxLines: 3)),
            const SizedBox(height: 20),
            if (selected != null)
              Card(
                  margin: EdgeInsets.zero,
                  child: Padding(
                      padding: const EdgeInsets.all(18),
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Your session',
                                style: TextStyle(
                                    fontWeight: FontWeight.w800, fontSize: 18)),
                            const SizedBox(height: 10),
                            Text(
                                '${DateFormat.yMMMd().format(date)} · ${_time(selected['startTime'])}'),
                            const SizedBox(height: 6),
                            Text('${_duration(selected)} minutes',
                                style:
                                    TextStyle(color: colors.onSurfaceVariant)),
                            const SizedBox(height: 12),
                            Text('Your entry QR is valid during this session. '
                                'Arrive before ${_time(selected['endTime'])} PKT; '
                                'the pass expires when the session ends.'),
                            const Divider(height: 28),
                            Row(children: [
                              Expanded(
                                  child: Text(
                                      widget.rescheduleBookingId == null
                                          ? 'Session price'
                                          : 'Rescheduling',
                                      style: TextStyle(
                                          color: colors.onSurfaceVariant))),
                              Text(
                                  widget.rescheduleBookingId == null
                                      ? clubPrice(_venue?['pricePerSlot'])
                                      : 'Same duration required',
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w700))
                            ]),
                          ]))),
            TextButton(
                onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                        builder: (_) => const MyBookingsScreen())),
                child: const Text('View My Bookings')),
          ]),
      bottomNavigationBar: SafeArea(
          top: false,
          child: Container(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
            decoration: BoxDecoration(
                color: colors.surface,
                border: Border(top: BorderSide(color: colors.outlineVariant))),
            child: ElevatedButton.icon(
                key: const Key('reserve-session'),
                onPressed:
                    selected == null || booking || loading || _venue == null
                        ? null
                        : reserve,
                icon: booking
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.arrow_forward, size: 18),
                label: Text(booking
                    ? 'Saving your session…'
                    : selected == null
                        ? 'Select a time to continue'
                        : widget.rescheduleBookingId != null
                            ? 'Confirm new session'
                            : 'Reserve session')),
          )),
    );
  }
}
