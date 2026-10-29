import 'package:flutter_test/flutter_test.dart';
import 'package:smart_sports_hub/services/venue_location.dart';

void main() {
  test('valid entrance routes to Google Maps without a fixed origin', () {
    final url = venueDirections({'latitude': 0, 'longitude': 0})!;
    expect(url.host, 'www.google.com');
    expect(url.queryParameters['api'], '1');
    expect(url.queryParameters['destination'], '0,0');
    expect(url.queryParameters.containsKey('origin'), false);
  });
  test('missing or invalid locations do not offer incorrect directions', () {
    for (final v in <Map<String, dynamic>>[
      {},
      {'latitude': 90.1, 'longitude': 0},
      {'latitude': 1, 'longitude': null},
      {'latitude': '1', 'longitude': '2'},
      {'latitude': double.nan, 'longitude': 0}
    ]) {
      expect(hasVenuePin(v), false);
      expect(venueDirections(v), null);
    }
  });
}
