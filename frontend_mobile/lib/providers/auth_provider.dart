import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/api_errors.dart';
import '../services/push_service.dart';
import 'package:dio/dio.dart';

class AuthProvider with ChangeNotifier {
  final ApiService _apiService = ApiService();
  AuthProvider() {
    _apiService.onSessionExpired = () {
      _user = null;
      _isAuthenticated = false;
      notifyListeners();
    };
  }
  String? lastError;
  bool _isAuthenticated = false;
  bool _isLoading = true;
  Map<String, dynamic>? _user;

  bool get isAuthenticated => _isAuthenticated;
  bool get isLoading => _isLoading;
  Map<String, dynamic>? get user => _user;

  Future<void> checkAuth() async {
    _isLoading = true;
    notifyListeners();

    // The user requested that the app should ALWAYS ask for a password on startup.
    // So we clear any existing token instead of attempting to auto-login.
    if (await _apiService.storage.read(key: 'ssh_token') != null) {
      await PushService.unregister();
    }
    await _apiService.storage.delete(key: 'ssh_token');
    _user = null;
    _isAuthenticated = false;

    _isLoading = false;
    notifyListeners();
  }

  Future<String?> login(String email, String password,
      {bool firebase = false, String existingPassword = ''}) async {
    try {
      final Response res;
      if (firebase) {
        final config =
            (await _apiService.dio.get('/auth/providers')).data['data'];
        if (config['firebase'] != true) {
          return 'Firebase sign-in is not configured. Use your existing account.';
        }
        final identity = await Dio(BaseOptions(
                connectTimeout: const Duration(seconds: 15),
                receiveTimeout: const Duration(seconds: 20)))
            .post(
                'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword',
                queryParameters: {
              'key': config['firebaseApiKey']
            },
                data: {
              'email': email,
              'password': password,
              'returnSecureToken': true
            });
        res = await _apiService.dio.post('/auth/firebase', data: {
          'idToken': identity.data['idToken'],
          if (existingPassword.isNotEmpty) 'existingPassword': existingPassword
        });
      } else {
        res = await _apiService.dio.post('/auth/login', data: {
          'email': email,
          'password': password,
        });
      }
      final data = res.data['data'];
      await _apiService.storage.write(key: 'ssh_token', value: data['token']);
      _user = data['user'];
      _isAuthenticated = true;
      await PushService.register();
      notifyListeners();
      return null;
    } catch (e) {
      return apiErrorMessage(e);
    }
  }

  Future<bool> signup(
      String name, String email, String password, String phone) async {
    try {
      final res = await _apiService.dio.post('/auth/register', data: {
        'name': name,
        'email': email,
        'password': password,
        'phone': phone,
      });
      final data = res.data['data'];
      await _apiService.storage.write(key: 'ssh_token', value: data['token']);
      _user = data['user'];
      _isAuthenticated = true;
      await PushService.register();
      notifyListeners();
      return true;
    } catch (e) {
      return false;
    }
  }

  void updateUser(Map<String, dynamic> updates) {
    if (_user != null) {
      _user = {..._user!, ...updates};
      notifyListeners();
    }
  }

  Future<void> logout() async {
    await PushService.unregister();
    await _apiService.storage.delete(key: 'ssh_token');
    _user = null;
    _isAuthenticated = false;
    notifyListeners();
  }
}
