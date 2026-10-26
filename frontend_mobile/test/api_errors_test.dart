import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';
import 'package:smart_sports_hub/services/api_errors.dart';

DioException failure(int? status, {String? code}) => DioException(
      requestOptions: RequestOptions(path: '/auth/me'),
      response: status == null
          ? null
          : Response(
              requestOptions: RequestOptions(),
              statusCode: status,
              data: {'code': code, 'message': 'Request rejected'}),
    );
void main() {
  test('outages and permission errors keep session; expiry clears it', () {
    for (final status in [null, 400, 401, 403, 500, 503]) {
      expect(sessionExpired(failure(status)), isFalse);
    }
    expect(sessionExpired(failure(401, code: 'SESSION_INVALID')), isTrue);
    expect(sessionExpired(failure(401, code: 'AUTH_REQUIRED')), isTrue);
  });
  test(
      'connection and service failures explain retry; credentials retain server message',
      () {
    expect(apiErrorMessage(failure(null)), contains('Cannot reach the server'));
    expect(apiErrorMessage(failure(503)), contains('temporarily unavailable'));
    expect(apiErrorMessage(failure(401)), 'Request rejected');
    expect(apiErrorMessage(Exception()), contains('Please try again'));
  });
}
