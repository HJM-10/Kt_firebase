DateTime slotStartsAt(Map<String, dynamic> slot) {
  final date = (slot['date'] as String).split('T').first;
  return DateTime.parse('${date}T${slot['startTime']}:00+05:00');
}

bool isUpcomingBooking(Map<String, dynamic> booking, DateTime now) =>
    booking['status'] == 'CONFIRMED' &&
    slotStartsAt(Map<String, dynamic>.from(booking['slot'])).isAfter(now);
