import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/api_errors.dart';
import '../services/live_refresh.dart';
import 'equipment_screen.dart';
import 'slots_screen.dart';
import '../widgets/venue_location.dart';

class VenueDetailsScreen extends StatefulWidget {
  final int venueId;
  const VenueDetailsScreen({super.key, required this.venueId});
  @override
  State<VenueDetailsScreen> createState() => _VenueDetailsScreenState();
}

class _VenueDetailsScreenState extends State<VenueDetailsScreen>
    with LiveRefresh<VenueDetailsScreen> {
  Map<String, dynamic>? _venue;
  String? _error;
  @override
  List<String> get liveResources => ['venues', 'equipment'];
  @override
  Future<void> refreshForLiveUpdates() => _load();
  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await ApiService().dio.get('/venues/${widget.venueId}');
      if (mounted) {
        setState(() {
          _venue = Map<String, dynamic>.from(r.data['data']);
          _error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = apiErrorMessage(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final v = _venue;
    return Scaffold(
        appBar: AppBar(title: Text(v?['name'] ?? 'Venue details')),
        body: RefreshIndicator(
            onRefresh: _load,
            child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(20),
                children: [
                  if (_error != null)
                    ListTile(
                        title: Text(_error!),
                        trailing: IconButton(
                            onPressed: _load, icon: const Icon(Icons.refresh))),
                  if (v == null && _error == null)
                    const Center(child: CircularProgressIndicator()),
                  if (v != null) ...[
                    Text(v['sport']['name'],
                        style: Theme.of(context).textTheme.labelLarge),
                    Text(v['name'],
                        style: Theme.of(context).textTheme.headlineMedium),
                    Text(v['description'] ??
                        'Explore this venue and its equipment.'),
                    const SizedBox(height: 16),
                    Text(
                        '${v['openingTime']}–${v['closingTime']} Pakistan time · PKR ${v['pricePerSlot']} / session'),
                    Text(
                        'Closed days: ${(v['closedWeekdays'] as List? ?? []).map((d) => [
                              'Sun',
                              'Mon',
                              'Tue',
                              'Wed',
                              'Thu',
                              'Fri',
                              'Sat'
                            ][d]).join(', ')}'),
                    const SizedBox(height: 16),
                    FilledButton(
                        onPressed: () => Navigator.push(
                            context,
                            MaterialPageRoute(
                                builder: (_) => SlotsScreen(
                                    venueId: widget.venueId, initialVenue: v))),
                        child: const Text('View court availability')),
                    OutlinedButton(
                        onPressed: () => Navigator.push(
                            context,
                            MaterialPageRoute(
                                builder: (_) =>
                                    EquipmentScreen(venueId: widget.venueId))),
                        child: const Text('Reserve venue equipment')),
                    const SizedBox(height: 24),
                    VenueLocation(venue: v),
                    const SizedBox(height: 24),
                    Text('Equipment menu',
                        style: Theme.of(context).textTheme.titleLarge),
                    const Text(
                        'Specifications supplied by venue staff. Check dated availability before reserving.'),
                    if ((v['equipment'] as List).isEmpty)
                      const Padding(
                          padding: EdgeInsets.all(16),
                          child: Text(
                              'No venue equipment listed yet. Ask staff or browse shared inventory.')),
                    ...(v['equipment'] as List).map((e) => Card(
                        child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(e['name'],
                                      style: Theme.of(context)
                                          .textTheme
                                          .titleMedium),
                                  Text(e['description'] ?? ''),
                                  ...[
                                    'brand',
                                    'model',
                                    'material',
                                    'ballType',
                                    'condition'
                                  ].map((key) => Text('${{
                                        'brand': 'Brand',
                                        'model': 'Model / size',
                                        'material': 'Material / surface',
                                        'ballType': 'Ball type',
                                        'condition': 'Condition'
                                      }[key]}: ${e[key] ?? 'Not specified'}')),
                                  Text('PKR ${e['pricePerSlot']} / unit / day')
                                ])))),
                  ],
                ])));
  }
}
