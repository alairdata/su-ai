import 'package:dio/dio.dart';
import '../config/constants.dart';
import 'storage_service.dart';

class ApiClient {
  static ApiClient? _instance;
  static ApiClient get instance => _instance ??= ApiClient._();

  late final Dio dio;
  final StorageService _storage = StorageService.instance;

  // Callback for force logout (set by auth provider)
  void Function()? onForceLogout;

  ApiClient._() {
    dio = Dio(BaseOptions(
      baseUrl: AppConstants.apiBaseUrl,
      connectTimeout: const Duration(seconds: 30),
      receiveTimeout: const Duration(seconds: 60),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    ));

    // Auth interceptor
    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _storage.getToken();
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) async {
        if (error.response?.statusCode == 401) {
          // Try token refresh
          final refreshed = await _tryRefreshToken();
          if (refreshed) {
            // Retry the original request
            try {
              final token = await _storage.getToken();
              error.requestOptions.headers['Authorization'] = 'Bearer $token';
              final response = await dio.fetch(error.requestOptions);
              return handler.resolve(response);
            } catch (e) {
              return handler.next(error);
            }
          } else {
            // Force logout
            onForceLogout?.call();
          }
        }
        handler.next(error);
      },
    ));
  }

  Future<bool> _tryRefreshToken() async {
    final token = await _storage.getToken();
    if (token == null) return false;

    try {
      // Use a separate Dio instance to avoid interceptor loops
      final refreshDio = Dio(BaseOptions(
        baseUrl: AppConstants.apiBaseUrl,
        headers: {'Content-Type': 'application/json'},
      ));

      final response = await refreshDio.post('/api/auth/mobile', data: {
        'action': 'refresh',
        'token': token,
      });

      if (response.statusCode == 200 && response.data['token'] != null) {
        await _storage.setToken(response.data['token'] as String);
        return true;
      }
    } catch (_) {
      // Refresh failed
    }
    return false;
  }

  // Convenience methods
  Future<Response> get(String path, {Map<String, dynamic>? queryParameters}) =>
      dio.get(path, queryParameters: queryParameters);

  Future<Response> post(String path, {dynamic data}) =>
      dio.post(path, data: data);

  Future<Response> delete(String path,
          {Map<String, dynamic>? queryParameters}) =>
      dio.delete(path, queryParameters: queryParameters);

  /// Returns a Dio stream response for SSE endpoints
  Future<Response<ResponseBody>> stream(String path, {dynamic data}) =>
      dio.post<ResponseBody>(
        path,
        data: data,
        options: Options(
          responseType: ResponseType.stream,
          headers: {'Accept': 'text/event-stream'},
        ),
      );
}
