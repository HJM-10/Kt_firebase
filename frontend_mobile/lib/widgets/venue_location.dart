import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart' as google;
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';
import '../services/venue_location.dart';

class VenueMap extends StatefulWidget {
  final Map<String, dynamic> venue;
  final void Function(double latitude, double longitude)? onChanged;
  const VenueMap({super.key, required this.venue, this.onChanged});
  @override
  State<VenueMap> createState() => _VenueMapState();
}

class _VenueMapState extends State<VenueMap> {
  final _map = MapController();
  google.GoogleMapController? _googleMap;
  bool _mapReady = false;
  @override
  void didUpdateWidget(covariant VenueMap oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!hasVenuePin(widget.venue) ||
        (oldWidget.venue['latitude'] == widget.venue['latitude'] &&
            oldWidget.venue['longitude'] == widget.venue['longitude'])) {
      return;
    }
    final lat = (widget.venue['latitude'] as num).toDouble();
    final lng = (widget.venue['longitude'] as num).toDouble();
    if (_mapReady) _map.move(LatLng(lat, lng), _map.camera.zoom);
    _googleMap
        ?.animateCamera(google.CameraUpdate.newLatLng(google.LatLng(lat, lng)));
  }

  @override
  void dispose() {
    _map.dispose();
    _googleMap?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final venue = widget.venue;
    final onChanged = widget.onChanged;
    final pin = hasVenuePin(venue);
    final lat = pin ? (venue['latitude'] as num).toDouble() : 30.3753;
    final lng = pin ? (venue['longitude'] as num).toDouble() : 69.3451;
    const googleEnabled = bool.fromEnvironment('GOOGLE_MAPS_ENABLED');
    return SizedBox(
        height: 250,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: googleEnabled
              ? google.GoogleMap(
                  onMapCreated: (controller) => _googleMap = controller,
                  initialCameraPosition: google.CameraPosition(
                      target: google.LatLng(lat, lng), zoom: pin ? 15 : 5),
                  myLocationButtonEnabled: false,
                  mapToolbarEnabled: false,
                  onTap: onChanged == null
                      ? null
                      : (p) => onChanged(p.latitude, p.longitude),
                  markers: {
                    if (pin)
                      google.Marker(
                          markerId: const google.MarkerId('entrance'),
                          position: google.LatLng(lat, lng),
                          draggable: onChanged != null,
                          onDragEnd: (p) =>
                              onChanged?.call(p.latitude, p.longitude))
                  },
                )
              : FlutterMap(
                  mapController: _map,
                  options: MapOptions(
                      onMapReady: () => _mapReady = true,
                      initialCenter: LatLng(lat, lng),
                      initialZoom: pin ? 15 : 5,
                      onTap: onChanged == null
                          ? null
                          : (_, p) => onChanged(p.latitude, p.longitude)),
                  children: [
                    TileLayer(
                        urlTemplate: const String.fromEnvironment(
                            'MAP_TILE_URL',
                            defaultValue:
                                'https://tile.openstreetmap.org/{z}/{x}/{y}.png'),
                        userAgentPackageName: 'com.example.smart_sports_hub'),
                    if (pin)
                      MarkerLayer(markers: [
                        Marker(
                            point: LatLng(lat, lng),
                            width: 44,
                            height: 44,
                            child: Icon(Icons.location_pin,
                                size: 42,
                                color: Theme.of(context).colorScheme.primary))
                      ]),
                    RichAttributionWidget(attributions: [
                      TextSourceAttribution(
                          const String.fromEnvironment('MAP_ATTRIBUTION',
                              defaultValue: 'OpenStreetMap contributors'),
                          onTap: () => launchUrl(
                              Uri.parse(
                                  'https://www.openstreetmap.org/copyright'),
                              mode: LaunchMode.externalApplication))
                    ]),
                  ],
                ),
        ));
  }
}

class VenueLocation extends StatelessWidget {
  final Map<String, dynamic> venue;
  const VenueLocation({super.key, required this.venue});
  Future<void> _directions(BuildContext context) async {
    final uri = venueDirections(venue);
    if (uri == null) return;
    try {
      if (await launchUrl(uri, mode: LaunchMode.externalApplication)) return;
    } catch (_) {}
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text(
              'Google Maps could not open. Use the address and entrance coordinates below.')));
    }
  }

  @override
  Widget build(BuildContext context) => Card(
          child: Padding(
        padding: const EdgeInsets.all(16),
        child:
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text('Find your way here',
              style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          Text((venue['address'] as String?)?.isNotEmpty == true
              ? venue['address']
              : 'Street address has not been added yet.'),
          if (hasVenuePin(venue)) ...[
            const SizedBox(height: 12),
            VenueMap(venue: venue),
            const SizedBox(height: 8),
            Text(
                'Entrance: ${(venue['latitude'] as num).toStringAsFixed(6)}, ${(venue['longitude'] as num).toStringAsFixed(6)}'),
            OutlinedButton.icon(
                onPressed: () => _directions(context),
                icon: const Icon(Icons.directions),
                label: const Text('Directions in Google Maps')),
            const Text(
                'Google Maps uses your current location when available, or lets you choose a starting point.'),
          ] else
            const Text(
                'Entrance pin not added yet. Ask staff for the location before travelling.'),
        ]),
      ));
}
