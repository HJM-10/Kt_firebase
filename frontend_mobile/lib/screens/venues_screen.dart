import 'package:flutter/material.dart';
import '../services/live_refresh.dart';
import '../services/api_service.dart';
import '../widgets/clubhouse.dart';
import '../widgets/venue_card.dart';
import 'slots_screen.dart';

class VenuesScreen extends StatefulWidget {
  final int sportId;
  final String sportName;
  const VenuesScreen(
      {super.key, required this.sportId, required this.sportName});
  @override
  State<VenuesScreen> createState() => _VenuesScreenState();
}

class _VenuesScreenState extends State<VenuesScreen>
    with LiveRefresh<VenuesScreen> {
  final _api = ApiService();
  List<dynamic> _venues = [];
  bool _loading = true;
  String? _error;
  @override
  List<String> get liveResources => ['venues'];
  @override
  Future<void> refreshForLiveUpdates() => _fetch();
  @override
  void initState() {
    super.initState();
    _fetch();
  }

  Future<void> _fetch() async {
    try {
      final response = await _api.dio
          .get('/venues', queryParameters: {'sportId': widget.sportId});
      if (mounted) {
        setState(() {
          _venues = response.data['data'];
          _error = null;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Check your connection and try again.');
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
            title: Text(widget.sportName), actions: const [ThemeToggle()]),
        body: RefreshIndicator(
            onRefresh: _fetch,
            child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(20),
                children: [
                  const ClubhouseHeading('Your court is calling.',
                      subtitle: 'Choose a venue, then find a time that fits.'),
                  const SizedBox(height: 24),
                  if (_loading)
                    const Center(child: CircularProgressIndicator())
                  else if (_error != null)
                    ClubhouseEmpty(
                        title: 'Venues could not load',
                        message: _error!,
                        onRetry: _fetch)
                  else if (_venues.isEmpty)
                    const ClubhouseEmpty(
                        title: 'No venues just yet',
                        message: 'Try another sport or check back soon.')
                  else
                    ..._venues.map((v) => VenueCard(
                        venue: Map<String, dynamic>.from(v),
                        onBook: () => Navigator.push(
                            context,
                            MaterialPageRoute(
                                builder: (_) => SlotsScreen(
                                    venueId: v['id'],
                                    initialVenue:
                                        Map<String, dynamic>.from(v)))))),
                ])),
      );
}
