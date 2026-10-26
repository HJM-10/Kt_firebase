import 'package:intl/intl.dart';
import '../utils/arena_desk.dart';
import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/api_errors.dart';

class TournamentDetailsScreen extends StatefulWidget {
  final int id;
  final bool admin;
  const TournamentDetailsScreen(
      {super.key, required this.id, this.admin = false});
  @override
  State<TournamentDetailsScreen> createState() =>
      _TournamentDetailsScreenState();
}

class _TournamentDetailsScreenState extends State<TournamentDetailsScreen> {
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
      final r = await ApiService().dio.get('/tournaments/${widget.id}');
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

  Future<void> result(dynamic match) async {
    final winner = await showDialog<String>(
        context: context,
        builder: (c) =>
            SimpleDialog(title: const Text('Record final result'), children: [
              SimpleDialogOption(
                  onPressed: () => Navigator.pop(c, 'team1'),
                  child: Text('${match['team1']} wins')),
              SimpleDialogOption(
                  onPressed: () => Navigator.pop(c, 'team2'),
                  child: Text('${match['team2']} wins')),
              if (data?['format'] == 'LEAGUE')
                SimpleDialogOption(
                    onPressed: () => Navigator.pop(c, 'draw'),
                    child: const Text('Draw')),
            ]));
    if (winner == null) return;
    setState(() => busy = true);
    try {
      await ApiService().dio.put('/matches/${match['id']}/result',
          data: {'winner': winner, 'isCompleted': true});
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

  Future<void> addEntry() async {
    final response = await ApiService().dio.get('/users');
    if (!mounted) return;
    final users = response.data['data'] as List;
    final team = TextEditingController(), reason = TextEditingController();
    int? userId;
    String status = 'PENDING';
    bool received = false, saving = false;
    await showDialog(
        context: context,
        builder: (c) => StatefulBuilder(
            builder: (c, update) => AlertDialog(
                    title: const Text('Register team'),
                    content: SingleChildScrollView(
                        child:
                            Column(mainAxisSize: MainAxisSize.min, children: [
                      TextField(
                          controller: team,
                          decoration:
                              const InputDecoration(labelText: 'Team name')),
                      const SizedBox(height: 18),
                      DropdownButtonFormField<int>(
                          isExpanded: true,
                          decoration:
                              const InputDecoration(labelText: 'Captain'),
                          items: users
                              .map((u) => DropdownMenuItem<int>(
                                  value: u['id'], child: Text(u['name'])))
                              .toList(),
                          onChanged: (v) => userId = v),
                      const SizedBox(height: 18),
                      DropdownButtonFormField<String>(
                          initialValue: status,
                          items: ['PENDING', 'PAID', 'FREE']
                              .map((s) =>
                                  DropdownMenuItem(value: s, child: Text(s)))
                              .toList(),
                          onChanged: (v) => update(() {
                                status = v!;
                                received = false;
                              }),
                          decoration:
                              const InputDecoration(labelText: 'Payment')),
                      const SizedBox(height: 12),
                      if (status == 'PAID')
                        CheckboxListTile(
                            title: const Text('I received this fee in person'),
                            value: received,
                            onChanged: (v) =>
                                update(() => received = v ?? false)),
                      if (status == 'FREE')
                        TextField(
                            controller: reason,
                            decoration: const InputDecoration(
                                labelText: 'Waiver reason')),
                    ])),
                    actions: [
                      TextButton(
                          onPressed: saving ? null : () => Navigator.pop(c),
                          child: const Text('Close')),
                      ElevatedButton(
                          onPressed: saving
                              ? null
                              : () async {
                                  if (team.text.trim().isEmpty ||
                                      userId == null ||
                                      (status == 'PAID' && !received) ||
                                      (status == 'FREE' &&
                                          reason.text.trim().isEmpty)) {
                                    return;
                                  }
                                  update(() => saving = true);
                                  try {
                                    await ApiService().dio.post(
                                        '/tournaments/${widget.id}/manual-register',
                                        data: {
                                          'teamName': team.text.trim(),
                                          'userId': userId,
                                          'paymentStatus': status,
                                          'receivedInPerson': received,
                                          'waiverReason': reason.text.trim()
                                        });
                                    if (c.mounted) Navigator.pop(c);
                                    await load();
                                  } catch (e) {
                                    if (c.mounted) {
                                      update(() => saving = false);
                                      ScaffoldMessenger.of(c).showSnackBar(
                                          SnackBar(
                                              content:
                                                  Text(apiErrorMessage(e))));
                                    }
                                  }
                                },
                          child: const Text('Register'))
                    ])));
    team.dispose();
    reason.dispose();
  }

  String matchStatus(dynamic m) {
    if (m['isBye'] == true) return 'Automatic bye';
    if (m['isCompleted'] != true) {
      return '${DateFormat('dd MMM, HH:mm').format(pakistanNow(DateTime.parse(m['scheduledAt'])))} PKT';
    }
    if (m['winner'] == 'draw') return 'Draw';
    final winner = m['winner'] == 'team1'
        ? m['team1']
        : m['winner'] == 'team2'
            ? m['team2']
            : m['winner'];
    return m['result'] ?? '$winner wins';
  }

  @override
  Widget build(BuildContext context) => Scaffold(
      appBar: AppBar(title: Text(data?['name'] ?? 'Tournament')),
      body: RefreshIndicator(
          onRefresh: load,
          child: ListView(padding: const EdgeInsets.all(16), children: [
            if (error != null) Text(error!),
            if (data != null) ...[
              Text('Status: ${data!['status']}'),
              if (data!['champion'] != null)
                Text('Champion: ${data!['champion']}',
                    style: Theme.of(context).textTheme.titleLarge),
              if (widget.admin && data!['status'] == 'UPCOMING')
                TextButton(
                    onPressed: busy
                        ? null
                        : () async {
                            try {
                              await addEntry();
                            } catch (e) {
                              if (context.mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                        content: Text(apiErrorMessage(e))));
                              }
                            }
                          },
                    child: const Text('Add team')),
              if (data!['format'] == 'LEAGUE') ...[
                const SizedBox(height: 20),
                const Text('Standings · win 3 points, draw 1'),
                ...(data!['standings'] as List? ?? []).map((r) => ListTile(
                    title: Text(r['team']),
                    subtitle: Text(
                        '${r['played']} played · ${r['won']} W / ${r['drawn']} D / ${r['lost']} L · difference ${r['difference']}'),
                    trailing: Text('${r['points']} pts'))),
              ],
              const SizedBox(height: 20),
              const Text('Fixtures and results'),
              ...(data!['matches'] as List? ?? []).map((m) => ListTile(
                  title: Text(m['isBye'] == true
                      ? '${m['team1']} advances by bye'
                      : '${m['team1']} vs ${m['team2']}'),
                  subtitle: Text('${m['round']} · ${matchStatus(m)}'),
                  trailing: widget.admin && m['isCompleted'] != true
                      ? TextButton(
                          onPressed: busy ? null : () => result(m),
                          child: const Text('Result'))
                      : null)),
              if (widget.admin) ...[
                const Text('Registrations'),
                ...(data!['registrations'] as List).map((r) => ListTile(
                    title: Text(r['teamName']),
                    subtitle: Text(
                        '${r['status']} · ${r['user']['name']} · ${r['payment']?['status'] ?? 'FREE'}'))),
              ],
            ],
          ])));
}
