import 'package:flutter/material.dart';
import '../services/live_refresh.dart';
import '../services/api_service.dart';
import '../widgets/clubhouse.dart';
import 'venues_screen.dart';

class SportsScreen extends StatefulWidget {
  const SportsScreen({super.key});
  @override
  State<SportsScreen> createState() => _SportsScreenState();
}

class _SportsScreenState extends State<SportsScreen>
    with LiveRefresh<SportsScreen> {
  final _api = ApiService();
  List<dynamic> _sports = [];
  bool _loading = true;
  String? _error;
  @override
  List<String> get liveResources => ['sports'];
  @override
  Future<void> refreshForLiveUpdates() => _fetch();
  @override
  void initState() {
    super.initState();
    _fetch();
  }

  Future<void> _fetch() async {
    try {
      final res = await _api.dio.get('/sports');
      if (mounted) {
        setState(() {
          _sports = res.data['data'];
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
            title: const Text('Sports & venues'),
            actions: const [ThemeToggle()]),
        body: RefreshIndicator(
            onRefresh: _fetch,
            child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(20),
                children: [
                  const ClubhouseHeading('What’s your game?',
                      subtitle:
                          'Find a familiar favourite. Try something new.'),
                  const SizedBox(height: 24),
                  if (_loading)
                    const Center(child: CircularProgressIndicator())
                  else if (_error != null)
                    ClubhouseEmpty(
                        title: 'Sports could not load',
                        message: _error!,
                        onRetry: _fetch)
                  else if (_sports.isEmpty)
                    const ClubhouseEmpty(
                        title: 'More games ahead',
                        message: 'New sports will appear here when available.')
                  else
                    ..._sports.map((sport) => Padding(
                        padding: const EdgeInsets.only(bottom: 14),
                        child: Card(
                          clipBehavior: Clip.antiAlias,
                          margin: EdgeInsets.zero,
                          child: InkWell(
                            onTap: () => Navigator.push(
                                context,
                                MaterialPageRoute(
                                    builder: (_) => VenuesScreen(
                                        sportId: sport['id'],
                                        sportName: sport['name']))),
                            child: Row(children: [
                              SizedBox(
                                  width: 100,
                                  child: ClubhouseImage(
                                      sport: sport['name'],
                                      imageUrl: sport['imageUrl'],
                                      height: 110,
                                      showCaption: false)),
                              const SizedBox(width: 16),
                              Expanded(
                                  child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                    Text(sport['name'],
                                        style: const TextStyle(
                                            fontSize: 21,
                                            fontWeight: FontWeight.w700)),
                                    const SizedBox(height: 6),
                                    Text(
                                        '${sport['_count']?['venues'] ?? 0} venues',
                                        style: TextStyle(
                                            color: Theme.of(context)
                                                .colorScheme
                                                .onSurfaceVariant)),
                                  ])),
                              const Icon(Icons.arrow_forward, size: 20),
                              const SizedBox(width: 16),
                            ]),
                          ),
                        ))),
                ])),
      );
}
