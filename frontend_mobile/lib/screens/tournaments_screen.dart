import 'tournament_details_screen.dart';
import '../services/live_refresh.dart';
import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/payment_service.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import 'package:intl/intl.dart';
import '../utils/icon_helper.dart';

class TournamentsScreen extends StatefulWidget {
  const TournamentsScreen({super.key});

  @override
  State<TournamentsScreen> createState() => _TournamentsScreenState();
}

class _TournamentsScreenState extends State<TournamentsScreen>
    with LiveRefresh<TournamentsScreen> {
  @override
  List<String> get liveResources => ['tournaments'];
  @override
  Future<void> refreshForLiveUpdates() => _fetchTournaments();
  final ApiService _apiService = ApiService();
  List<dynamic> _tournaments = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchTournaments();
  }

  Future<void> _fetchTournaments() async {
    try {
      final res = await _apiService.dio.get('/tournaments');
      if (mounted) {
        setState(() {
          _tournaments = res.data['data'];
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to load tournaments')),
        );
      }
    }
  }

  final Set<int> _registeredIds = {};

  void _showRegistrationDialog(Map<String, dynamic> t) {
    final bool isFree = t['entryFee'] == null || (t['entryFee'] as num) == 0;
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
                Text('Tournament: ${t['name']}',
                    style: const TextStyle(
                        fontWeight: FontWeight.bold, fontSize: 16)),
                const SizedBox(height: 8),
                if (!isFree)
                  Text('Fee: Rs. ${t['entryFee']}',
                      style: const TextStyle(
                          color: Colors.green, fontWeight: FontWeight.bold))
                else
                  const Text('Fee: Free',
                      style: TextStyle(
                          color: Colors.green, fontWeight: FontWeight.bold)),
                const SizedBox(height: 16),
                Text(isFree
                    ? 'Would you like to register for this tournament?'
                    : 'To complete your registration, you will be redirected to our secure payment gateway to pay the fee. Your team spot is only confirmed after the payment is verified.'),
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
                  _processRegistration(t['id'] as int);
                },
                child: Text(isFree ? 'Confirm' : 'Proceed to Pay'),
              ),
            ],
          );
        });
  }

  Future<void> _processRegistration(int tournamentId) async {
    final user = context.read<AuthProvider>().user;
    if (user == null) return;

    try {
      final response = await _apiService.dio
          .post('/tournaments/$tournamentId/register', data: {
        'teamName': '${user['name']}\'s Team',
      });
      var feedback = 'Registration saved.';
      if (response.data['data']['paymentId'] != null) {
        feedback = 'Registration saved. Payment is pending until verified.';
        try {
          await PaymentService.checkout(response.data['data']['paymentId']);
        } catch (_) {
          feedback =
              'Registration saved. Online checkout is unavailable; contact staff to pay before the hold expires.';
        }
      }
      if (!mounted) return;
      setState(() {
        _registeredIds.add(tournamentId);
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(feedback)),
        );
      }
      _fetchTournaments();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text((e as dynamic).response?.data['message'] ??
                  'Failed to register')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Tournaments')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _tournaments.isEmpty
              ? const Center(
                  child: Text('No tournaments available',
                      style: TextStyle(color: Colors.grey)))
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _tournaments.length,
                  itemBuilder: (context, index) {
                    final t = _tournaments[index];
                    final registrations = (t['registrations'] as List?) ?? [];
                    final registered = registrations.isNotEmpty ||
                        _registeredIds.contains(t['id']);
                    final pending = registrations.isNotEmpty &&
                        registrations.first['payment']?['status'] == 'PENDING';
                    final open = t['status'] == 'UPCOMING' &&
                        ((t['_count']?['registrations'] ?? 0) as num) <
                            (t['maxTeams'] as num);
                    final dateStr = DateFormat.yMMMd()
                        .format(DateTime.parse(t['startDate']));

                    return Card(
                      margin: const EdgeInsets.only(bottom: 16),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                      child: Padding(
                        padding: const EdgeInsets.all(16.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: Theme.of(context)
                                    .colorScheme
                                    .primary
                                    .withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(IconHelper.getIcon(t['sport']?['icon']),
                                      size: 14,
                                      color: Theme.of(context)
                                          .colorScheme
                                          .primary),
                                  const SizedBox(width: 4),
                                  Text(
                                    t['sport']?['name'] ?? '',
                                    style: TextStyle(
                                        color: Theme.of(context)
                                            .colorScheme
                                            .primary,
                                        fontSize: 12,
                                        fontWeight: FontWeight.bold),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 12),
                            Text(
                              t['name'],
                              style: const TextStyle(
                                  fontSize: 18, fontWeight: FontWeight.bold),
                            ),
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                const Icon(Icons.calendar_today,
                                    size: 14, color: Colors.grey),
                                const SizedBox(width: 4),
                                Text(dateStr,
                                    style: const TextStyle(
                                        color: Colors.grey, fontSize: 13)),
                                const SizedBox(width: 16),
                                const Icon(Icons.people,
                                    size: 14, color: Colors.grey),
                                const SizedBox(width: 4),
                                Text(
                                    '${t['_count']?['registrations'] ?? 0}/${t['maxTeams']} Teams',
                                    style: const TextStyle(
                                        color: Colors.grey, fontSize: 13)),
                              ],
                            ),
                            const SizedBox(height: 16),
                            const Divider(color: Colors.white12),
                            const SizedBox(height: 8),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  t['status'],
                                  style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    color: t['status'] == 'UPCOMING'
                                        ? Theme.of(context).colorScheme.primary
                                        : (t['status'] == 'ONGOING'
                                            ? Colors.orange
                                            : Colors.green),
                                  ),
                                ),
                                TextButton(
                                    onPressed: () => Navigator.push(
                                        context,
                                        MaterialPageRoute(
                                            builder: (_) =>
                                                TournamentDetailsScreen(
                                                    id: t['id']))),
                                    child: const Text('Results')),
                                if (t['status'] == 'UPCOMING')
                                  ElevatedButton(
                                    onPressed: registered || !open
                                        ? null
                                        : () => _showRegistrationDialog(
                                            t as Map<String, dynamic>),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: registered
                                          ? Colors.green
                                          : const Color(0xFF174C36),
                                      shape: RoundedRectangleBorder(
                                          borderRadius:
                                              BorderRadius.circular(8)),
                                    ),
                                    child: Text(registered
                                        ? (pending
                                            ? 'Pending payment'
                                            : 'Registered')
                                        : !open
                                            ? 'Registration closed'
                                            : (t['entryFee'] != null &&
                                                    (t['entryFee'] as num) > 0
                                                ? 'Pay Rs. ${t['entryFee']}'
                                                : 'Register for Free')),
                                  ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}
