import 'package:intl/intl.dart';

List<Map<String, dynamic>> arenaMaps(dynamic items) =>
    (items as List? ?? []).map((e) => Map<String, dynamic>.from(e)).toList();
DateTime pakistanNow([DateTime? now]) =>
    (now ?? DateTime.now()).toUtc().add(const Duration(hours: 5));
DateTime arenaToday([DateTime? now]) {
  final day = pakistanNow(now);
  return DateTime(day.year, day.month, day.day);
}

String arenaDate(DateTime day) => DateFormat('yyyy-MM-dd').format(day);
String arenaTime(String time) {
  final parts = time.split(':');
  return DateFormat.jm()
      .format(DateTime(2026, 1, 1, int.parse(parts[0]), int.parse(parts[1])));
}

int arenaMinutes(String time) {
  final parts = time.split(':');
  return int.parse(parts[0]) * 60 + int.parse(parts[1]);
}

DateTime arenaInstant(String date, String time) =>
    DateTime.parse('${date.split('T').first}T$time:00+05:00');
Map<String, dynamic>? slotBooking(Map<String, dynamic> slot) {
  for (final booking in arenaMaps(slot['bookings'])) {
    if (booking['status'] != 'CANCELLED') return booking;
  }
  return null;
}

String slotLabel(Map<String, dynamic> slot, String date, DateTime now) {
  if (slot['unavailableReason'] != null && slotBooking(slot) == null) {
    return 'Unavailable';
  }
  final booking = slotBooking(slot);
  if (booking?['status'] == 'PENDING_PAYMENT') return 'Awaiting payment';
  if (booking?['status'] == 'SCANNED') return 'Checked in';
  if (booking != null || slot['isBooked'] == true) return 'Reserved';
  if (!arenaInstant(date, slot['startTime']).isAfter(now)) {
    return 'Past session';
  }
  return 'Open session';
}

String venueStatus(Map<String, dynamic> venue, String date, DateTime now) {
  if (venue['isActive'] == false || venue['sport']?['isActive'] == false) {
    return 'Inactive';
  }
  final slots = arenaMaps(venue['slots']);
  if (slots.isEmpty) return 'No sessions published';
  final selected = DateTime.parse(date);
  if (selected.isBefore(arenaToday(now))) return 'Past schedule';
  for (final slot in slots) {
    if (!arenaInstant(date, slot['startTime']).isAfter(now) &&
        arenaInstant(date, slot['endTime']).isAfter(now)) {
      final booking = slotBooking(slot);
      if (booking?['status'] == 'SCANNED') return 'In use';
      if (booking?['status'] == 'PENDING_PAYMENT') return 'Awaiting payment';
      if (booking != null || slot['isBooked'] == true) return 'Reserved now';
    }
  }
  final open = slots
      .where((s) =>
          s['isBooked'] != true &&
          slotBooking(s) == null &&
          arenaInstant(date, s['startTime']).isAfter(now))
      .length;
  if (open > 0) return '$open open session${open == 1 ? '' : 's'}';
  if (slots.any((s) => arenaInstant(date, s['endTime']).isAfter(now))) {
    return 'Fully reserved';
  }
  return 'Day complete';
}
