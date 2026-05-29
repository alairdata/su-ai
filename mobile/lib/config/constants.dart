class AppConstants {
  AppConstants._();

  // API
  static const String apiBaseUrl = 'https://sounfilteredai.com';

  // Plan limits
  static const Map<String, int> planLimits = {
    'Free': 5,
    'Pro': 100,
    'Plus': 300,
  };

  // Plan pricing
  static const Map<String, double> planPricesUSD = {
    'Free': 0,
    'Pro': 4.99,
    'Plus': 9.99,
  };

  // Storage keys
  static const String authTokenKey = 'auth_token';
  static const String themeKey = 'theme_mode';
  static const String userKey = 'user_data';

  // Validation
  static const int maxMessageLength = 32000;
  static const int maxNameLength = 100;
  static const int maxChatTitleLength = 200;
  static const int minPasswordLength = 10;
  static const int maxPasswordLength = 128;

  // UI
  static const double maxChatWidth = 800;
  static const int messageAnimationMs = 300;
}
