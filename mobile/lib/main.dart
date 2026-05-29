import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_core/firebase_core.dart';
import 'app.dart';
import 'services/storage_service.dart';
import 'services/cache_service.dart';
import 'services/push_notification_service.dart';
import 'services/error_tracking_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize storage before anything reads from it
  await StorageService.instance.init();
  await CacheService.instance.init();

  // Initialize Firebase (required for push notifications)
  try {
    await Firebase.initializeApp();
  } catch (_) {
    // Firebase may not be configured yet during development
  }

  // Initialize error tracking
  await ErrorTrackingService.init();

  // Initialize push notifications
  try {
    await PushNotificationService.instance.init();
  } catch (_) {
    // Non-critical if FCM isn't set up yet
  }

  // Set preferred orientations
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  runApp(const ProviderScope(child: SoUnfilteredApp()));
}
