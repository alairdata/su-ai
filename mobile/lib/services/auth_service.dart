import 'package:dio/dio.dart';
import '../models/user.dart';
import 'api_client.dart';
import 'storage_service.dart';

class AuthResult {
  final bool success;
  final String? error;
  final User? user;
  final String? token;

  const AuthResult({
    required this.success,
    this.error,
    this.user,
    this.token,
  });
}

class SignupResult {
  final bool success;
  final String? message;
  final String? error;

  const SignupResult({required this.success, this.message, this.error});
}

class AuthService {
  final ApiClient _api = ApiClient.instance;
  final StorageService _storage = StorageService.instance;

  Future<AuthResult> login(String email, String password) async {
    try {
      final response = await _api.post('/api/auth/mobile', data: {
        'action': 'login',
        'email': email.trim().toLowerCase(),
        'password': password,
      });

      final data = response.data as Map<String, dynamic>;
      final user = User.fromJson(data['user'] as Map<String, dynamic>);
      final token = data['token'] as String;

      await _storage.setToken(token);
      await _storage.setUser(user);

      return AuthResult(success: true, user: user, token: token);
    } catch (e) {
      return AuthResult(success: false, error: _extractError(e));
    }
  }

  Future<SignupResult> signup(String name, String email, String password) async {
    try {
      final response = await _api.post('/api/signup', data: {
        'name': name.trim(),
        'email': email.trim().toLowerCase(),
        'password': password,
        'website': '', // honeypot
      });

      final data = response.data as Map<String, dynamic>;
      return SignupResult(
        success: true,
        message: data['message'] as String?,
      );
    } catch (e) {
      return SignupResult(success: false, error: _extractError(e));
    }
  }

  Future<SignupResult> forgotPassword(String email) async {
    try {
      final response = await _api.post('/api/auth/forgot-password', data: {
        'email': email.trim().toLowerCase(),
      });

      final data = response.data as Map<String, dynamic>;
      return SignupResult(
        success: true,
        message: data['message'] as String?,
      );
    } catch (e) {
      return SignupResult(success: false, error: _extractError(e));
    }
  }

  Future<AuthResult> refreshSession() async {
    try {
      final token = await _storage.getToken();
      if (token == null) {
        return const AuthResult(success: false, error: 'No token found');
      }

      final response = await _api.post('/api/auth/mobile', data: {
        'action': 'refresh',
        'token': token,
      });

      final data = response.data as Map<String, dynamic>;
      final user = User.fromJson(data['user'] as Map<String, dynamic>);
      final newToken = data['token'] as String;

      await _storage.setToken(newToken);
      await _storage.setUser(user);

      return AuthResult(success: true, user: user, token: newToken);
    } catch (e) {
      return AuthResult(success: false, error: _extractError(e));
    }
  }

  Future<void> logout() async {
    await _storage.clearToken();
    await _storage.clearUser();
  }

  String _extractError(dynamic e) {
    if (e is DioException) {
      if (e.response?.statusCode == 429) {
        return 'Too many attempts. Please try again later.';
      }
      final data = e.response?.data;
      if (data is Map<String, dynamic>) {
        return data['error'] as String? ??
            data['message'] as String? ??
            'Something went wrong';
      }
    }
    return 'Connection error. Please check your internet.';
  }
}
