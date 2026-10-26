import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../services/api_service.dart';
import '../../services/api_errors.dart';
import '../../services/live_refresh.dart';
import '../../utils/arena_desk.dart';
import '../../widgets/clubhouse.dart';
import '../../widgets/arena_desk.dart';
import 'walk_in_screen.dart';

class AdminSessionsScreen extends StatefulWidget {
  final Map<String, dynamic> venue;
  final DateTime date;
  const AdminSessionsScreen(
      {super.key, required this.venue, required this.date});
  @override
  State<AdminSessionsScreen> createState() => _AdminSessionsScreenState();
}

class _AdminSessionsScreenState extends State<AdminSessionsScreen>
    with LiveRefresh<AdminSessionsScreen> {
  late DateTime _date;
  late Map<String, dynamic> _venue;
  List<Map<String, dynamic>> _slots = [];
  bool _loading = true, _saving = false;
  String? _error;
  int _version = 0;
  @override
  List<String> get liveResources => ['bookings', 'venues'];
  @override
  Future<void> refreshForLiveUpdates() => _load();
  @override
  void initState() {
    super.initState();
    _date = widget.date;
    _venue = Map<String, dynamic>.from(widget.venue);
    _load();
  }

  Future<void> _load() async {
    final version = ++_version;
    setState(() => _loading = true);
    try {
      final response = await Future.wait([
        ApiService().dio.get('/venues/${widget.venue['id']}'),
        ApiService().dio.get('/bookings/slots', queryParameters: {
          'venueId': widget.venue['id'],
          'date': arenaDate(_date)
        }),
      ]);
      if (mounted && version == _version) {
        setState(() {
          _venue = Map<String, dynamic>.from(response[0].data['data']);
          _slots = arenaMaps(response[1].data['data']);
          _error = null;
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

  Future<void> _publish() async {
    if (_saving || _loading || _error != null) return;
    setState(() => _saving = true);
    try {
      final start = await showTimePicker(
          context: context, initialTime: const TimeOfDay(hour: 9, minute: 0));
      if (start == null || !mounted) return;
      final end = await showTimePicker(
          context: context, initialTime: const TimeOfDay(hour: 10, minute: 0));
      if (end == null || !mounted) return;
      String time(TimeOfDay t) =>
          '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';
      if (end.hour * 60 + end.minute <= start.hour * 60 + start.minute) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('Choose an end time after the start time.')));
        return;
      }
      await ApiService().dio.post('/bookings/slots', data: {
        'venueId': widget.venue['id'],
        'date': arenaDate(_date),
        'startTime': time(start),
        'endTime': time(end)
      });
      if (mounted) {
        await _load();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Session published.')));
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(apiErrorMessage(e))));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final venue = _venue, colors = Theme.of(context).colorScheme;
    final active =
        venue['isActive'] != false && venue['sport']?['isActive'] != false;
    return Scaffold(
        appBar: AppBar(title: const Text('Manage sessions')),
        body: ListView(padding: const EdgeInsets.all(20), children: [
          ClipRRect(
              borderRadius: BorderRadius.circular(18),
              child: ClubhouseImage(
                  sport: venue['sport']?['name'] ?? '',
                  imageUrl: venue['imageUrl'],
                  height: 160)),
          const SizedBox(height: 18),
          ClubhouseHeading(venue['name'],
              subtitle: 'Publish the times customers can book.'),
          const SizedBox(height: 16),
          OutlinedButton.icon(
              onPressed: _saving
                  ? null
                  : () async {
                      final day = await showDatePicker(
                          context: context,
                          initialDate: _date,
                          firstDate: DateTime(2020),
                          lastDate:
                              arenaToday().add(const Duration(days: 3650)));
                      if (day != null && mounted) {
                        setState(() => _date = day);
                        _load();
                      }
                    },
              icon: const ArenaIcon(ArenaSymbol.calendar, size: 18),
              label: Text(DateFormat.yMMMd().format(_date))),
          Text(
              'Pakistan time · ${clubPrice(venue['pricePerSlot'])} per session',
              style: TextStyle(color: colors.onSurfaceVariant)),
          const SizedBox(height: 20),
          if (_loading)
            const Center(child: CircularProgressIndicator())
          else if (_error != null)
            ArenaEmpty(
                title: 'Sessions could not load',
                message: _error!,
                onRetry: _load)
          else if (_slots.isEmpty)
            const ArenaEmpty(
                title: 'A clear schedule.',
                message: 'Publish a session to make this facility bookable.')
          else
            ..._slots.map((slot) {
              final past = !arenaInstant(arenaDate(_date), slot['startTime'])
                  .isAfter(DateTime.now());
              return Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                                '${arenaTime(slot['startTime'])} – ${arenaTime(slot['endTime'])}',
                                style: const TextStyle(
                                    fontSize: 18, fontWeight: FontWeight.w700)),
                            const SizedBox(height: 10),
                            Wrap(
                                spacing: 12,
                                runSpacing: 8,
                                crossAxisAlignment: WrapCrossAlignment.center,
                                children: [
                                  ArenaStatus(slot['isBooked'] == true
                                      ? 'Reserved'
                                      : past
                                          ? 'Past session'
                                          : 'Open session'),
                                  if (slot['isBooked'] != true &&
                                      !past &&
                                      active)
                                    TextButton(
                                        onPressed: () async {
                                          await Navigator.push(
                                              context,
                                              MaterialPageRoute(
                                                  builder: (_) =>
                                                      AdminWalkInScreen(
                                                          venues: [venue],
                                                          date: _date,
                                                          venueId: venue['id'],
                                                          slotId: slot['id'])));
                                          if (mounted) _load();
                                        },
                                        child: const Text('Add walk-in'))
                                ]),
                          ])));
            }),
        ]),
        bottomNavigationBar: SafeArea(
            top: false,
            child: Padding(
                padding: const EdgeInsets.all(16),
                child: ElevatedButton(
                    onPressed: _saving ||
                            _loading ||
                            _error != null ||
                            !active ||
                            _date.isBefore(arenaToday())
                        ? null
                        : _publish,
                    child:
                        Text(_saving ? 'Publishing…' : 'Publish a session')))));
  }
}
