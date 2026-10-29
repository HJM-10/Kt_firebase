import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import '../services/api_errors.dart';
import '../services/live_refresh.dart';

class AdminReportsScreen extends StatefulWidget {
  const AdminReportsScreen({super.key});
  @override
  State<AdminReportsScreen> createState() => _AdminReportsScreenState();
}

class _AdminReportsScreenState extends State<AdminReportsScreen>
    with LiveRefresh<AdminReportsScreen> {
  Map<String, dynamic>? _revenue, _utilization, _bookings;
  DateTimeRange? _range;
  String? _error;
  bool _loading = true;
  int _version = 0;
  @override
  List<String> get liveResources => ['reports'];
  @override
  Future<void> refreshForLiveUpdates() => _load();
  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final version = ++_version;
    final params = _range == null
        ? <String, String>{}
        : {
            'from': DateFormat('yyyy-MM-dd').format(_range!.start),
            'to': DateFormat('yyyy-MM-dd').format(_range!.end)
          };
    try {
      final results = await Future.wait([
        '/revenue',
        '/utilization',
        '/bookings'
      ].map(
          (p) => ApiService().dio.get('/reports$p', queryParameters: params)));
      if (mounted && version == _version) {
        setState(() {
          _revenue = Map<String, dynamic>.from(results[0].data['data']);
          _utilization = Map<String, dynamic>.from(results[1].data['data']);
          _bookings = Map<String, dynamic>.from(results[2].data['data']);
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

  Future<void> _pick() async {
    final range = await showDateRangePicker(
        context: context,
        firstDate: DateTime(2020),
        lastDate: DateTime.now().add(const Duration(days: 365)),
        initialDateRange: _range);
    if (range != null && mounted) {
      setState(() => _range = range);
      await _load();
    }
  }

  Widget _metric(String name, String value) => Card(
      child: ListTile(
          title: Text(name),
          subtitle:
              Text(value, style: Theme.of(context).textTheme.titleLarge)));
  @override
  Widget build(BuildContext context) => Scaffold(
      appBar: AppBar(title: const Text('Reports & analytics')),
      body: RefreshIndicator(
          onRefresh: _load,
          child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(20),
              children: [
                Wrap(spacing: 8, children: [
                  OutlinedButton.icon(
                      onPressed: _pick,
                      icon: const Icon(Icons.date_range),
                      label: Text(_range == null
                          ? 'Choose date range'
                          : '${DateFormat.yMMMd().format(_range!.start)} – ${DateFormat.yMMMd().format(_range!.end)}')),
                  TextButton(
                      onPressed: () {
                        setState(() => _range = null);
                        _load();
                      },
                      child: const Text('All dates'))
                ]),
                const Text(
                    'Pakistan calendar days. Revenue uses receipt/refund dates; booking counts use creation dates; utilization uses session dates.'),
                if (_loading) const Center(child: CircularProgressIndicator()),
                if (_error != null)
                  ListTile(
                      title: Text(_error!),
                      trailing: IconButton(
                          onPressed: _load, icon: const Icon(Icons.refresh))),
                _metric('Net revenue', 'PKR ${_revenue?['totalRevenue'] ?? 0}'),
                _metric(
                    'Gross receipts', 'PKR ${_revenue?['grossRevenue'] ?? 0}'),
                _metric('Completed refunds',
                    'PKR ${_revenue?['refundedAmount'] ?? 0}'),
                _metric('Pending refunds',
                    'PKR ${_revenue?['pendingRefunds'] ?? 0}'),
                _metric('Court utilization (minutes)',
                    '${((_utilization?['utilizationRate'] ?? 0) as num).toStringAsFixed(1)}%'),
                Text(
                    '${_utilization?['bookedSlots'] ?? 0} / ${_utilization?['totalSlots'] ?? 0} confirmed sessions'),
                const SizedBox(height: 16),
                Text('Bookings by status',
                    style: Theme.of(context).textTheme.titleLarge),
                ...((_bookings?['statusCounts'] ?? {}) as Map).entries.map(
                    (e) => ListTile(
                        title: Text(e.key.toString().replaceAll('_', ' ')),
                        trailing: Text('${e.value}'))),
              ])));
}
