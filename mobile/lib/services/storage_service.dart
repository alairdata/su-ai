import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../config/constants.dart';
import '../models/user.dart';

class StorageService {
  static StorageService? _instance;
  static StorageService get instance => _instance ??= StorageService._();

  StorageService._();

  final _secure = const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
  );

  late SharedPreferences _prefs;

  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
  }

  // Auth token
  Future<String?> getToken() => _secure.read(key: AppConstants.authTokenKey);

  Future<void> setToken(String token) =>
      _secure.write(key: AppConstants.authTokenKey, value: token);

  Future<void> clearToken() => _secure.delete(key: AppConstants.authTokenKey);

  // User data (cached in prefs for quick access)
  Future<User?> getUser() async {
    final json = _prefs.getString(AppConstants.userKey);
    if (json == null) return null;
    try {
      return User.fromJson(jsonDecode(json) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  Future<void> setUser(User user) async {
    await _prefs.setString(AppConstants.userKey, jsonEncode(user.toJson()));
  }

  Future<void> clearUser() async {
    await _prefs.remove(AppConstants.userKey);
  }

  // Theme preference
  bool get isDarkMode => _prefs.getBool(AppConstants.themeKey) ?? true;

  Future<void> setDarkMode(bool value) =>
      _prefs.setBool(AppConstants.themeKey, value);

  // Clear all
  Future<void> clearAll() async {
    await _secure.deleteAll();
    await _prefs.clear();
  }
}
