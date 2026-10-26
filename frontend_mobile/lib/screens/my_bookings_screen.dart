import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import '../services/api_errors.dart';
import '../services/payment_service.dart';
import '../utils/ui_utils.dart';
import '../utils/booking_time.dart';
import '../widgets/clubhouse.dart';
import 'booking_qr_screen.dart';
import 'write_review_screen.dart';
import 'slots_screen.dart';

class MyBookingsScreen extends StatefulWidget {
  const MyBookingsScreen({super.key});
  @override
  State<MyBookingsScreen> createState() => _MyBookingsScreenState();
}

class _MyBookingsScreenState extends State<MyBookingsScreen> {
  final _api = ApiService();
  List<dynamic> _bookings = [];
  bool _loading = true;
  String? _error;
  String _filter = 'All';
  final Set<int> _busy = {};
  @override
  void initState() {
    super.initState();
    _fetch();
    _api.socket.on('booking_updated', _onUpdate);
  }

  @override
  void dispose() {
    _api.socket.off('booking_updated', _onUpdate);
    super.dispose();
  }

  void _onUpdate(dynamic _) {
    if (mounted) _fetch();
  }

  Future<void> _fetch() async {
    try {
      final res = await _api.dio.get('/bookings/my');
      if (mounted) {
        setState(() {
          _bookings = res.data['data'];
          _error = null;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _error = 'Could not refresh your bookings.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _cancel(int id) async {
    if (_busy.contains(id)) return;
    final confirm = await UiUtils.showAnimatedConfirmDialog(
        context: context,
        title: 'Cancel booking?',
        message:
            'Cancel at least 2 hours before the session. This releases the court and queues a full refund of paid fees. Staff handles cash refunds.',
        confirmText: 'Cancel booking',
        cancelText: 'Keep booking',
        isDanger: true);
    if (confirm != true || !mounted) return;
    setState(() => _busy.add(id));
    try {
      await _api.dio.put('/bookings/$id/cancel');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Booking cancelled successfully')));
      await _fetch();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(apiErrorMessage(e))));
      }
    } finally {
      if (mounted) setState(() => _busy.remove(id));
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final visible = _bookings
        .where((b) =>
            _filter == 'All' ||
            (_filter == 'Upcoming'
                ? isUpcomingBooking(
                    Map<String, dynamic>.from(b), DateTime.now())
                : b['status'] == 'PENDING_PAYMENT'))
        .toList();
    return Scaffold(
      appBar: AppBar(
          title: const Text('My Bookings'), actions: const [ThemeToggle()]),
      body: RefreshIndicator(
          onRefresh: _fetch,
          child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(20),
              children: [
                const ClubhouseHeading('Make time for play.',
                    subtitle:
                        'Unpaid holds expire after 30 minutes. Cancel or reschedule at least 2 hours before start. Rescheduling retains your venue, duration and price.'),
                const SizedBox(height: 20),
                Wrap(
                    spacing: 8,
                    children: ['All', 'Upcoming', 'Pending']
                        .map((filter) => ChoiceChip(
                            label: Text(filter),
                            selected: _filter == filter,
                            onSelected: (_) =>
                                setState(() => _filter = filter)))
                        .toList()),
                const SizedBox(height: 18),
                if (_error != null)
                  ListTile(
                      title: Text(_error!),
                      trailing: IconButton(
                          tooltip: 'Retry bookings',
                          onPressed: _fetch,
                          icon: const Icon(Icons.refresh))),
                if (_loading)
                  const Center(child: CircularProgressIndicator())
                else if (visible.isEmpty)
                  ClubhouseEmpty(
                      title: 'Room for your next game.',
                      message: _error != null
                          ? 'Pull down to try loading your sessions again.'
                          : 'Your ${_filter == 'All' ? '' : '${_filter.toLowerCase()} '}bookings will appear here.',
                      icon: Icons.calendar_month_outlined)
                else
                  ...visible.map((b) {
                    final slot = Map<String, dynamic>.from(b['slot']);
                    final venue = Map<String, dynamic>.from(slot['venue']);
                    final confirmed = b['status'] == 'CONFIRMED',
                        scanned = b['status'] == 'SCANNED',
                        pending = b['status'] == 'PENDING_PAYMENT';
                    final status = confirmed
                        ? 'Confirmed'
                        : scanned
                            ? 'Checked in'
                            : pending
                                ? 'Pending payment'
                                : 'Cancelled';
                    final badge = confirmed || scanned
                        ? colors.primary
                        : pending
                            ? colors.secondary
                            : colors.error;
                    final busy = _busy.contains(b['id']);
                    return Card(
                        margin: const EdgeInsets.only(bottom: 18),
                        clipBehavior: Clip.antiAlias,
                        child: Padding(
                            padding: const EdgeInsets.all(18),
                            child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Wrap(
                                      spacing: 12,
                                      runSpacing: 8,
                                      crossAxisAlignment:
                                          WrapCrossAlignment.center,
                                      children: [
                                        Text('#${b['id']}',
                                            style: TextStyle(
                                                color: colors.onSurfaceVariant,
                                                fontWeight: FontWeight.w700)),
                                        Container(
                                            padding: const EdgeInsets.symmetric(
                                                horizontal: 10, vertical: 6),
                                            decoration: BoxDecoration(
                                                color: badge.withValues(
                                                    alpha: .12),
                                                borderRadius:
                                                    BorderRadius.circular(8)),
                                            child: Text(status,
                                                style: TextStyle(
                                                    color: badge,
                                                    fontSize: 12,
                                                    fontWeight:
                                                        FontWeight.w700))),
                                      ]),
                                  const SizedBox(height: 16),
                                  Text(venue['name'],
                                      style: const TextStyle(
                                          fontSize: 22,
                                          fontWeight: FontWeight.w800)),
                                  const SizedBox(height: 10),
                                  Row(children: [
                                    Icon(
                                        sportIcon(
                                            venue['sport']?['name'] ?? ''),
                                        size: 18,
                                        color: colors.secondary),
                                    const SizedBox(width: 8),
                                    Expanded(
                                        child: Text(
                                            venue['sport']?['name'] ?? 'Sport'))
                                  ]),
                                  const SizedBox(height: 10),
                                  Text(
                                      '${DateFormat.yMMMd().format(DateTime.parse(slot['date']))} · ${slot['startTime']} – ${slot['endTime']}',
                                      style: TextStyle(
                                          color: colors.onSurfaceVariant)),
                                  const Divider(height: 28),
                                  Text(
                                      clubPrice(
                                          b['finalPrice'] ?? b['basePrice']),
                                      style: const TextStyle(
                                          fontSize: 21,
                                          fontWeight: FontWeight.w800)),
                                  const SizedBox(height: 12),
                                  Wrap(spacing: 8, runSpacing: 8, children: [
                                    if (confirmed)
                                      ElevatedButton.icon(
                                          onPressed: busy
                                              ? null
                                              : () => Navigator.push(
                                                  context,
                                                  MaterialPageRoute(
                                                      builder: (_) =>
                                                          BookingQrScreen(
                                                              bookingId:
                                                                  b['id']))),
                                          icon: const Icon(Icons.qr_code,
                                              size: 18),
                                          label: const Text('Show QR')),
                                    if (confirmed || pending)
                                      OutlinedButton(
                                          onPressed: busy
                                              ? null
                                              : () async {
                                                  await Navigator.push(
                                                      context,
                                                      MaterialPageRoute(
                                                          builder: (_) =>
                                                              SlotsScreen(
                                                                  venueId: slot[
                                                                      'venueId'],
                                                                  rescheduleBookingId:
                                                                      b['id'],
                                                                  initialVenue:
                                                                      venue)));
                                                  if (mounted) _fetch();
                                                },
                                          child: const Text('Reschedule')),
                                    if (pending && b['payment'] != null)
                                      ElevatedButton(
                                          onPressed: busy
                                              ? null
                                              : () async {
                                                  setState(
                                                      () => _busy.add(b['id']));
                                                  try {
                                                    await PaymentService
                                                        .checkout(
                                                            b['payment']['id']);
                                                  } catch (_) {
                                                    if (context.mounted) {
                                                      ScaffoldMessenger.of(
                                                              context)
                                                          .showSnackBar(
                                                              const SnackBar(
                                                                  content: Text(
                                                                      'Checkout unavailable. Please try again later.')));
                                                    }
                                                  } finally {
                                                    if (mounted) {
                                                      setState(() => _busy
                                                          .remove(b['id']));
                                                      _fetch();
                                                    }
                                                  }
                                                },
                                          child:
                                              const Text('Complete payment')),
                                    if (scanned)
                                      OutlinedButton.icon(
                                          onPressed: () => Navigator.push(
                                              context,
                                              MaterialPageRoute(
                                                  builder: (_) =>
                                                      WriteReviewScreen(
                                                          bookingId: b['id'],
                                                          venueId: venue['id'],
                                                          venueName:
                                                              venue['name']))),
                                          icon: const Icon(Icons.star_outline,
                                              size: 18),
                                          label: const Text('Review')),
                                    if (confirmed || pending)
                                      TextButton(
                                          onPressed: busy
                                              ? null
                                              : () => _cancel(b['id']),
                                          style: TextButton.styleFrom(
                                              foregroundColor: colors.error),
                                          child: Text(busy
                                              ? 'Please wait…'
                                              : 'Cancel')),
                                  ]),
                                ])));
                  }),
              ])),
    );
  }
}
