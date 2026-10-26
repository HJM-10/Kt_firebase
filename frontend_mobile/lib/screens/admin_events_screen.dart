import 'event_attendance_screen.dart';
import 'package:flutter/material.dart';
import '../services/api_service.dart';

class AdminEventsScreen extends StatefulWidget {
  const AdminEventsScreen({super.key});

  @override
  State<AdminEventsScreen> createState() => _AdminEventsScreenState();
}

class _AdminEventsScreenState extends State<AdminEventsScreen> {
  final ApiService _apiService = ApiService();
  List<dynamic> _events = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchEvents();
  }

  Future<void> _fetchEvents() async {
    setState(() => _isLoading = true);
    try {
      final res = await _apiService.dio.get('/events');
      if (mounted) {
        setState(() {
          _events = res.data['data'];
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _deleteEvent(int id) async {
    try {
      await _apiService.dio.delete('/events/$id');
      _fetchEvents();
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Event deleted')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Failed to delete event')));
      }
    }
  }

  void _showAddEventDialog({dynamic event}) async {
    final nameCtrl = TextEditingController(text: event?['name'] ?? '');
    final venueCtrl = TextEditingController(text: event?['venue'] ?? '');
    final capacityCtrl =
        TextEditingController(text: '${event?['maxParticipants'] ?? 50}');
    final feeCtrl = TextEditingController(
        text: event != null ? event['fee'].toString() : '');

    // Fetch sports for dropdown
    List<dynamic> sports = [];
    try {
      final res = await _apiService.dio.get('/sports');
      sports = res.data['data'];
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Failed to load sports')));
      }
      return;
    }

    if (!mounted || sports.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Please add a sport first')));
      }
      return;
    }

    int selectedSportId = event != null ? event['sportId'] : sports.first['id'];
    DateTime? selectedDate =
        event != null ? DateTime.parse(event['startDate']) : null;

    if (!mounted) return;

    showDialog(
        context: context,
        builder: (context) {
          return StatefulBuilder(builder: (context, setDialogState) {
            InputDecoration inputDeco(String label, IconData icon) {
              return InputDecoration(
                labelText: label,
                prefixIcon:
                    Icon(icon, color: Theme.of(context).colorScheme.primary),
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide.none),
                filled: true,
                fillColor: Theme.of(context).brightness == Brightness.dark
                    ? Colors.white.withValues(alpha: 0.05)
                    : Colors.black.withValues(alpha: 0.05),
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              );
            }

            return Dialog(
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(20)),
              child: Padding(
                padding: const EdgeInsets.all(24.0),
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(event == null ? 'Create New Event' : 'Edit Event',
                          style: const TextStyle(
                              fontSize: 22, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 20),
                      TextField(
                        controller: nameCtrl,
                        decoration: inputDeco('Event Name', Icons.event),
                      ),
                      const SizedBox(height: 16),
                      TextField(
                        controller: venueCtrl,
                        decoration: inputDeco('Venue Name', Icons.location_on),
                      ),
                      const SizedBox(height: 16),
                      TextField(
                        controller: feeCtrl,
                        decoration:
                            inputDeco('Fee (0 for free)', Icons.attach_money),
                        keyboardType: TextInputType.number,
                      ),
                      const SizedBox(height: 16),
                      DropdownButtonFormField<int>(
                        initialValue: selectedSportId,
                        items: sports
                            .map((s) => DropdownMenuItem<int>(
                                  value: s['id'],
                                  child: Text(s['name']),
                                ))
                            .toList(),
                        onChanged: (val) =>
                            setDialogState(() => selectedSportId = val!),
                        decoration: inputDeco('Sport', Icons.sports_soccer),
                        icon: Icon(Icons.arrow_drop_down,
                            color: Theme.of(context).colorScheme.primary),
                      ),
                      const SizedBox(height: 16),
                      TextField(
                          controller: capacityCtrl,
                          keyboardType: TextInputType.number,
                          decoration:
                              inputDeco('Maximum participants', Icons.people)),
                      const SizedBox(height: 16),
                      InkWell(
                        onTap: () async {
                          final d = await showDatePicker(
                            context: context,
                            initialDate:
                                DateTime.now().add(const Duration(days: 1)),
                            firstDate: DateTime.now(),
                            lastDate:
                                DateTime.now().add(const Duration(days: 365)),
                          );
                          if (d == null || !context.mounted) return;
                          final clock = await showTimePicker(
                              context: context,
                              initialTime:
                                  const TimeOfDay(hour: 10, minute: 0));
                          if (clock != null) {
                            setDialogState(() => selectedDate = DateTime(d.year,
                                d.month, d.day, clock.hour, clock.minute));
                          }
                        },
                        borderRadius: BorderRadius.circular(12),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 14),
                          decoration: BoxDecoration(
                            color:
                                Theme.of(context).brightness == Brightness.dark
                                    ? Colors.white.withValues(alpha: 0.05)
                                    : Colors.black.withValues(alpha: 0.05),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Row(
                            children: [
                              Icon(Icons.calendar_today,
                                  color: Theme.of(context).colorScheme.primary),
                              const SizedBox(width: 12),
                              Text(
                                selectedDate == null
                                    ? 'Select Event Date'
                                    : selectedDate.toString().substring(0, 16),
                                style: TextStyle(
                                  color: selectedDate == null
                                      ? Colors.grey
                                      : Theme.of(context)
                                          .textTheme
                                          .bodyLarge
                                          ?.color,
                                  fontSize: 16,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 24),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          TextButton(
                            onPressed: () => Navigator.pop(context),
                            child: const Text('Cancel',
                                style: TextStyle(color: Colors.grey)),
                          ),
                          const SizedBox(width: 12),
                          ElevatedButton(
                            onPressed: () async {
                              if (nameCtrl.text.isEmpty ||
                                  selectedDate == null) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                        content: Text(
                                            'Name and Date are required')));
                                return;
                              }
                              try {
                                final data = {
                                  'name': nameCtrl.text,
                                  'sportId': selectedSportId,
                                  'startDate':
                                      selectedDate!.toUtc().toIso8601String(),
                                  'venue': venueCtrl.text,
                                  'maxParticipants':
                                      int.tryParse(capacityCtrl.text),
                                  'fee': feeCtrl.text.isNotEmpty
                                      ? num.parse(feeCtrl.text)
                                      : 0,
                                };
                                if (event == null) {
                                  await _apiService.dio
                                      .post('/events', data: data);
                                } else {
                                  await _apiService.dio.put(
                                      '/events/${event['id']}',
                                      data: data);
                                }
                                if (context.mounted) Navigator.pop(context);
                                _fetchEvents();
                              } catch (e) {
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                          content: Text(
                                              'Error ${event == null ? 'adding' : 'editing'} event')));
                                }
                              }
                            },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF174C36),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 24, vertical: 12),
                              shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(8)),
                            ),
                            child: Text(
                                event == null ? 'Create Event' : 'Save Changes',
                                style: const TextStyle(
                                    fontWeight: FontWeight.bold)),
                          )
                        ],
                      )
                    ],
                  ),
                ),
              ),
            );
          });
        });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Manage Events')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              itemCount: _events.length,
              itemBuilder: (context, index) {
                final ev = _events[index];
                return ListTile(
                  title: Text(ev['name']),
                  onTap: () => Navigator.push(
                      context,
                      MaterialPageRoute(
                          builder: (_) => EventAttendanceScreen(id: ev['id']))),
                  subtitle: Text('Venue: ${(ev['venue'] as String?) ?? 'N/A'}'),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                          icon: Icon(Icons.edit,
                              color: Theme.of(context).colorScheme.primary),
                          onPressed: () => _showAddEventDialog(event: ev)),
                      IconButton(
                          icon: const Icon(Icons.delete, color: Colors.red),
                          onPressed: () => _deleteEvent(ev['id'])),
                    ],
                  ),
                );
              },
            ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showAddEventDialog(),
        child: const Icon(Icons.add),
      ),
    );
  }
}
