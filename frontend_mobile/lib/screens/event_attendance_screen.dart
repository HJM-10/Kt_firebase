import 'package:intl/intl.dart';
import '../utils/arena_desk.dart';
import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/api_errors.dart';

class EventAttendanceScreen extends StatefulWidget {
  final int id;
  const EventAttendanceScreen({super.key, required this.id});
  @override
  State<EventAttendanceScreen> createState() => _EventAttendanceScreenState();
}

class _EventAttendanceScreenState extends State<EventAttendanceScreen> {
  Map<String, dynamic>? data;
  String? error;
  bool busy = false;
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final r = await ApiService().dio.get('/events/${widget.id}');
      if (mounted) {
        setState(() {
          data = Map<String, dynamic>.from(r.data['data']);
          error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => error = apiErrorMessage(e));
    }
  }

  Future<void> action(String path, {bool cancel = false}) async {
    if (cancel) {
      final ok = await showDialog<bool>(
          context: context,
          builder: (c) => AlertDialog(
                  title: const Text('Cancel and refund?'),
                  content: const Text(
                      'Paid fees will be queued for a full refund. Cash refunds must be recorded in Payments after returning the money.'),
                  actions: [
                    TextButton(
                        onPressed: () => Navigator.pop(c, false),
                        child: const Text('Keep')),
                    TextButton(
                        onPressed: () => Navigator.pop(c, true),
                        child: const Text('Cancel and refund'))
                  ]));
      if (ok != true) return;
    }
    setState(() => busy = true);
    try {
      if (path.isEmpty) {
        await ApiService()
            .dio
            .put('/events/${widget.id}', data: {'status': 'CANCELLED'});
      } else {
        await ApiService().dio.post('/events/${widget.id}/$path');
      }
      await load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(apiErrorMessage(e))));
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
      appBar: AppBar(title: const Text('Event attendance')),
      body: RefreshIndicator(
          onRefresh: load,
          child: ListView(padding: const EdgeInsets.all(16), children: [
            if (error != null) Text(error!),
            if (data != null) ...[
              Text('${data!['name']} · ${data!['status']}'),
              const Text(
                  'Check-in opens 30 minutes before start and closes at the event end.'),
              if (data!['status'] != 'CANCELLED')
                TextButton(
                    onPressed: busy ? null : () => action('', cancel: true),
                    child: const Text('Cancel event and refund all entries')),
              ...(data!['registrations'] as List).map((r) => Card(
                  child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(r['user']['name']),
                            Text(
                                '${r['status']} · ${r['payment']?['status'] ?? 'FREE'}'),
                            if (r['attendedAt'] != null)
                              Text(
                                  'Attended: ${DateFormat('dd MMM, HH:mm').format(pakistanNow(DateTime.parse(r['attendedAt'])))} PKT')
                            else if (r['status'] == 'ACTIVE')
                              Wrap(children: [
                                TextButton(
                                    onPressed: busy
                                        ? null
                                        : () => action(
                                            'registrations/${r['id']}/attend'),
                                    child: const Text('Check in')),
                                TextButton(
                                    onPressed: busy
                                        ? null
                                        : () => action(
                                            'registrations/${r['id']}/cancel',
                                            cancel: true),
                                    child: const Text('Cancel entry'))
                              ])
                          ])))),
            ],
          ])));
}
