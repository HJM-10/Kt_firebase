import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../services/api_service.dart';
import '../../services/api_errors.dart';
import '../../utils/arena_desk.dart';
import '../../widgets/arena_desk.dart';
import '../../widgets/clubhouse.dart';

class AdminWalkInScreen extends StatefulWidget {
  final List<Map<String, dynamic>> venues;
  final DateTime date;
  final int? venueId, slotId;
  const AdminWalkInScreen(
      {super.key,
      required this.venues,
      required this.date,
      this.venueId,
      this.slotId});
  @override
  State<AdminWalkInScreen> createState() => _AdminWalkInScreenState();
}

class _AdminWalkInScreenState extends State<AdminWalkInScreen> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController(),
      _phone = TextEditingController(),
      _notes = TextEditingController();
  late DateTime _date;
  int? _venueId, _slotId;
  List<Map<String, dynamic>> _slots = [];
  bool _loading = false, _saving = false, _created = false;
  String? _error;
  int _version = 0;
  List<Map<String, dynamic>> get _venues => widget.venues
      .where((v) => v['isActive'] != false && v['sport']?['isActive'] != false)
      .toList();
  @override
  void initState() {
    super.initState();
    _date = widget.date.isBefore(arenaToday()) ? arenaToday() : widget.date;
    _venueId = widget.venueId;
    _slotId = widget.slotId;
    if (!_venues.any((v) => v['id'] == _venueId)) {
      _venueId = _venues.isEmpty ? null : _venues.first['id'];
    }
    if (_venueId != null) _load();
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final version = ++_version;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final response = await ApiService().dio.get('/bookings/slots',
          queryParameters: {'venueId': _venueId, 'date': arenaDate(_date)});
      if (!mounted || version != _version) return;
      setState(() {
        _slots = arenaMaps(response.data['data'])
            .where((s) =>
                s['isBooked'] != true &&
                arenaInstant(arenaDate(_date), s['startTime'])
                    .isAfter(DateTime.now()))
            .toList();
        if (!_slots.any((s) => s['id'] == _slotId)) _slotId = null;
      });
    } catch (e) {
      if (mounted && version == _version) {
        setState(() {
          _error = apiErrorMessage(e);
          _slots = [];
          _slotId = null;
        });
      }
    } finally {
      if (mounted && version == _version) setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    if (_saving ||
        _created ||
        !_form.currentState!.validate() ||
        _slotId == null) {
      return;
    }
    setState(() => _saving = true);
    try {
      final response = await ApiService().dio.post('/bookings', data: {
        'slotId': _slotId,
        'walkInName': _name.text.trim(),
        'walkInPhone': _phone.text.trim(),
        'notes': _notes.text.trim()
      });
      if (!mounted) return;
      final record = response.data['data'];
      setState(() => _created = true);
      await showDialog<void>(
          context: context,
          builder: (c) => AlertDialog(
                  title: Text(record['status'] == 'CONFIRMED'
                      ? 'Walk-in confirmed'
                      : 'Walk-in reserved'),
                  content: Text(
                      'Booking #${record['id']} · ${clubPrice(record['finalPrice'])}\n\n${record['status'] == 'CONFIRMED' ? 'The session is confirmed.' : 'Record payment from Bookings only after collecting the money.'}'),
                  actions: [
                    TextButton(
                        onPressed: () => Navigator.pop(c),
                        child: const Text('Done'))
                  ]));
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(apiErrorMessage(e))));
        await _load();
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final venue = _venues.where((v) => v['id'] == _venueId).firstOrNull;
    return Scaffold(
        appBar: AppBar(title: const Text('Add walk-in booking')),
        body: Form(
            key: _form,
            child: ListView(padding: const EdgeInsets.all(20), children: [
              const ClubhouseHeading('Make room for a game.',
                  subtitle:
                      'Reserve a published session for a walk-in customer.'),
              const SizedBox(height: 24),
              if (_venues.isEmpty)
                const ArenaEmpty(
                    title: 'No active courts',
                    message:
                        'Add or activate a venue before creating a walk-in booking.')
              else ...[
                DropdownButtonFormField<int>(
                    initialValue: _venueId,
                    isExpanded: true,
                    decoration:
                        const InputDecoration(labelText: 'Court or facility'),
                    items: _venues
                        .map((v) => DropdownMenuItem<int>(
                            value: v['id'],
                            child: Text(v['name'],
                                overflow: TextOverflow.ellipsis)))
                        .toList(),
                    onChanged: _saving
                        ? null
                        : (value) {
                            setState(() {
                              _venueId = value;
                              _slotId = null;
                            });
                            _load();
                          }),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                    onPressed: _saving
                        ? null
                        : () async {
                            final day = await showDatePicker(
                                context: context,
                                initialDate: _date,
                                firstDate: arenaToday(),
                                lastDate: arenaToday()
                                    .add(const Duration(days: 1825)));
                            if (day != null && mounted) {
                              setState(() {
                                _date = day;
                                _slotId = null;
                              });
                              _load();
                            }
                          },
                    icon: const ArenaIcon(ArenaSymbol.calendar, size: 18),
                    label: Text(DateFormat.yMMMd().format(_date))),
                if (venue != null)
                  Padding(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      child: Text(
                          '${clubPrice(venue['pricePerSlot'])} per session',
                          style: TextStyle(
                              color: colors.primary,
                              fontWeight: FontWeight.w700))),
                if (_loading)
                  const Padding(
                      padding: EdgeInsets.all(20),
                      child: Center(child: CircularProgressIndicator()))
                else if (_error != null)
                  ArenaEmpty(
                      title: 'Sessions could not load',
                      message: _error!,
                      onRetry: _load)
                else if (_slots.isEmpty)
                  const ArenaEmpty(
                      title: 'No open sessions',
                      message:
                          'Choose another date or publish sessions from Courts.')
                else
                  Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: _slots
                          .map((s) => ChoiceChip(
                              label: Text(
                                  '${arenaTime(s['startTime'])} – ${arenaTime(s['endTime'])}'),
                              selected: _slotId == s['id'],
                              onSelected: _saving
                                  ? null
                                  : (_) => setState(() => _slotId = s['id'])))
                          .toList()),
                const SizedBox(height: 24),
                if (_slotId != null && _slots.any((s) => s['id'] == _slotId))
                  Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: Text('Entry is available during the booked session. '
                        'The QR pass expires at '
                        '${arenaTime(_slots.firstWhere((s) => s['id'] == _slotId)['endTime'])} PKT. '
                        'Customers may arrive any time before then.'),
                  ),
                TextFormField(
                    controller: _name,
                    enabled: !_saving,
                    maxLength: 100,
                    decoration:
                        const InputDecoration(labelText: 'Customer name'),
                    validator: (v) => (v?.trim().length ?? 0) < 2
                        ? 'Enter the customer’s name.'
                        : null),
                const SizedBox(height: 12),
                TextFormField(
                    controller: _phone,
                    enabled: !_saving,
                    maxLength: 30,
                    keyboardType: TextInputType.phone,
                    decoration:
                        const InputDecoration(labelText: 'Phone number'),
                    validator: (v) =>
                        (v ?? '').replaceAll(RegExp(r'\D'), '').length < 7
                            ? 'Enter a valid phone number.'
                            : null),
                const SizedBox(height: 12),
                TextFormField(
                    controller: _notes,
                    enabled: !_saving,
                    maxLength: 2000,
                    maxLines: 2,
                    decoration:
                        const InputDecoration(labelText: 'Notes (optional)')),
                const SizedBox(height: 16),
                Text(
                    'The session price is confirmed when you reserve. Payment is recorded separately after money is received.',
                    style:
                        TextStyle(color: colors.onSurfaceVariant, height: 1.4)),
              ],
            ])),
        bottomNavigationBar: SafeArea(
            top: false,
            child: Padding(
                padding: const EdgeInsets.all(16),
                child: ElevatedButton.icon(
                    key: const Key('create-walk-in'),
                    onPressed:
                        _slotId == null || _loading || _saving || _created
                            ? null
                            : _save,
                    icon: const ArenaIcon(ArenaSymbol.add,
                        size: 20, color: Colors.white),
                    label: Text(_saving ? 'Saving…' : 'Reserve walk-in')))));
  }
}
