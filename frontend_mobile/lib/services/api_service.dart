import 'package:dio/dio.dart';
import 'api_errors.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;

  final Dio _dio = Dio();
  VoidCallback? onSessionExpired;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();
  late io.Socket _socket;

  // Use 10.0.2.2 for Android emulator to access localhost, or your computer's IP for physical device
  final String baseUrl = const String.fromEnvironment('API_BASE_URL',
      defaultValue:
          kIsWeb ? 'http://localhost:5000/api' : 'http://10.0.2.2:5000/api');
  String get socketUrl => baseUrl.replaceFirst(RegExp(r'/api/?$'), '');

  ApiService._internal() {
    _dio.options.baseUrl = baseUrl;
    _dio.options.connectTimeout = const Duration(seconds: 15);
    _dio.options.receiveTimeout = const Duration(seconds: 20);
    _dio.options.headers['Content-Type'] = 'application/json';

    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _storage.read(key: 'ssh_token');
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        return handler.next(options);
      },
      onError: (DioException e, handler) async {
        if (sessionExpired(e)) {
          await _storage.delete(key: 'ssh_token');
          onSessionExpired?.call();
        }
        return handler.next(e);
      },
    ));

    _initSocket();
  }

  void _initSocket() {
    _socket = io.io(
        socketUrl,
        io.OptionBuilder()
            .setTransports(['websocket']) // for Flutter or Web
            .disableAutoConnect() // disable auto-connection
            .build());
    _socket.connect();

    _socket.onConnect((_) {
      debugPrint('Socket connected');
    });
  }

  Dio get dio => _dio;
  FlutterSecureStorage get storage => _storage;
  io.Socket get socket => _socket;
}
