import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../services/api_service.dart';
import '../../services/api_errors.dart';
import '../../widgets/clubhouse.dart';
import '../../widgets/venue_location.dart';

class AdminVenueEditor extends StatefulWidget {
  final Map<String, dynamic>? venue;
  final List<Map<String, dynamic>> sports;
  const AdminVenueEditor({super.key, this.venue, required this.sports});
  @override
  State<AdminVenueEditor> createState() => _AdminVenueEditorState();
}

class _AdminVenueEditorState extends State<AdminVenueEditor> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController(),
      _description = TextEditingController(),
      _price = TextEditingController(),
      _capacity = TextEditingController(),
      _image = TextEditingController(),
      _opening = TextEditingController(),
      _closing = TextEditingController();
  final _address = TextEditingController(),
      _latitude = TextEditingController(),
      _longitude = TextEditingController();
  List<int> _closedDays = [];
  List<Map<String, dynamic>> _closures = [];
  int? _sportId;
  bool _active = true, _saving = false;
  @override
  void initState() {
    super.initState();
    final v = widget.venue;
    _address.text = v?['address'] ?? '';
    _latitude.text = v?['latitude']?.toString() ?? '';
    _longitude.text = v?['longitude']?.toString() ?? '';
    _name.text = v?['name'] ?? '';
    _description.text = v?['description'] ?? '';
    _price.text = '${v?['pricePerSlot'] ?? 0}';
    _capacity.text = v?['capacity']?.toString() ?? '';
    _image.text = v?['imageUrl'] ?? '';
    _opening.text = v?['openingTime'] ?? '06:00';
    _closing.text = v?['closingTime'] ?? '23:00';
    _closedDays = List<int>.from(v?['closedWeekdays'] ?? []);
    _closures = (v?['closures'] as List? ?? [])
        .map((c) => Map<String, dynamic>.from(c))
        .toList();
    _sportId = v?['sportId'] ??
        v?['sport']?['id'] ??
        (widget.sports.isEmpty ? null : widget.sports.first['id']);
    _active = v?['isActive'] ?? true;
  }

  @override
  void dispose() {
    for (final c in [
      _name,
      _description,
      _price,
      _capacity,
      _image,
      _opening,
      _closing,
      _address,
      _latitude,
      _longitude
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (_saving || !_form.currentState!.validate() || _sportId == null) return;
    setState(() => _saving = true);
    try {
      final data = {
        'address': _address.text.trim().isEmpty ? null : _address.text.trim(),
        'latitude':
            _latitude.text.trim().isEmpty ? null : double.parse(_latitude.text),
        'longitude': _longitude.text.trim().isEmpty
            ? null
            : double.parse(_longitude.text),
        'name': _name.text.trim(),
        'description': _description.text.trim(),
        'sportId': _sportId,
        'pricePerSlot': num.parse(_price.text),
        'capacity':
            _capacity.text.trim().isEmpty ? null : int.parse(_capacity.text),
        'imageUrl': _image.text.trim().isEmpty ? null : _image.text.trim(),
        'isActive': _active,
        'openingTime': _opening.text,
        'closingTime': _closing.text,
        'closedWeekdays': _closedDays,
        'closures': _closures
            .map((c) => {
                  'startAt': c['startAt'],
                  'endAt': c['endAt'],
                  'reason': c['reason']
                })
            .toList()
      };
      if (widget.venue == null) {
        await ApiService().dio.post('/venues', data: data);
      } else {
        await ApiService()
            .dio
            .put('/venues/${widget.venue!['id']}', data: data);
      }
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(apiErrorMessage(e))));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<DateTime?> _pickMoment() async {
    final date = await showDatePicker(
        context: context,
        initialDate: DateTime.now(),
        firstDate: DateTime.now().subtract(const Duration(days: 1)),
        lastDate: DateTime.now().add(const Duration(days: 730)));
    if (date == null || !mounted) return null;
    final time = await showTimePicker(
        context: context, initialTime: const TimeOfDay(hour: 10, minute: 0));
    return time == null
        ? null
        : DateTime.parse(
            '${date.toIso8601String().split('T')[0]}T${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}:00+05:00');
  }

  Future<void> _addClosure() async {
    final start = await _pickMoment();
    if (start == null || !mounted) return;
    final end = await _pickMoment();
    if (end == null || !mounted) return;
    final reason = TextEditingController();
    final ok = await showDialog<bool>(
        context: context,
        builder: (c) => AlertDialog(
                title: const Text('Closure reason'),
                content: TextField(
                    controller: reason,
                    decoration: const InputDecoration(labelText: 'Reason')),
                actions: [
                  TextButton(
                      onPressed: () => Navigator.pop(c, false),
                      child: const Text('Cancel')),
                  TextButton(
                      onPressed: () {
                        if (reason.text.trim().isNotEmpty &&
                            end.isAfter(start)) {
                          Navigator.pop(c, true);
                        }
                      },
                      child: const Text('Add closure'))
                ]));
    if (ok == true && mounted) {
      setState(() => _closures.add({
            'startAt': start.toUtc().toIso8601String(),
            'endAt': end.toUtc().toIso8601String(),
            'reason': reason.text.trim()
          }));
    }
    reason.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
      appBar: AppBar(
          title: Text(widget.venue == null
              ? 'Add a court or facility'
              : 'Edit facility')),
      body: Form(
          key: _form,
          child: ListView(padding: const EdgeInsets.all(20), children: [
            const ClubhouseHeading('A place to play.',
                subtitle:
                    'Each facility has its own published sessions and price.'),
            const SizedBox(height: 24),
            TextFormField(
                controller: _name,
                enabled: !_saving,
                decoration: const InputDecoration(labelText: 'Facility name'),
                validator: (v) => (v?.trim().isEmpty ?? true)
                    ? 'Enter a facility name.'
                    : null),
            const SizedBox(height: 16),
            DropdownButtonFormField<int>(
                initialValue: _sportId,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Sport'),
                items: widget.sports
                    .map((s) => DropdownMenuItem<int>(
                        value: s['id'],
                        child:
                            Text(s['name'], overflow: TextOverflow.ellipsis)))
                    .toList(),
                onChanged:
                    _saving ? null : (id) => setState(() => _sportId = id),
                validator: (v) => v == null ? 'Choose a sport.' : null),
            const SizedBox(height: 16),
            TextFormField(
                controller: _description,
                enabled: !_saving,
                maxLines: 3,
                decoration: const InputDecoration(labelText: 'Description')),
            const SizedBox(height: 20),
            Text('Venue location & entrance',
                style: Theme.of(context).textTheme.titleLarge),
            const Text(
                'Tap the map at the entrance, or type coordinates from Google Maps. The starting view is not a saved pin.'),
            TextFormField(
                controller: _address,
                enabled: !_saving,
                maxLength: 500,
                maxLines: 2,
                decoration: const InputDecoration(
                    labelText: 'Street address / gate instructions')),
            VenueMap(
                venue: {
                  'latitude': double.tryParse(_latitude.text),
                  'longitude': double.tryParse(_longitude.text)
                },
                onChanged: _saving
                    ? null
                    : (lat, lng) => setState(() {
                          _latitude.text = lat.toStringAsFixed(6);
                          _longitude.text = lng.toStringAsFixed(6);
                        })),
            for (final entry in [
              (_latitude, 'Latitude', 90),
              (_longitude, 'Longitude', 180)
            ])
              TextFormField(
                  controller: entry.$1,
                  enabled: !_saving,
                  keyboardType: const TextInputType.numberWithOptions(
                      decimal: true, signed: true),
                  decoration: InputDecoration(labelText: entry.$2),
                  onChanged: (_) => setState(() {}),
                  validator: (v) {
                    final other = entry.$1 == _latitude
                        ? _longitude.text
                        : _latitude.text;
                    if ((v ?? '').trim().isEmpty && other.trim().isEmpty) {
                      return null;
                    }
                    final n = double.tryParse(v ?? '');
                    return n == null || !n.isFinite || n.abs() > entry.$3
                        ? 'Enter both valid coordinates (${entry.$2}: -${entry.$3} to ${entry.$3}).'
                        : null;
                  }),
            TextButton(
                onPressed: _saving
                    ? null
                    : () => setState(() {
                          _latitude.clear();
                          _longitude.clear();
                        }),
                child: const Text('Clear entrance pin')),
            const SizedBox(height: 16),
            TextFormField(
                controller: _price,
                enabled: !_saving,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration:
                    const InputDecoration(labelText: 'Price per session (PKR)'),
                validator: (v) {
                  final n = num.tryParse(v ?? '');
                  return n == null || !n.isFinite || n < 0
                      ? 'Enter a valid non-negative price.'
                      : null;
                }),
            const SizedBox(height: 16),
            TextFormField(
                controller: _capacity,
                enabled: !_saving,
                keyboardType: TextInputType.number,
                decoration:
                    const InputDecoration(labelText: 'Capacity (optional)'),
                validator: (v) => v == null || v.trim().isEmpty
                    ? null
                    : (int.tryParse(v) == null || int.parse(v) < 1
                        ? 'Enter a positive whole number.'
                        : null)),
            const SizedBox(height: 16),
            TextFormField(
                controller: _image,
                enabled: !_saving,
                keyboardType: TextInputType.url,
                decoration: const InputDecoration(
                    labelText: 'Venue photo URL (optional)',
                    helperText:
                        'A matching sport image is used when no photo is supplied.',
                    helperMaxLines: 3),
                validator: (v) {
                  if (v == null || v.trim().isEmpty) return null;
                  final uri = Uri.tryParse(v.trim());
                  return uri != null &&
                          ['https', 'http'].contains(uri.scheme) &&
                          uri.host.isNotEmpty
                      ? null
                      : 'Enter a full HTTP or HTTPS image URL.';
                }),
            const SizedBox(height: 16),
            TextFormField(
                controller: _opening,
                decoration: const InputDecoration(
                    labelText: 'Opens (HH:MM, Pakistan time)'),
                validator: (v) =>
                    RegExp(r'^([01]\d|2[0-3]):[0-5]\d$').hasMatch(v ?? '')
                        ? null
                        : 'Use HH:MM'),
            TextFormField(
                controller: _closing,
                decoration: const InputDecoration(
                    labelText: 'Closes (HH:MM, Pakistan time)'),
                validator: (v) =>
                    RegExp(r'^([01]\d|2[0-3]):[0-5]\d$').hasMatch(v ?? '') &&
                            v!.compareTo(_opening.text) > 0
                        ? null
                        : 'Choose a closing time after opening'),
            const Text('Closed weekdays'),
            Wrap(
                spacing: 8,
                children: List.generate(
                    7,
                    (i) => FilterChip(
                        label: Text([
                          'Sun',
                          'Mon',
                          'Tue',
                          'Wed',
                          'Thu',
                          'Fri',
                          'Sat'
                        ][i]),
                        selected: _closedDays.contains(i),
                        onSelected: _saving
                            ? null
                            : (v) => setState(() {
                                  if (v) {
                                    _closedDays.add(i);
                                  } else {
                                    _closedDays.remove(i);
                                  }
                                })))),
            ..._closures.map((c) => ListTile(
                title: Text(c['reason']),
                subtitle: Text(
                    '${DateFormat('dd MMM, HH:mm').format(DateTime.parse(c['startAt']).toUtc().add(const Duration(hours: 5)))} to ${DateFormat('dd MMM, HH:mm').format(DateTime.parse(c['endAt']).toUtc().add(const Duration(hours: 5)))} PKT'),
                trailing: IconButton(
                    icon: const Icon(Icons.delete_outline),
                    onPressed: _saving
                        ? null
                        : () => setState(() => _closures.remove(c))))),
            TextButton(
                onPressed: _saving ? null : _addClosure,
                child: const Text(
                    'Add closure: choose start, then end (Pakistan time)')),
            if (widget.venue != null)
              SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Available for booking'),
                  subtitle: const Text(
                      'Turning this off hides the facility from customers. Existing bookings remain in the schedule.'),
                  value: _active,
                  onChanged:
                      _saving ? null : (v) => setState(() => _active = v)),
            const SizedBox(height: 20),
            ElevatedButton(
                onPressed: _saving || widget.sports.isEmpty ? null : _save,
                child: Text(_saving ? 'Saving…' : 'Save facility')),
          ])));
}
