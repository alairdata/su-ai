import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/user.dart';
import '../services/auth_service.dart';
import '../services/storage_service.dart';
import '../services/api_client.dart';

enum AuthStatus { initial, loading, authenticated, unauthenticated }

class AuthState {
  final AuthStatus status;
  final User? user;
  final String? error;

  const AuthState({
    this.status = AuthStatus.initial,
    this.user,
    this.error,
  });

  AuthState copyWith({AuthStatus? status, User? user, String? error}) {
    return AuthState(
      status: status ?? this.status,
      user: user ?? this.user,
      error: error,
    );
  }
}

class AuthNotifier extends StateNotifier<AuthState> {
  final AuthService _authService = AuthService();
  final StorageService _storage = StorageService.instance;

  AuthNotifier() : super(const AuthState()) {
    _init();
  }

  Future<void> _init() async {
    // Set up force logout callback
    ApiClient.instance.onForceLogout = () {
      logout();
    };

    // Try to restore session
    state = state.copyWith(status: AuthStatus.loading);

    final cachedUser = await _storage.getUser();
    final token = await _storage.getToken();

    if (cachedUser != null && token != null) {
      // Show cached user immediately
      state = state.copyWith(status: AuthStatus.authenticated, user: cachedUser);

      // Refresh in background
      final result = await _authService.refreshSession();
      if (result.success && result.user != null) {
        state = state.copyWith(user: result.user);
        _syncTimezone();
      } else {
        // Token invalid, force logout
        await _storage.clearAll();
        state = const AuthState(status: AuthStatus.unauthenticated);
      }
    } else {
      state = const AuthState(status: AuthStatus.unauthenticated);
    }
  }

  Future<String?> login(String email, String password) async {
    state = state.copyWith(status: AuthStatus.loading, error: null);

    final result = await _authService.login(email, password);
    if (result.success && result.user != null) {
      state = AuthState(
        status: AuthStatus.authenticated,
        user: result.user,
      );
      return null;
    } else {
      state = AuthState(
        status: AuthStatus.unauthenticated,
        error: result.error,
      );
      return result.error;
    }
  }

  Future<String?> signup(String name, String email, String password) async {
    state = state.copyWith(status: AuthStatus.loading, error: null);

    final result = await _authService.signup(name, email, password);
    if (result.success) {
      state = const AuthState(status: AuthStatus.unauthenticated);
      return null; // Success
    } else {
      state = AuthState(
        status: AuthStatus.unauthenticated,
        error: result.error,
      );
      return result.error;
    }
  }

  Future<String?> forgotPassword(String email) async {
    final result = await _authService.forgotPassword(email);
    return result.success ? null : result.error;
  }

  void updateUser(User user) {
    state = state.copyWith(user: user);
    _storage.setUser(user);
  }

  /// Auto-detect and sync timezone with server
  /// Uses a separate Dio call to avoid triggering force-logout on 401
  Future<void> _syncTimezone() async {
    try {
      final offset = DateTime.now().timeZoneOffset;
      final hours = offset.inHours;
      final mins = (offset.inMinutes % 60).abs();
      final sign = hours >= 0 ? '+' : '';
      final tzString = 'UTC$sign$hours${mins > 0 ? ':${mins.toString().padLeft(2, '0')}' : ''}';

      if (state.user != null && state.user!.timezone != tzString) {
        // Use a direct Dio call with token to avoid interceptor force-logout
        final token = await _storage.getToken();
        if (token == null) return;
        final dio = Dio(BaseOptions(
          baseUrl: 'https://sounfilteredai.com',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $token',
          },
        ));
        await dio.post('/api/user/timezone', data: {'timezone': tzString});
        if (state.user != null) {
          state = state.copyWith(
            user: state.user!.copyWith(timezone: tzString),
          );
        }
      }
    } catch (_) {
      // Non-critical, ignore failures
    }
  }

  /// Increment the local message counter after sending a message
  void incrementMessageCount() {
    if (state.user == null) return;
    final updated = state.user!.copyWith(
      messagesUsedToday: state.user!.messagesUsedToday + 1,
      totalMessages: state.user!.totalMessages + 1,
    );
    updateUser(updated);
  }

  Future<void> logout() async {
    await _authService.logout();
    state = const AuthState(status: AuthStatus.unauthenticated);
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier();
});
