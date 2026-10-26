import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import '../services/api_errors.dart';
import '../utils/arena_desk.dart';
import '../widgets/clubhouse.dart';
import 'entry_qr_scanner_screen.dart';

class CheckInScreen extends StatefulWidget {
  const CheckInScreen({super.key});
  @override
  State<CheckInScreen> createState() => _CheckInScreenState();
}

class _CheckInScreenState extends State<CheckInScreen> {
  final _token = TextEditingController();
  bool _busy = false;
  String? _error;
  Map<String, dynamic>? _booking;
  @override
  void dispose() {
    _token.dispose();
    super.dispose();
  }

  Future<void> _paste() async {
    try {
      final content = await Clipboard.getData(Clipboard.kTextPlain);
      if (!mounted) return;
      if (content?.text?.trim().isNotEmpty != true) {
        setState(
            () => _error = 'Your clipboard does not contain an entry code.');
        return;
      }
      _token.text = content!.text!.trim();
      setState(() => _error = null);
    } catch (_) {
      if (mounted) {
        setState(() =>
            _error = 'Press and hold the field to paste your entry code.');
      }
    }
  }

  Future<void> _scan() async {
    final value = await Navigator.of(context).push<String>(
        MaterialPageRoute(builder: (_) => const EntryQrScannerScreen()));
    if (!mounted || value == null) return;
    _token.text = value;
    setState(() => _error = null);
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content:
            Text('QR captured. Tap Verify & check in to confirm arrival.')));
  }

  Future<void> _checkIn() async {
    if (_busy) return;
    var value = _token.text.trim();
    try {
      final decoded = jsonDecode(value);
      if (decoded is Map && decoded['token'] is String) {
        value = (decoded['token'] as String).trim();
      }
    } catch (_) {}
    if (value.isEmpty) {
      setState(() => _error = 'Enter the code from the player’s booking pass.');
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final response = await ApiService()
          .dio
          .post('/bookings/scan', data: {'qrToken': value});
      if (mounted) {
        setState(() {
          _booking = Map<String, dynamic>.from(response.data['data']);
          _token.clear();
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = apiErrorMessage(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _passHeader(ColorScheme colors) => Container(
        key: const ValueKey('entry-pass-header'),
        padding: const EdgeInsets.all(22),
        decoration: BoxDecoration(
            color: clubhouseForest, borderRadius: BorderRadius.circular(22)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
            Container(
              width: 58,
              height: 64,
              decoration: BoxDecoration(
                  color: const Color(0xFFF5F3E9),
                  borderRadius: BorderRadius.circular(13)),
              child: const Center(
                  child: Icon(Icons.qr_code_2_rounded,
                      size: 38, color: clubhouseForest)),
            ),
            const SizedBox(width: 16),
            Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                  const Text('ARENA DESK',
                      style: TextStyle(
                          color: Color(0xFFE1C789),
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.8)),
                  const SizedBox(height: 7),
                  Text('Player entry',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          color: Colors.white, fontWeight: FontWeight.w700)),
                ])),
          ]),
          const Padding(
              padding: EdgeInsets.symmetric(vertical: 18),
              child: Divider(height: 1, color: Color(0xFF527260))),
          const Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(Icons.verified_user_outlined,
                size: 18, color: Color(0xFFE1C789)),
            SizedBox(width: 9),
            Expanded(
                child: Text('One booking. One welcome.',
                    style: TextStyle(
                        color: Color(0xFFE2ECDD), fontSize: 13, height: 1.4))),
          ]),
        ]),
      );

  Widget _input(ColorScheme colors) =>
      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const SizedBox(height: 28),
        const ClubhouseHeading('Welcome them in.',
            subtitle: 'Use their booking pass to confirm arrival.'),
        const SizedBox(height: 24),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: _busy ? null : _scan,
            icon: const Icon(Icons.qr_code_scanner_rounded),
            label: const Text('Scan QR code'),
          ),
        ),
        const SizedBox(height: 16),
        Card(
            margin: EdgeInsets.zero,
            child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Wrap(
                          alignment: WrapAlignment.spaceBetween,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          spacing: 12,
                          runSpacing: 4,
                          children: [
                            Text('Entry pass code',
                                style: Theme.of(context)
                                    .textTheme
                                    .titleSmall
                                    ?.copyWith(fontWeight: FontWeight.w700)),
                            TextButton.icon(
                                onPressed: _busy ? null : _paste,
                                icon: const Icon(Icons.content_paste_rounded,
                                    size: 17),
                                label: const Text('Paste code')),
                          ]),
                      const SizedBox(height: 10),
                      TextField(
                        key: const ValueKey('entry-code'),
                        controller: _token,
                        enabled: !_busy,
                        minLines: 2,
                        maxLines: 4,
                        autocorrect: false,
                        enableSuggestions: false,
                        decoration: const InputDecoration(
                            hintText: 'Enter or paste the pass code',
                            contentPadding: EdgeInsets.all(16)),
                        onChanged: (_) {
                          if (_error != null) setState(() => _error = null);
                        },
                      ),
                      const SizedBox(height: 12),
                      Text('The full text from a booking QR code works too.',
                          style: Theme.of(context)
                              .textTheme
                              .bodySmall
                              ?.copyWith(
                                  color: colors.onSurfaceVariant, height: 1.5)),
                      const SizedBox(height: 22),
                      SizedBox(
                          width: double.infinity,
                          child: ElevatedButton.icon(
                            key: const ValueKey('verify-entry'),
                            onPressed: _busy ? null : _checkIn,
                            style: ElevatedButton.styleFrom(
                                minimumSize: const Size(0, 54)),
                            icon: _busy
                                ? const SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(
                                        strokeWidth: 2, color: Colors.white))
                                : const Icon(Icons.how_to_reg_outlined,
                                    size: 21),
                            label: Text(_busy
                                ? 'Verifying pass…'
                                : 'Verify & check in'),
                          )),
                    ]))),
        if (_error != null) ...[
          const SizedBox(height: 16),
          Semantics(
              liveRegion: true,
              child: Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                    color: colors.errorContainer,
                    borderRadius: BorderRadius.circular(16)),
                child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(Icons.info_outline_rounded,
                          color: colors.onErrorContainer, size: 22),
                      const SizedBox(width: 12),
                      Expanded(
                          child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                            Text('Please check the pass',
                                style: TextStyle(
                                    color: colors.onErrorContainer,
                                    fontWeight: FontWeight.w700)),
                            const SizedBox(height: 6),
                            Text(_error!,
                                style: TextStyle(
                                    color: colors.onErrorContainer,
                                    height: 1.5)),
                          ])),
                    ]),
              )),
        ],
        const SizedBox(height: 24),
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(Icons.schedule_outlined,
              size: 19, color: colors.onSurfaceVariant),
          const SizedBox(width: 10),
          Expanded(
              child: Text(
                  'Check in any time during the booked session, before it ends. Each pass can be used once.',
                  style: Theme.of(context)
                      .textTheme
                      .bodySmall
                      ?.copyWith(color: colors.onSurfaceVariant, height: 1.5))),
        ]),
      ]);

  Widget _receipt(ColorScheme colors) {
    final booking = _booking!;
    final slot = booking['slot'] as Map?;
    final venue = slot?['venue'] as Map?;
    final user = booking['user'] as Map?;
    return Semantics(
        liveRegion: true,
        child:
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const SizedBox(height: 28),
          Card(
              margin: EdgeInsets.zero,
              child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                            width: 54,
                            height: 54,
                            decoration: BoxDecoration(
                                color: colors.primaryContainer,
                                shape: BoxShape.circle),
                            child: Icon(Icons.check_rounded,
                                color: colors.onPrimaryContainer, size: 30)),
                        const SizedBox(height: 18),
                        Text('Checked in',
                            style: Theme.of(context)
                                .textTheme
                                .labelLarge
                                ?.copyWith(
                                    color: colors.primary,
                                    fontWeight: FontWeight.w700)),
                        const SizedBox(height: 8),
                        Text(user?['name'] ?? 'Player',
                            style: Theme.of(context)
                                .textTheme
                                .headlineSmall
                                ?.copyWith(fontWeight: FontWeight.w700)),
                        const SizedBox(height: 8),
                        Text('Booking #${booking['id']}',
                            style: TextStyle(color: colors.onSurfaceVariant)),
                        if (venue?['name'] != null) ...[
                          const SizedBox(height: 20),
                          Text(venue!['name'],
                              style:
                                  const TextStyle(fontWeight: FontWeight.w600))
                        ],
                        if (slot?['date'] != null) ...[
                          const SizedBox(height: 8),
                          Text(DateFormat('EEE, d MMM yyyy')
                              .format(DateTime.parse(slot!['date'].toString())))
                        ],
                        if (slot?['startTime'] != null &&
                            slot?['endTime'] != null) ...[
                          const SizedBox(height: 6),
                          Text(
                              '${arenaTime(slot!['startTime'])} – ${arenaTime(slot['endTime'])} · PKT')
                        ],
                        const SizedBox(height: 20),
                        Text(
                            'Arrival recorded. This entry pass has now been used.',
                            style: TextStyle(
                                color: colors.onSurfaceVariant, height: 1.5)),
                      ]))),
          const SizedBox(height: 20),
          ElevatedButton.icon(
              onPressed: () => setState(() {
                    _booking = null;
                    _error = null;
                  }),
              icon: const Icon(Icons.arrow_forward_rounded, size: 20),
              label: const Text('Verify another pass')),
        ]));
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: const Text('Verify an entry pass')),
      body: SafeArea(
          child: Center(
              child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 560),
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(20, 20, 20, 36),
                    children: [
                      _passHeader(colors),
                      if (_booking == null) _input(colors) else _receipt(colors)
                    ],
                  )))),
    );
  }
}
