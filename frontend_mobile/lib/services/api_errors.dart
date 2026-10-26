import 'package:dio/dio.dart';

bool sessionExpired(DioException error) {
  final data = error.response?.data;
  return error.response?.statusCode == 401 &&
      data is Map &&
      ['AUTH_REQUIRED', 'SESSION_INVALID'].contains(data['code']);
}

String apiErrorMessage(Object error) {
  if (error is! DioException) return 'Something went wrong. Please try again.';
  if (error.response == null) {
    return 'Cannot reach the server. Check your connection and try again.';
  }
  if ((error.response?.statusCode ?? 0) >= 500) {
    return 'Service temporarily unavailable. Please try again.';
  }
  final data = error.response?.data;
  return data is Map && data['message'] is String
      ? data['message'] as String
      : 'Request failed. Please try again.';
}
