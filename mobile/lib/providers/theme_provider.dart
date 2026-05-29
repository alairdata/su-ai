import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/storage_service.dart';

class ThemeNotifier extends StateNotifier<bool> {
  ThemeNotifier() : super(true) {
    _load();
  }

  void _load() {
    state = StorageService.instance.isDarkMode;
  }

  void toggle() {
    state = !state;
    StorageService.instance.setDarkMode(state);
  }

  void set(bool isDark) {
    state = isDark;
    StorageService.instance.setDarkMode(state);
  }
}

/// true = dark mode, false = light mode
final themeProvider = StateNotifierProvider<ThemeNotifier, bool>((ref) {
  return ThemeNotifier();
});
