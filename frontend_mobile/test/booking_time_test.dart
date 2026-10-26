import 'package:flutter_test/flutter_test.dart';
import 'package:smart_sports_hub/utils/booking_time.dart';

void main() {
  final now = DateTime.parse('2026-10-17T20:00:00+05:00');
  Map<String, dynamic> booking(String time,
          {String status = 'CONFIRMED', String date = '2026-10-17'}) =>
      {
        'status': status,
        'slot': {'date': '${date}T00:00:00.000Z', 'startTime': time}
      };
  test('today future booking counts; earlier and current slots do not', () {
    expect(isUpcomingBooking(booking('21:00'), now), isTrue);
    expect(isUpcomingBooking(booking('19:00'), now), isFalse);
    expect(isUpcomingBooking(booking('20:00'), now), isFalse);
  });
  test('tomorrow counts; cancelled, unpaid and attended bookings do not', () {
    expect(
        isUpcomingBooking(booking('09:00', date: '2026-10-18'), now), isTrue);
    for (final status in ['CANCELLED', 'PENDING_PAYMENT', 'SCANNED']) {
      expect(isUpcomingBooking(booking('21:00', status: status), now), isFalse);
    }
  });
  test('arena offset produces the same instant regardless of device timezone',
      () {
    expect(slotStartsAt({'date': '2026-10-17', 'startTime': '21:00'}).toUtc(),
        DateTime.utc(2026, 10, 17, 16));
  });
}
