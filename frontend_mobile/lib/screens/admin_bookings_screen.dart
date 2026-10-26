import 'package:flutter/material.dart';
import '../services/api_service.dart';
import 'sports_screen.dart';

class AdminBookingsScreen extends StatefulWidget {
  const AdminBookingsScreen({super.key});

  @override
  State<AdminBookingsScreen> createState() => _AdminBookingsScreenState();
}

class _AdminBookingsScreenState extends State<AdminBookingsScreen> {
  final ApiService _apiService = ApiService();
  List<dynamic> _bookings = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchBookings();
  }

  Future<void> _fetchBookings() async {
    setState(() => _isLoading = true);
    try {
      final res = await _apiService.dio.get('/bookings');
      if (mounted) {
        setState(() {
          _bookings = res.data['data'];
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _confirmBooking(int id) async {
    final received = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => AlertDialog(
              title: const Text('Record payment received'),
              content: const Text(
                  'Confirm only after collecting the full payment in person.'),
              actions: [
                TextButton(
                    onPressed: () => Navigator.pop(dialogContext, false),
                    child: const Text('Cancel')),
                TextButton(
                    onPressed: () => Navigator.pop(dialogContext, true),
                    child: const Text('Money received'))
              ],
            ));
    if (received != true) return;
    try {
      await _apiService.dio
          .put('/bookings/$id/confirm', data: {'receivedInPerson': true});
      _fetchBookings();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Failed to confirm')));
      }
    }
  }

  Widget _buildStatusBadge(String status) {
    Color color;
    switch (status) {
      case 'CONFIRMED':
        color = Colors.green;
        break;
      case 'PENDING_PAYMENT':
        color = Colors.orange;
        break;
      case 'CANCELLED':
        color = Colors.red;
        break;
      case 'SCANNED':
        color = Theme.of(context).colorScheme.primary;
        break;
      default:
        color = Colors.grey;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
          color: color.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(12)),
      child: Text(status,
          style: TextStyle(
              color: color, fontSize: 12, fontWeight: FontWeight.bold)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Manage Bookings')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: _bookings.length,
              itemBuilder: (context, index) {
                final b = _bookings[index];
                final dateStr =
                    b['slot']?['date']?.toString().split('T')[0] ?? 'N/A';
                final startTime = b['slot']?['startTime'] ?? 'N/A';
                final venueName =
                    b['slot']?['venue']?['name'] ?? 'Unknown Venue';
                final userName =
                    b['user']?['name'] ?? b['walkInName'] ?? 'Walk-in User';

                return Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16)),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                                child: Text(venueName,
                                    style: const TextStyle(
                                        fontWeight: FontWeight.bold,
                                        fontSize: 16),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis)),
                            _buildStatusBadge(b['status']),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            const Icon(Icons.calendar_today,
                                size: 14, color: Colors.grey),
                            const SizedBox(width: 4),
                            Text('$dateStr at $startTime',
                                style: const TextStyle(color: Colors.grey)),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            const Icon(Icons.person,
                                size: 14, color: Colors.grey),
                            const SizedBox(width: 4),
                            Text(userName,
                                style: const TextStyle(color: Colors.grey)),
                            const Spacer(),
                            Text('Rs. ${b['finalPrice'] ?? 0}',
                                style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                    color: Colors.green)),
                          ],
                        ),
                        if (b['status'] == 'PENDING_PAYMENT') ...[
                          const Divider(height: 24),
                          SizedBox(
                            width: double.infinity,
                            child: ElevatedButton(
                              onPressed: () => _confirmBooking(b['id']),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.green,
                                foregroundColor: Colors.white,
                                shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(8)),
                              ),
                              child: const Text('Mark as Confirmed / Paid'),
                            ),
                          )
                        ]
                      ],
                    ),
                  ),
                );
              },
            ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          Navigator.push(
              context, MaterialPageRoute(builder: (_) => const SportsScreen()));
        },
        icon: const Icon(Icons.add),
        label: const Text('New Booking'),
      ),
    );
  }
}
