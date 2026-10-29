import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../services/api_errors.dart';
import '../services/live_refresh.dart';
import '../services/payment_service.dart';

class EquipmentScreen extends StatefulWidget {
  final int? venueId;
  const EquipmentScreen({super.key, this.venueId});
  @override
  State<EquipmentScreen> createState() => _EquipmentScreenState();
}

class _EquipmentScreenState extends State<EquipmentScreen>
    with LiveRefresh<EquipmentScreen> {
  final _api = ApiService();
  List<dynamic> _items = [], _rentals = [];
  DateTime _start =
      DateUtils.dateOnly(DateTime.now().toUtc().add(const Duration(hours: 5)));
  late DateTime _end = _start;
  bool _loading = true, _busy = false;
  String? _error;
  bool get _admin => context.read<AuthProvider>().user?['role'] == 'ADMIN';
  String _date(DateTime d) => DateFormat('yyyy-MM-dd').format(d);
  @override
  List<String> get liveResources => ['equipment', 'payments', 'venues'];
  @override
  Future<void> refreshForLiveUpdates() => _load();
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _load();
    });
  }

  Future<void> _load() async {
    try {
      final result = await Future.wait([
        _api.dio.get('/equipment', queryParameters: {
          'rentalDate': _date(_start),
          'returnDate': _date(_end),
          if (widget.venueId != null) 'venueId': widget.venueId
        }),
        _api.dio
            .get(_admin ? '/equipment/rentals/all' : '/equipment/my-rentals'),
      ]);
      if (mounted) {
        setState(() {
          _items = result[0].data['data'];
          _rentals = result[1].data['data'];
          _error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = apiErrorMessage(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _act(Future<void> Function() task) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await task();
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(apiErrorMessage(e))));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _pickDates() async {
    final today = DateUtils.dateOnly(
        DateTime.now().toUtc().add(const Duration(hours: 5)));
    final range = await showDateRangePicker(
        context: context,
        firstDate: today,
        lastDate: today.add(const Duration(days: 365)),
        initialDateRange: DateTimeRange(start: _start, end: _end));
    if (range != null && mounted) {
      setState(() {
        _start = range.start;
        _end = range.end;
      });
      await _load();
    }
  }

  Future<void> _rent(Map<String, dynamic> item) async {
    String units = '1';
    final form = GlobalKey<FormState>();
    final days = _end.difference(_start).inDays + 1;
    final count = await showDialog<int>(
        context: context,
        builder: (ctx) => StatefulBuilder(
            builder: (ctx, update) => AlertDialog(
                  title: Text(item['name']),
                  content: Form(
                      key: form,
                      child: Column(mainAxisSize: MainAxisSize.min, children: [
                        Text('${_date(_start)} to ${_date(_end)} · $days days'),
                        TextFormField(
                            initialValue: units,
                            keyboardType: TextInputType.number,
                            decoration:
                                const InputDecoration(labelText: 'Units'),
                            onChanged: (s) => update(() => units = s),
                            validator: (s) {
                              final n = int.tryParse(s ?? '');
                              return n == null ||
                                      n < 1 ||
                                      n > (item['availableQuantity'] as num)
                                  ? 'Enter an available quantity'
                                  : null;
                            }),
                        const SizedBox(height: 16),
                        Text(
                            'Total: PKR ${((item['pricePerSlot'] as num) * (int.tryParse(units) ?? 0) * days).toStringAsFixed(2)}'),
                        const Text(
                            'Both dates included. Payment confirms your rental. Unpaid holds expire in 30 minutes.'),
                      ])),
                  actions: [
                    TextButton(
                        onPressed: () => Navigator.pop(ctx),
                        child: const Text('Back')),
                    FilledButton(
                        onPressed: () {
                          if (form.currentState!.validate()) {
                            Navigator.pop(ctx, int.parse(units));
                          }
                        },
                        child: const Text('Reserve'))
                  ],
                )));
    if (count == null || !mounted) return;
    await _act(() async {
      final r = await _api.dio.post('/equipment/${item['id']}/rent', data: {
        'quantity': count,
        'rentalDate': _date(_start),
        'returnDate': _date(_end)
      });
      if ((r.data['data']['totalPrice'] as num) > 0) {
        await PaymentService.checkout(r.data['data']['paymentId']);
      }
    });
  }

  Future<void> _cancel(dynamic rental) async {
    final confirmed = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
                title: const Text('Cancel rental?'),
                content: const Text(
                    'Paid amounts enter the refund queue. Cancel before collection day; contact staff for same-day changes.'),
                actions: [
                  TextButton(
                      onPressed: () => Navigator.pop(ctx, false),
                      child: const Text('Keep rental')),
                  FilledButton(
                      onPressed: () => Navigator.pop(ctx, true),
                      child: const Text('Cancel rental'))
                ]));
    if (confirmed == true) {
      await _act(() async {
        await _api.dio.post('/equipment/rentals/${rental['id']}/cancel');
      });
    }
  }

  Future<void> _return(dynamic rental) async {
    int damaged = 0;
    String notes = '';
    final form = GlobalKey<FormState>();
    final ok = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
                title: const Text('Inspect & record return'),
                content: Form(
                    key: form,
                    child: Column(mainAxisSize: MainAxisSize.min, children: [
                      TextFormField(
                          initialValue: '0',
                          decoration:
                              const InputDecoration(labelText: 'Damaged units'),
                          keyboardType: TextInputType.number,
                          validator: (s) {
                            final n = int.tryParse(s ?? '');
                            if (n == null || n < 0 || n > rental['quantity']) {
                              return 'Enter a valid quantity';
                            }
                            damaged = n;
                            return null;
                          }),
                      TextFormField(
                          decoration: const InputDecoration(
                              labelText: 'Inspection notes'),
                          maxLength: 4000,
                          onChanged: (s) => notes = s,
                          validator: (s) =>
                              damaged > 0 && (s ?? '').trim().isEmpty
                                  ? 'Describe the damage'
                                  : null),
                      const Text(
                          'Damaged units leave rentable stock. No automatic damage charge.'),
                    ])),
                actions: [
                  TextButton(
                      onPressed: () => Navigator.pop(ctx, false),
                      child: const Text('Back')),
                  FilledButton(
                      onPressed: () {
                        if (form.currentState!.validate()) {
                          Navigator.pop(ctx, true);
                        }
                      },
                      child: const Text('Record return'))
                ]));
    if (ok == true) {
      await _act(() async {
        await _api.dio.post('/equipment/rentals/${rental['id']}/return',
            data: {'damagedQuantity': damaged, 'damageNotes': notes});
      });
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
      appBar: AppBar(title: const Text('Equipment & rentals')),
      body: RefreshIndicator(
          onRefresh: _load,
          child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(20),
              children: [
                Text('Play with the right gear',
                    style: Theme.of(context).textTheme.headlineSmall),
                const Text(
                    'Venue specifications and dated availability. Prices are PKR per unit per day.'),
                const SizedBox(height: 16),
                OutlinedButton.icon(
                    onPressed: _busy ? null : _pickDates,
                    icon: const Icon(Icons.date_range),
                    label: Text('${_date(_start)} → ${_date(_end)}')),
                if (_error != null)
                  Card(
                      child: ListTile(
                          title: Text(_error!),
                          trailing: IconButton(
                              onPressed: _load,
                              icon: const Icon(Icons.refresh)))),
                if (_loading) const Center(child: CircularProgressIndicator()),
                if (!_loading && _items.isEmpty)
                  const Padding(
                      padding: EdgeInsets.all(20),
                      child: Text(
                          'No equipment listed for this venue. Contact staff for details.')),
                ..._items.map((item) => Card(
                    child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                  '${item['sport']?['name']} · ${item['venue']?['name'] ?? 'Shared inventory'}',
                                  style:
                                      Theme.of(context).textTheme.labelMedium),
                              Text(item['name'],
                                  style:
                                      Theme.of(context).textTheme.titleLarge),
                              if (item['description'] != null)
                                Text(item['description']),
                              const Divider(),
                              ...[
                                'brand',
                                'model',
                                'material',
                                'ballType',
                                'condition'
                              ].map((key) => Padding(
                                  padding:
                                      const EdgeInsets.symmetric(vertical: 3),
                                  child: Text('${{
                                    'brand': 'Brand',
                                    'model': 'Model / size',
                                    'material': 'Material / surface',
                                    'ballType': 'Ball type',
                                    'condition': 'Condition'
                                  }[key]}: ${item[key] == null || item[key] == '' ? 'Not specified by venue' : item[key]}'))),
                              const SizedBox(height: 12),
                              Text(
                                  'PKR ${item['pricePerSlot']} / day · ${item['availableQuantity']} available'),
                              if (!_admin)
                                FilledButton(
                                    onPressed: _busy ||
                                            _error != null ||
                                            item['isActive'] != true ||
                                            (item['availableQuantity'] as num) <
                                                1
                                        ? null
                                        : () => _rent(
                                            Map<String, dynamic>.from(item)),
                                    child: const Text('Reserve equipment')),
                            ])))),
                const SizedBox(height: 24),
                Text(_admin ? 'Rental desk' : 'My rentals',
                    style: Theme.of(context).textTheme.titleLarge),
                ..._rentals.map((r) => Card(
                    child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                  '${r['equipment']['name']} · ${r['quantity']} units',
                                  style:
                                      Theme.of(context).textTheme.titleMedium),
                              Text(
                                  '${r['rentalDate'].toString().substring(0, 10)} → ${(r['returnDate'] ?? r['rentalDate']).toString().substring(0, 10)}'),
                              Text(
                                  '${r['status']} · Payment: ${r['payment']?['status']} · PKR ${r['totalPrice']}'),
                              if (r['damageNotes'] != null)
                                Text('Inspection: ${r['damageNotes']}'),
                              Wrap(spacing: 8, children: [
                                if (r['status'] == 'PENDING_PAYMENT' && !_admin)
                                  FilledButton(
                                      onPressed: _busy
                                          ? null
                                          : () => _act(() async {
                                                await PaymentService.checkout(
                                                    r['payment']['id']);
                                              }),
                                      child: const Text('Pay')),
                                if (['PENDING_PAYMENT', 'CONFIRMED']
                                    .contains(r['status']))
                                  TextButton(
                                      onPressed:
                                          _busy ? null : () => _cancel(r),
                                      child: const Text('Cancel')),
                                if (_admin && r['status'] == 'CONFIRMED')
                                  FilledButton(
                                      onPressed:
                                          _busy ? null : () => _return(r),
                                      child: const Text('Record return')),
                              ]),
                            ])))),
                if (!_loading && _rentals.isEmpty)
                  const Text('No rentals yet.'),
              ])));
}
