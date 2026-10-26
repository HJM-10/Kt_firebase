import 'tournament_details_screen.dart';
import 'package:flutter/material.dart';
import '../services/api_service.dart';
import 'package:dio/dio.dart';

class AdminTournamentsScreen extends StatefulWidget {
  const AdminTournamentsScreen({super.key});

  @override
  State<AdminTournamentsScreen> createState() => _AdminTournamentsScreenState();
}

class _AdminTournamentsScreenState extends State<AdminTournamentsScreen> {
  final ApiService _apiService = ApiService();
  List<dynamic> _tournaments = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchTournaments();
  }

  Future<void> _fetchTournaments() async {
    setState(() => _isLoading = true);
    try {
      final res = await _apiService.dio.get('/tournaments');
      if (mounted) {
        setState(() {
          _tournaments = res.data['data'];
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> editTournament([Map<String, dynamic>? current]) async {
    List<dynamic> sports;
    try {
      final r = await _apiService.dio.get('/sports');
      sports = r.data['data'];
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Could not load sports')));
      }
      return;
    }
    if (!mounted || sports.isEmpty) return;
    final name = TextEditingController(text: current?['name'] ?? '');
    final fee = TextEditingController(text: '${current?['entryFee'] ?? 0}');
    final teams = TextEditingController(text: '${current?['maxTeams'] ?? 8}');
    int sportId = current?['sportId'] ?? sports.first['id'];
    String format = current?['format'] ?? 'KNOCKOUT';
    DateTime? date =
        current == null ? null : DateTime.parse(current['startDate']);
    bool saving = false;
    final formKey = GlobalKey<FormState>();
    await showDialog(
        context: context,
        builder: (dialogContext) => StatefulBuilder(
            builder: (c, update) => AlertDialog(
                  title: Text(current == null
                      ? 'Create tournament'
                      : 'Edit tournament'),
                  content: SingleChildScrollView(
                      child: Form(
                          key: formKey,
                          child:
                              Column(mainAxisSize: MainAxisSize.min, children: [
                            TextFormField(
                                controller: name,
                                decoration:
                                    const InputDecoration(labelText: 'Name'),
                                validator: (v) => v == null || v.trim().isEmpty
                                    ? 'Enter a name'
                                    : null),
                            if (current == null)
                              DropdownButtonFormField<int>(
                                  initialValue: sportId,
                                  isExpanded: true,
                                  items: sports
                                      .map((s) => DropdownMenuItem<int>(
                                          value: s['id'],
                                          child: Text(s['name'])))
                                      .toList(),
                                  onChanged: (v) => sportId = v!,
                                  decoration: const InputDecoration(
                                      labelText: 'Sport')),
                            if (current == null)
                              DropdownButtonFormField<String>(
                                  initialValue: format,
                                  items: ['LEAGUE', 'KNOCKOUT']
                                      .map((v) => DropdownMenuItem(
                                          value: v, child: Text(v)))
                                      .toList(),
                                  onChanged: (v) => format = v!,
                                  decoration: const InputDecoration(
                                      labelText: 'Format')),
                            TextFormField(
                                controller: fee,
                                keyboardType: TextInputType.number,
                                decoration: const InputDecoration(
                                    labelText: 'Entry fee in PKR'),
                                validator: (v) =>
                                    num.tryParse(v ?? '') == null ||
                                            num.parse(v!) < 0
                                        ? 'Enter a nonnegative fee'
                                        : null),
                            TextFormField(
                                controller: teams,
                                keyboardType: TextInputType.number,
                                decoration: const InputDecoration(
                                    labelText: 'Maximum teams'),
                                validator: (v) =>
                                    int.tryParse(v ?? '') == null ||
                                            int.parse(v!) < 2
                                        ? 'At least 2 teams'
                                        : null),
                            TextButton(
                                onPressed: () async {
                                  final d = await showDatePicker(
                                      context: c,
                                      initialDate: date ?? DateTime.now(),
                                      firstDate: DateTime(2020),
                                      lastDate: DateTime.now()
                                          .add(const Duration(days: 730)));
                                  if (d != null && c.mounted) {
                                    update(() => date = d);
                                  }
                                },
                                child: Text(date == null
                                    ? 'Choose start date'
                                    : date!.toString().split(' ')[0])),
                          ]))),
                  actions: [
                    TextButton(
                        onPressed: saving ? null : () => Navigator.pop(c),
                        child: const Text('Cancel')),
                    ElevatedButton(
                        onPressed: saving
                            ? null
                            : () async {
                                if (!formKey.currentState!.validate() ||
                                    date == null) {
                                  return;
                                }
                                update(() => saving = true);
                                try {
                                  final data = {
                                    'name': name.text.trim(),
                                    'entryFee': num.parse(fee.text),
                                    'maxTeams': int.parse(teams.text),
                                    'startDate':
                                        date!.toUtc().toIso8601String(),
                                    if (current == null) 'sportId': sportId,
                                    if (current == null) 'format': format
                                  };
                                  if (current == null) {
                                    await _apiService.dio
                                        .post('/tournaments', data: data);
                                  } else {
                                    await _apiService.dio.put(
                                        '/tournaments/${current['id']}',
                                        data: data);
                                  }
                                  if (c.mounted) Navigator.pop(c);
                                  await _fetchTournaments();
                                } catch (e) {
                                  if (c.mounted) {
                                    update(() => saving = false);
                                    ScaffoldMessenger.of(c).showSnackBar(
                                        SnackBar(
                                            content: Text(e is DioException
                                                ? e.response?.data['message'] ??
                                                    'Could not save tournament'
                                                : 'Could not save tournament')));
                                  }
                                }
                              },
                        child: const Text('Save'))
                  ],
                )));
    name.dispose();
    fee.dispose();
    teams.dispose();
  }

  Future<void> registrations(int id) async {
    try {
      final r = await _apiService.dio.get('/tournaments/$id');
      if (!mounted) return;
      final regs = r.data['data']['registrations'] as List;
      await showDialog(
          context: context,
          builder: (c) => AlertDialog(
                  title: const Text('Registrations'),
                  content: SizedBox(
                      width: double.maxFinite,
                      child: ListView(
                          shrinkWrap: true,
                          children: regs.isEmpty
                              ? [const Text('No registrations')]
                              : regs
                                  .map((r) => ListTile(
                                      title: Text(r['teamName']),
                                      subtitle: Text(
                                          '${r['user']['name']} · ${r['payment']?['status'] ?? 'Free'}')))
                                  .toList())),
                  actions: [
                    TextButton(
                        onPressed: () => Navigator.pop(c),
                        child: const Text('Close'))
                  ]));
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Could not load registrations')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Manage Tournaments')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              itemCount: _tournaments.length,
              itemBuilder: (context, index) {
                final t = _tournaments[index];
                return ListTile(
                  title: Text(t['name']),
                  subtitle: Text('Status: ${t['status']}'),
                  onTap: () => Navigator.push(
                      context,
                      MaterialPageRoute(
                          builder: (_) => TournamentDetailsScreen(
                              id: t['id'], admin: true))),
                  trailing: IconButton(
                      icon: const Icon(Icons.edit),
                      tooltip: 'Edit tournament',
                      onPressed: () =>
                          editTournament(Map<String, dynamic>.from(t))),
                );
              },
            ),
      floatingActionButton: FloatingActionButton(
          onPressed: editTournament, child: const Icon(Icons.add)),
    );
  }
}
