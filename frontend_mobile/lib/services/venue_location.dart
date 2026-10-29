bool hasVenuePin(Map<String, dynamic> venue) {
  final lat = venue['latitude'], lng = venue['longitude'];
  return lat is num &&
      lat.isFinite &&
      lat.abs() <= 90 &&
      lng is num &&
      lng.isFinite &&
      lng.abs() <= 180;
}

Uri? venueDirections(Map<String, dynamic> venue) => hasVenuePin(venue)
    ? Uri.https('www.google.com', '/maps/dir/', {
        'api': '1',
        'destination': '${venue['latitude']},${venue['longitude']}',
        'dir_action': 'navigate',
      })
    : null;
