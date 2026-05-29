import 'dart:typed_data';
import 'package:flutter/material.dart';
import '../config/theme.dart';

class FilePreviewBar extends StatelessWidget {
  final String fileName;
  final String? mimeType;
  final Uint8List? imageBytes;
  final double? uploadProgress; // 0.0 to 1.0, null = not uploading
  final VoidCallback onRemove;

  const FilePreviewBar({
    super.key,
    required this.fileName,
    this.mimeType,
    this.imageBytes,
    this.uploadProgress,
    required this.onRemove,
  });

  bool get _isImage =>
      mimeType != null && mimeType!.startsWith('image/');

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkBgSecondary : AppColors.lightBgSecondary,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDark ? AppColors.darkBorder : AppColors.lightBorder,
        ),
      ),
      child: Row(
        children: [
          // Thumbnail or file icon
          if (_isImage && imageBytes != null)
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: Image.memory(
                imageBytes!,
                width: 40,
                height: 40,
                fit: BoxFit.cover,
              ),
            )
          else
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: AppColors.accent.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Icon(
                _getFileIcon(),
                color: AppColors.accent,
                size: 20,
              ),
            ),
          const SizedBox(width: 10),

          // File name + progress
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  fileName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: isDark
                        ? AppColors.darkTextPrimary
                        : AppColors.lightTextPrimary,
                  ),
                ),
                if (uploadProgress != null) ...[
                  const SizedBox(height: 4),
                  LinearProgressIndicator(
                    value: uploadProgress,
                    backgroundColor: isDark
                        ? AppColors.darkBgTertiary
                        : AppColors.lightBgTertiary,
                    color: AppColors.accent,
                    minHeight: 3,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ],
              ],
            ),
          ),

          // Remove button
          if (uploadProgress == null)
            IconButton(
              icon: const Icon(Icons.close, size: 18),
              onPressed: onRemove,
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
            ),
        ],
      ),
    );
  }

  IconData _getFileIcon() {
    if (mimeType == null) return Icons.insert_drive_file_outlined;
    if (mimeType!.startsWith('image/')) return Icons.image_outlined;
    if (mimeType!.contains('pdf')) return Icons.picture_as_pdf_outlined;
    if (mimeType!.contains('text') ||
        mimeType!.contains('json') ||
        mimeType!.contains('javascript') ||
        mimeType!.contains('python')) {
      return Icons.code_outlined;
    }
    return Icons.insert_drive_file_outlined;
  }
}
