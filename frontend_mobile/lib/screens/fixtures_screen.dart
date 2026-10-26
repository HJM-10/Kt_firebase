import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import '../services/api_errors.dart';
import '../utils/arena_desk.dart';
import '../widgets/clubhouse.dart';

class FixturesScreen extends StatefulWidget {
  const FixturesScreen({super.key});
  @override
  State<FixturesScreen> createState() => _FixturesScreenState();
}

class _FixturesScreenState extends State<FixturesScreen> {
  final _form = GlobalKey<FormState>();
  List<dynamic> tournaments = [], venues = [], matches = [];
  int? selected;
  String? venueName;
  DateTime? start;
  bool busy = false, loading = true;
  String? error;
  final interval = TextEditingController(text: '150');
  final duration = TextEditingController(text: '120');
  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    interval.dispose();
    duration.dispose();
    super.dispose();
  }

  Future<void> load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final responses = await Future.wait([
        ApiService().dio.get('/tournaments'),
        ApiService().dio.get('/venues')
      ]);
      if (mounted) {
        setState(() {
          tournaments = (responses[0].data['data'] as List)
              .where((t) => t['status'] != 'COMPLETED')
              .toList();
          venues = (responses[1].data['data'] as List)
              .where((v) => v['isActive'] != false)
              .toList();
        });
      }
    } catch (e) {
      if (mounted) setState(() => error = apiErrorMessage(e));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  String stamp(dynamic value) =>
      '${DateFormat('EEE, dd MMM · HH:mm').format(pakistanNow(DateTime.parse(value.toString())))} PKT';

  Future<void> chooseTime() async {
    final today = arenaToday();
    final date = await showDatePicker(
        context: context,
        initialDate: today.add(const Duration(days: 1)),
        firstDate: today,
        lastDate: today.add(const Duration(days: 365)));
    if (date == null || !mounted) return;
    final time = await showTimePicker(
        context: context, initialTime: const TimeOfDay(hour: 12, minute: 0));
    if (time != null && mounted) {
      setState(() => start = arenaInstant(arenaDate(date),
          '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}'));
    }
  }

  Future<void> generate() async {
    if (busy || !_form.currentState!.validate()) return;
    if (start == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Choose the first match date and time.')));
      return;
    }
    setState(() => busy = true);
    try {
      final r =
          await ApiService().dio.post('/tournaments/$selected/fixtures', data: {
        'scheduledAt': start!.toUtc().toIso8601String(),
        'durationMinutes': int.parse(duration.text),
        'intervalMinutes': int.parse(interval.text),
        'venue': venueName,
      });
      if (mounted) {
        setState(() => matches = r.data['data']);
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('Fixtures saved. Scroll down to review the round.')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(apiErrorMessage(e))));
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Widget field(String label, Widget input, {String? hint}) => Padding(
        padding: const EdgeInsets.only(bottom: 26),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label,
              style: Theme.of(context)
                  .textTheme
                  .titleSmall
                  ?.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 10),
          input,
          if (hint != null) ...[
            const SizedBox(height: 10),
            Text(hint,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                    height: 1.5))
          ],
        ]),
      );

  InputDecoration decoration(String hint, {String? suffix}) => InputDecoration(
        hintText: hint,
        suffixText: suffix,
        floatingLabelBehavior: FloatingLabelBehavior.never,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 18, vertical: 18),
      );

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Generate fixtures')),
        body: SafeArea(
            child: Center(
                child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 720),
          child: loading
              ? const Center(child: CircularProgressIndicator())
              : error != null
                  ? Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(mainAxisSize: MainAxisSize.min, children: [
                        Text(error!),
                        const SizedBox(height: 16),
                        OutlinedButton(
                            onPressed: load, child: const Text('Try again'))
                      ]))
                  : Form(
                      key: _form,
                      child: ListView(
                          padding: const EdgeInsets.fromLTRB(20, 24, 20, 40),
                          children: [
                            const ClubhouseHeading('Set the next round.',
                                subtitle:
                                    'Choose your tournament, then give each game room to play.'),
                            const SizedBox(height: 28),
                            field(
                                'Tournament',
                                DropdownButtonFormField<int>(
                                  key: const ValueKey('fixture-tournament'),
                                  initialValue: selected,
                                  isExpanded: true,
                                  decoration: decoration('Choose a tournament'),
                                  items: tournaments
                                      .map((t) => DropdownMenuItem<int>(
                                          value: t['id'],
                                          child: Text(t['name'],
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis)))
                                      .toList(),
                                  onChanged: busy
                                      ? null
                                      : (v) => setState(() {
                                            selected = v;
                                            matches = [];
                                            venueName = null;
                                          }),
                                  validator: (v) =>
                                      v == null ? 'Choose a tournament.' : null,
                                ),
                                hint:
                                    'League: every pair plays once. Knockout: complete the current round before generating the next.'),
                            field(
                                'First match',
                                SizedBox(
                                    width: double.infinity,
                                    child: OutlinedButton.icon(
                                      key: const ValueKey('fixture-start'),
                                      onPressed: busy ? null : chooseTime,
                                      icon: const Icon(
                                          Icons.calendar_month_outlined,
                                          size: 20),
                                      label: Padding(
                                          padding: const EdgeInsets.symmetric(
                                              vertical: 2),
                                          child: Text(
                                              start == null
                                                  ? 'Choose date and time'
                                                  : stamp(
                                                      start!.toIso8601String()),
                                              textAlign: TextAlign.center)),
                                    )),
                                hint: 'All match times use Pakistan time.'),
                            field(
                                'Match duration',
                                TextFormField(
                                  key: const ValueKey('fixture-duration'),
                                  controller: duration,
                                  enabled: !busy,
                                  keyboardType: TextInputType.number,
                                  decoration: decoration('For example, 60',
                                      suffix: 'min'),
                                  validator: (v) =>
                                      int.tryParse(v ?? '') == null ||
                                              int.parse(v!) < 15
                                          ? 'Enter at least 15 minutes.'
                                          : null,
                                )),
                            field(
                                'Time between match starts',
                                TextFormField(
                                  key: const ValueKey('fixture-interval'),
                                  controller: interval,
                                  enabled: !busy,
                                  keyboardType: TextInputType.number,
                                  decoration: decoration('For example, 90',
                                      suffix: 'min'),
                                  validator: (v) => int.tryParse(v ?? '') ==
                                              null ||
                                          int.parse(v!) <
                                              (int.tryParse(duration.text) ??
                                                      0) +
                                                  30
                                      ? 'Allow match duration plus 30 minutes.'
                                      : null,
                                ),
                                hint:
                                    'Include at least 30 minutes of rest. A 60-minute match needs 90 minutes between starts.'),
                            field(
                                'Court or venue',
                                DropdownButtonFormField<String>(
                                  key: ValueKey('fixture-venue-$selected'),
                                  initialValue: venueName,
                                  isExpanded: true,
                                  decoration: decoration('Choose a venue'),
                                  items: venues
                                      .where((v) =>
                                          selected == null ||
                                          tournaments.any((t) =>
                                              t['id'] == selected &&
                                              t['sportId'] == v['sportId']))
                                      .map((v) => DropdownMenuItem<String>(
                                          value: v['name'],
                                          child: Text(v['name'],
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis)))
                                      .toList(),
                                  onChanged: busy
                                      ? null
                                      : (v) => setState(() => venueName = v),
                                  validator: (v) =>
                                      v == null ? 'Choose a venue.' : null,
                                ),
                                hint:
                                    'Existing bookings, closures and other matches are checked before saving.'),
                            SizedBox(
                                width: double.infinity,
                                child: ElevatedButton.icon(
                                  onPressed: busy ? null : generate,
                                  icon: busy
                                      ? const SizedBox(
                                          width: 18,
                                          height: 18,
                                          child: CircularProgressIndicator(
                                              strokeWidth: 2))
                                      : const Icon(Icons.auto_awesome_outlined,
                                          size: 20),
                                  label: Text(busy
                                      ? 'Saving fixtures…'
                                      : 'Generate and save'),
                                )),
                            if (matches.isNotEmpty) ...[
                              const SizedBox(height: 36),
                              Text('Saved fixtures',
                                  style:
                                      Theme.of(context).textTheme.titleLarge),
                              const SizedBox(height: 16),
                              ...matches.map((m) => Padding(
                                  padding: const EdgeInsets.only(bottom: 14),
                                  child: Card(
                                      margin: EdgeInsets.zero,
                                      child: Padding(
                                          padding: const EdgeInsets.all(20),
                                          child: Column(
                                              crossAxisAlignment:
                                                  CrossAxisAlignment.start,
                                              children: [
                                                Text(m['round'] ?? 'Match',
                                                    style: Theme.of(context)
                                                        .textTheme
                                                        .labelLarge
                                                        ?.copyWith(
                                                            color: Theme.of(
                                                                    context)
                                                                .colorScheme
                                                                .primary)),
                                                const SizedBox(height: 12),
                                                Text(
                                                    m['isBye'] == true
                                                        ? '${m['team1']} advances by bye'
                                                        : '${m['team1']} vs ${m['team2']}',
                                                    style: Theme.of(context)
                                                        .textTheme
                                                        .titleMedium
                                                        ?.copyWith(
                                                            height: 1.5)),
                                                const SizedBox(height: 12),
                                                Text(
                                                    m['isBye'] == true
                                                        ? 'Automatic advancement · no court time required'
                                                        : stamp(
                                                            m['scheduledAt']),
                                                    style: Theme.of(context)
                                                        .textTheme
                                                        .bodySmall
                                                        ?.copyWith(
                                                            height: 1.5)),
                                              ]))))),
                            ],
                          ])),
        ))),
      );
}
