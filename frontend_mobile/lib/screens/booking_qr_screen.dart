import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../services/api_service.dart';
import '../services/api_errors.dart';
import '../services/live_refresh.dart';
import '../widgets/clubhouse.dart';

class BookingQrScreen extends StatefulWidget {
  final int bookingId;
  const BookingQrScreen({super.key, required this.bookingId});
  @override
  State<BookingQrScreen> createState() => _BookingQrScreenState();
}

class _BookingQrScreenState extends State<BookingQrScreen>
    with LiveRefresh<BookingQrScreen>, WidgetsBindingObserver {
  Map<String, dynamic>? _data;
  String? _error;
  bool _fetching = false;
  Timer? _timer;
  DateTime? _serverTime;
  final _elapsed = Stopwatch();
  @override
  List<String> get liveResources => ['bookings'];
  @override
  Future<void> refreshForLiveUpdates() => _fetch();
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _fetch();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted && _data != null) setState(() {});
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _fetch();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _elapsed.stop();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  Future<void> _fetch() async {
    if (_fetching) return;
    _fetching = true;
    try {
      final response =
          await ApiService().dio.get('/bookings/${widget.bookingId}/qr');
      if (!mounted) return;
      setState(() {
        _data = Map<String, dynamic>.from(response.data['data']);
        _serverTime = DateTime.parse(_data!['entryPass']['serverTime']);
        _elapsed
          ..reset()
          ..start();
        _error = null;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = apiErrorMessage(e);
          _data = null;
        });
      }
    } finally {
      _fetching = false;
    }
  }

  String _time(DateTime value) =>
      DateFormat('h:mm a').format(value.toUtc().add(const Duration(hours: 5)));
  @override
  Widget build(BuildContext context) {
    final pass = _data?['entryPass'] as Map?;
    final start = DateTime.tryParse(pass?['validFrom']?.toString() ?? '');
    final end = DateTime.tryParse(pass?['expiresAt']?.toString() ?? '');
    final now = _serverTime?.add(_elapsed.elapsed);
    var status = pass?['status']?.toString();
    if (status == 'VALID' || status == 'UPCOMING') {
      if (end != null && now != null && !now.isBefore(end)) {
        status = 'EXPIRED';
      } else if (start != null && now != null && !now.isBefore(start)) {
        status = 'VALID';
      }
    }
    final showQr = (status == 'VALID' || status == 'UPCOMING') &&
        _data?['qrToken'] is String;
    final titles = {
      'VALID': 'Your entry pass',
      'UPCOMING': 'Your upcoming session',
      'EXPIRED': 'Session ended',
      'USED': 'You’re checked in',
      'CANCELLED': 'Booking cancelled',
      'PAYMENT_REQUIRED': 'Payment required'
    };
    final message = status == 'EXPIRED'
        ? 'This pass expired when your booked session ended.'
        : pass?['message']?.toString() ?? '';
    final booking = _data?['booking'] as Map?;
    final slot = booking?['slot'] as Map?;
    return Scaffold(
      appBar: AppBar(title: const Text('Entry pass')),
      body: _data == null && _error == null
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _fetch,
              child: ListView(padding: const EdgeInsets.all(24), children: [
                Center(
                    child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 460),
                        child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Container(
                                  padding: const EdgeInsets.all(24),
                                  decoration: BoxDecoration(
                                      color: clubhouseForest,
                                      borderRadius: BorderRadius.circular(22)),
                                  child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        const Text('SMART SPORTS HUB',
                                            style: TextStyle(
                                                color: Color(0xFFE1C789),
                                                letterSpacing: 2,
                                                fontSize: 11)),
                                        const SizedBox(height: 14),
                                        Text(titles[status] ?? 'Entry pass',
                                            style: const TextStyle(
                                                color: Colors.white,
                                                fontSize: 26,
                                                fontWeight: FontWeight.w700)),
                                        const SizedBox(height: 8),
                                        Text('Booking #${widget.bookingId}',
                                            style: const TextStyle(
                                                color: Colors.white70)),
                                      ])),
                              const SizedBox(height: 24),
                              if (_error != null) ...[
                                Text(_error!, textAlign: TextAlign.center),
                                TextButton(
                                    onPressed: _fetch,
                                    child: const Text('Try again')),
                              ] else ...[
                                Text(slot?['venue']?['name']?.toString() ?? '',
                                    style:
                                        Theme.of(context).textTheme.titleLarge),
                                if (booking?['user']?['name'] != null)
                                  Text(booking!['user']['name']),
                                const SizedBox(height: 8),
                                if (start != null && end != null) ...[
                                  Text(DateFormat('EEE, d MMM yyyy').format(
                                      start
                                          .toUtc()
                                          .add(const Duration(hours: 5)))),
                                  Text('${_time(start)} – ${_time(end)} PKT'),
                                ],
                                const SizedBox(height: 24),
                                if (showQr)
                                  Container(
                                      key: const ValueKey('booking-qr'),
                                      padding: const EdgeInsets.all(20),
                                      decoration: BoxDecoration(
                                          color: Colors.white,
                                          borderRadius:
                                              BorderRadius.circular(20)),
                                      child: Center(
                                          child: ConstrainedBox(
                                              constraints: const BoxConstraints(
                                                  maxWidth: 260),
                                              child: AspectRatio(
                                                  aspectRatio: 1,
                                                  child: QrImageView(
                                                    data: _data!['qrToken'],
                                                    padding:
                                                        const EdgeInsets.all(
                                                            16),
                                                    backgroundColor:
                                                        Colors.white,
                                                    eyeStyle: const QrEyeStyle(
                                                        eyeShape:
                                                            QrEyeShape.square,
                                                        color: Colors.black),
                                                    dataModuleStyle:
                                                        const QrDataModuleStyle(
                                                            dataModuleShape:
                                                                QrDataModuleShape
                                                                    .square,
                                                            color:
                                                                Colors.black),
                                                  )))))
                                else
                                  Icon(
                                      status == 'USED'
                                          ? Icons.check_circle_outline
                                          : Icons.event_busy_outlined,
                                      size: 64,
                                      color: Theme.of(context)
                                          .colorScheme
                                          .primary),
                                const SizedBox(height: 20),
                                Text(message, textAlign: TextAlign.center),
                                if (showQr && end != null) ...[
                                  const SizedBox(height: 12),
                                  Text(
                                      'Arrive during your booked session, before ${_time(end)} PKT. This pass expires at the session end and can be used once.',
                                      textAlign: TextAlign.center,
                                      style: const TextStyle(
                                          fontWeight: FontWeight.w600,
                                          height: 1.5)),
                                  const SizedBox(height: 16),
                                  OutlinedButton.icon(
                                      onPressed: () async {
                                        await Clipboard.setData(ClipboardData(
                                            text: _data!['qrToken']));
                                        if (!context.mounted) return;
                                        ScaffoldMessenger.of(context)
                                            .showSnackBar(const SnackBar(
                                                content:
                                                    Text('Entry code copied')));
                                      },
                                      icon: const Icon(Icons.copy_outlined),
                                      label: const Text('Copy entry code')),
                                ],
                              ],
                            ]))),
              ]),
            ),
    );
  }
}
