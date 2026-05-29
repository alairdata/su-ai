import 'package:flutter/foundation.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

class ErrorTrackingService {
  static const String _dsn = ''; // Set Sentry DSN before release

  static bool get isEnabled => _dsn.isNotEmpty && !kDebugMode;

  static Future<void> init() async {
    if (!isEnabled) return;

    await SentryFlutter.init(
      (options) {
        options.dsn = _dsn;
        options.tracesSampleRate = 0.2;
        options.environment = kDebugMode ? 'debug' : 'production';
      },
    );
  }

  static void captureException(dynamic exception, {StackTrace? stackTrace}) {
    if (!isEnabled) return;
    Sentry.captureException(exception, stackTrace: stackTrace);
  }

  static void setUser(String id, String email) {
    if (!isEnabled) return;
    Sentry.configureScope((scope) {
      scope.setUser(SentryUser(id: id, email: email));
    });
  }

  static void clearUser() {
    if (!isEnabled) return;
    Sentry.configureScope((scope) => scope.setUser(null));
  }

  static void addBreadcrumb(String message, {String? category}) {
    if (!isEnabled) return;
    Sentry.addBreadcrumb(Breadcrumb(
      message: message,
      category: category,
      timestamp: DateTime.now(),
    ));
  }
}
