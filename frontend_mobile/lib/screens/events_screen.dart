import '../services/api_errors.dart';
import '../services/live_refresh.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import '../services/payment_service.dart';

class EventsScreen extends StatefulWidget {
  const EventsScreen({super.key});

  @override
  State<EventsScreen> createState() => _EventsScreenState();
}

class _EventsScreenState extends State<EventsScreen>
    with LiveRefresh<EventsScreen> {
  @override
  List<String> get liveResources => ['events'];
  @override
  Future<void> refreshForLiveUpdates() => _fetchEvents();
  final ApiService _apiService = ApiService();
  List<dynamic> _events = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchEvents();
  }

  Future<void> _fetchEvents() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final res = await _apiService.dio.get('/events');
      if (!mounted) return;
      setState(() {
        _events = res.data['data'] ?? [];
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _error = 'Failed to load events. Tap to retry.';
      });
    }
  }

  void _showRegistrationDialog(Map<String, dynamic> ev) {
    final bool isFree = ev['fee'] == null || (ev['fee'] as num) == 0;
    showDialog(
        context: context,
        builder: (context) {
          return AlertDialog(
            title: const Text('Confirm Registration'),
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Event: ${ev['name']}',
                    style: const TextStyle(
                        fontWeight: FontWeight.bold, fontSize: 16)),
                const SizedBox(height: 8),
                if (!isFree)
                  Text('Fee: Rs. ${ev['fee']}',
                      style: const TextStyle(
                          color: Colors.green, fontWeight: FontWeight.bold))
                else
                  const Text('Fee: Free',
                      style: TextStyle(
                          color: Colors.green, fontWeight: FontWeight.bold)),
                const SizedBox(height: 16),
                Text(isFree
                    ? 'Would you like to register for this event?'
                    : 'To complete your registration, you will be redirected to our secure payment gateway to pay the fee. Your spot is only confirmed after the payment is verified.'),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Cancel'),
              ),
              ElevatedButton(
                onPressed: () {
                  Navigator.pop(context);
                  _processRegistration(ev['id'] as int);
                },
                child: Text(isFree ? 'Confirm' : 'Proceed to Pay'),
              ),
            ],
          );
        });
  }

  Future<void> _processRegistration(int eventId) async {
    try {
      final res = await _apiService.dio.post('/events/$eventId/register');
      if (res.data['success']) {
        var feedback = 'Registration saved.';
        if (res.data['data']?['paymentId'] != null) {
          feedback = 'Registration saved. Payment is pending until verified.';
          try {
            await PaymentService.checkout(res.data['data']['paymentId']);
          } catch (_) {
            feedback =
                'Registration saved. Online checkout is unavailable; contact staff to pay before the hold expires.';
          }
        }
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(feedback)),
        );
        _fetchEvents();
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text((e as dynamic).response?.data?['message'] ??
                'Registration failed')),
      );
    }
  }

  Future<void> _cancelRegistration(int eventId, int regId) async {
    final confirmed = await showDialog<bool>(
        context: context,
        builder: (c) => AlertDialog(
                title: const Text('Cancel registration?'),
                content: const Text(
                    'Cancel at least 2 hours before start. Paid fees are queued for a full refund; staff handles cash refunds.'),
                actions: [
                  TextButton(
                      onPressed: () => Navigator.pop(c, false),
                      child: const Text('Keep entry')),
                  TextButton(
                      onPressed: () => Navigator.pop(c, true),
                      child: const Text('Cancel entry'))
                ]));
    if (confirmed != true) return;
    try {
      await _apiService.dio
          .post('/events/$eventId/registrations/$regId/cancel');
      await _fetchEvents();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(apiErrorMessage(e))));
      }
    }
  }

  Color _statusColor(String? status) {
    switch (status) {
      case 'UPCOMING':
        return Theme.of(context).colorScheme.primary;
      case 'ONGOING':
        return Colors.orange;
      case 'COMPLETED':
        return Colors.green;
      default:
        return Colors.grey;
    }
  }

  String _typeLabel(String? type) {
    switch (type) {
      case 'TRAINING':
        return '🎯 Training';
      case 'COACHING':
        return '🏫 Coaching';
      case 'CAMP':
        return '⛺ Camp';
      case 'LEAGUE':
        return '🏆 League';
      case 'FRIENDLY':
        return '🤝 Friendly';
      default:
        return type ?? '';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Events & Camps')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.error_outline,
                          size: 48, color: Colors.grey),
                      const SizedBox(height: 16),
                      Text(_error!, style: const TextStyle(color: Colors.grey)),
                      const SizedBox(height: 16),
                      ElevatedButton(
                          onPressed: _fetchEvents, child: const Text('Retry')),
                    ],
                  ),
                )
              : _events.isEmpty
                  ? const Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.event_note, size: 64, color: Colors.grey),
                          SizedBox(height: 16),
                          Text('No events scheduled',
                              style:
                                  TextStyle(color: Colors.grey, fontSize: 16)),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _fetchEvents,
                      child: ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _events.length,
                        itemBuilder: (context, index) {
                          final ev = _events[index];
                          final bool isUpcoming = ev['status'] == 'UPCOMING';
                          final registrations =
                              (ev['registrations'] as List?) ?? [];
                          final registered = registrations.isNotEmpty;
                          final pending = registered &&
                              registrations.first['payment']?['status'] ==
                                  'PENDING';
                          final full = ev['maxParticipants'] != null &&
                              (ev['_count']?['registrations'] ?? 0) >=
                                  ev['maxParticipants'];

                          return Card(
                            margin: const EdgeInsets.only(bottom: 16),
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12)),
                            child: Padding(
                              padding: const EdgeInsets.all(16),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  // Header: name + status badge
                                  Row(
                                    mainAxisAlignment:
                                        MainAxisAlignment.spaceBetween,
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Expanded(
                                        child: Text(
                                          ev['name'] ?? 'Event',
                                          style: const TextStyle(
                                              fontSize: 18,
                                              fontWeight: FontWeight.bold),
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                            horizontal: 10, vertical: 4),
                                        decoration: BoxDecoration(
                                          color: _statusColor(
                                                  ev['status'] as String?)
                                              .withValues(alpha: 0.15),
                                          borderRadius:
                                              BorderRadius.circular(20),
                                        ),
                                        child: Text(
                                          ev['status'] ?? '',
                                          style: TextStyle(
                                            color: _statusColor(
                                                ev['status'] as String?),
                                            fontSize: 12,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 6),

                                  // Type label
                                  Text(
                                    _typeLabel(ev['type'] as String?),
                                    style: TextStyle(
                                        color: Theme.of(context)
                                            .colorScheme
                                            .primary,
                                        fontSize: 13),
                                  ),
                                  const SizedBox(height: 8),

                                  // Description — null safe
                                  if ((ev['description'] as String?) != null &&
                                      (ev['description'] as String).isNotEmpty)
                                    Text(
                                      ev['description'] as String,
                                      style:
                                          const TextStyle(color: Colors.grey),
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                    ),

                                  const SizedBox(height: 12),

                                  // Venue — null safe
                                  Row(
                                    children: [
                                      const Icon(Icons.location_on,
                                          size: 14, color: Colors.grey),
                                      const SizedBox(width: 4),
                                      Text(
                                        (ev['venue'] as String?) ?? 'Venue TBA',
                                        style: const TextStyle(
                                            color: Colors.grey, fontSize: 13),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 4),

                                  Text(
                                      '${DateFormat('dd MMM yyyy, HH:mm').format(DateTime.parse(ev['startDate']).toUtc().add(const Duration(hours: 5)))} PKT'),
                                  // Fee
                                  Row(
                                    children: [
                                      const Icon(Icons.payments_outlined,
                                          size: 14, color: Colors.grey),
                                      const SizedBox(width: 4),
                                      Text(
                                        (ev['fee'] != null &&
                                                (ev['fee'] as num) > 0)
                                            ? 'Rs. ${ev['fee']}'
                                            : 'Free',
                                        style: TextStyle(
                                          color: (ev['fee'] != null &&
                                                  (ev['fee'] as num) > 0)
                                              ? Colors.green
                                              : Colors.grey,
                                          fontWeight: FontWeight.bold,
                                          fontSize: 13,
                                        ),
                                      ),
                                    ],
                                  ),

                                  const SizedBox(height: 16),

                                  if (registered)
                                    TextButton(
                                        onPressed: () => _cancelRegistration(
                                            ev['id'],
                                            registrations.first['id']),
                                        child:
                                            const Text('Cancel registration')),
                                  const Text(
                                      'Unpaid places expire after 30 minutes. Cancel at least 2 hours before start for a full refund.'),
                                  // Register button
                                  SizedBox(
                                    width: double.infinity,
                                    child: ElevatedButton(
                                      onPressed: isUpcoming &&
                                              !registered &&
                                              !full
                                          ? () => _showRegistrationDialog(ev)
                                          : null,
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: isUpcoming
                                            ? const Color(0xFF174C36)
                                            : Colors.grey.shade600,
                                        shape: RoundedRectangleBorder(
                                            borderRadius:
                                                BorderRadius.circular(8)),
                                      ),
                                      child: Text(
                                        registered
                                            ? (pending
                                                ? 'Pending payment'
                                                : 'Registered')
                                            : full
                                                ? 'Full'
                                                : isUpcoming
                                                    ? (ev['fee'] != null &&
                                                            (ev['fee'] as num) >
                                                                0
                                                        ? 'Pay Rs. ${ev['fee']}'
                                                        : 'Register for Free')
                                                    : ev['status'] ?? 'Closed',
                                        style: const TextStyle(
                                            fontWeight: FontWeight.bold),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    ),
    );
  }
}
