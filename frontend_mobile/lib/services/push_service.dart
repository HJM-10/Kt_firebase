import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'api_service.dart';

@pragma('vm:entry-point')
Future<void> firebaseBackgroundMessage(RemoteMessage message) async {
  // Notification payloads are displayed by Android while the app is backgrounded.
  await PushService.initializeFirebase();
}

class PushService {
  static bool ready = false;
  static StreamSubscription<String>? subscription;
  static StreamSubscription<RemoteMessage>? messages;
  static StreamSubscription<RemoteMessage>? opened;
  static void Function(String title, String body)? onForeground;
  static VoidCallback? onOpen;
  static const options = FirebaseOptions(
    apiKey: String.fromEnvironment('FIREBASE_API_KEY'),
    appId: String.fromEnvironment('FIREBASE_APP_ID'),
    messagingSenderId: String.fromEnvironment('FIREBASE_SENDER_ID'),
    projectId: String.fromEnvironment('FIREBASE_PROJECT_ID'),
  );
  static Future<void> initializeFirebase() async {
    if (Firebase.apps.isEmpty) await Firebase.initializeApp(options: options);
  }

  static Future<void> initialize() async {
    if (!const bool.fromEnvironment('FIREBASE_ENABLED') || kIsWeb) return;
    try {
      await initializeFirebase();
      FirebaseMessaging.onBackgroundMessage(firebaseBackgroundMessage);
      ready = true;
    } catch (error) {
      debugPrint('Firebase initialization failed: $error');
    }
  }

  static Future<void> register() async {
    if (!ready) return;
    try {
      await FirebaseMessaging.instance.requestPermission();
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) await _send(token);
      await subscription?.cancel();
      await messages?.cancel();
      await opened?.cancel();
      subscription =
          FirebaseMessaging.instance.onTokenRefresh.listen((token) async {
        try {
          await _send(token);
        } catch (error) {
          debugPrint('Push token update failed: $error');
        }
      });
      messages = FirebaseMessaging.onMessage.listen((message) {
        onForeground?.call(message.notification?.title ?? 'Arena update',
            message.notification?.body ?? 'Open notifications for details.');
      });
      opened =
          FirebaseMessaging.onMessageOpenedApp.listen((_) => onOpen?.call());
      if (await FirebaseMessaging.instance.getInitialMessage() != null) {
        onOpen?.call();
      }
    } catch (error) {
      debugPrint('Push registration failed: $error');
    }
  }

  static Future<void> _send(String? token) => ApiService()
      .dio
      .post('/notifications/fcm-token', data: {'fcmToken': token});
  static Future<void> unregister() async {
    await subscription?.cancel();
    await messages?.cancel();
    await opened?.cancel();
    subscription = null;
    messages = null;
    opened = null;
    if (!ready) return;
    try {
      await _send(null);
    } catch (error) {
      debugPrint('Push unregister failed: $error');
    }
    // Revoke the device token even if the API is unavailable or the JWT expired.
    try {
      await FirebaseMessaging.instance.deleteToken();
    } catch (error) {
      debugPrint('Push token deletion failed: $error');
    }
  }
}
