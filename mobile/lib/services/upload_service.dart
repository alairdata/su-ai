import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'api_client.dart';

class UploadResult {
  final bool success;
  final String? url;
  final String? error;

  const UploadResult({required this.success, this.url, this.error});
}

class UploadService {
  final ApiClient _api = ApiClient.instance;

  /// Upload a file (image, PDF, or code file)
  /// Returns the uploaded file URL on success
  Future<UploadResult> uploadFile({
    required String fileName,
    required Uint8List bytes,
    required String mimeType,
    void Function(int sent, int total)? onProgress,
  }) async {
    try {
      final formData = FormData.fromMap({
        'file': MultipartFile.fromBytes(
          bytes,
          filename: fileName,
          contentType: DioMediaType.parse(mimeType),
        ),
      });

      final response = await _api.dio.post(
        '/api/upload',
        data: formData,
        options: Options(
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        ),
        onSendProgress: onProgress,
      );

      final data = response.data as Map<String, dynamic>;
      return UploadResult(
        success: true,
        url: data['url'] as String?,
      );
    } catch (e) {
      if (e is DioException) {
        if (e.response?.statusCode == 403) {
          return const UploadResult(
            success: false,
            error: 'File uploads require a Pro or Plus plan',
          );
        }
        final data = e.response?.data;
        if (data is Map<String, dynamic>) {
          return UploadResult(
            success: false,
            error: data['error'] as String? ?? 'Upload failed',
          );
        }
      }
      return const UploadResult(success: false, error: 'Upload failed');
    }
  }
}
