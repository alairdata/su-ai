import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../config/theme.dart';
import '../models/message.dart';
import '../utils/color_utils.dart';

class MessageBubble extends StatelessWidget {
  final Message message;
  final bool isStreaming;
  final void Function(String url)? onImageTap;

  const MessageBubble({
    super.key,
    required this.message,
    this.isStreaming = false,
    this.onImageTap,
  });

  @override
  Widget build(BuildContext context) {
    final isUser = message.isUser;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final hasCharacter = message.hasCharacter;

    // Character colors
    Color? charBg;
    Color? charFg;
    if (hasCharacter && message.characterColorFg.isNotEmpty) {
      charBg = parseColor(message.characterColorBg);
      charFg = parseColor(message.characterColorFg);
    }

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Column(
        crossAxisAlignment:
            isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment:
                isUser ? MainAxisAlignment.end : MainAxisAlignment.start,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (!isUser) ...[
                // AI/Character avatar
                Container(
                  width: 32,
                  height: 32,
                  margin: const EdgeInsets.only(top: 4),
                  decoration: BoxDecoration(
                    gradient: hasCharacter
                        ? null
                        : const LinearGradient(
                            colors: [
                              AppColors.gradientStart,
                              AppColors.gradientEnd,
                            ],
                          ),
                    color: hasCharacter ? charBg : null,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Center(
                    child: Text(
                      hasCharacter
                          ? message.characterName?.substring(0, 1).toUpperCase() ?? 'C'
                          : 'SU',
                      style: TextStyle(
                        color: hasCharacter ? charFg : Colors.white,
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
              ],
              Flexible(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Character name tag
                    if (hasCharacter && message.characterName != null)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 2),
                        child: Text(
                          '@${message.characterName}',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: charFg ?? AppColors.accent,
                          ),
                        ),
                      ),
                    // Bubble
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: isUser
                            ? AppColors.accent.withValues(alpha: 0.15)
                            : hasCharacter
                                ? (charBg ?? AppColors.darkBgSecondary)
                                    .withValues(alpha: 0.15)
                                : isDark
                                    ? AppColors.darkBgSecondary
                                    : AppColors.lightBgSecondary,
                        borderRadius: BorderRadius.only(
                          topLeft: const Radius.circular(16),
                          topRight: const Radius.circular(16),
                          bottomLeft: Radius.circular(isUser ? 16 : 4),
                          bottomRight: Radius.circular(isUser ? 4 : 16),
                        ),
                        border: isUser
                            ? Border.all(
                                color:
                                    AppColors.accent.withValues(alpha: 0.2))
                            : hasCharacter
                                ? Border.all(
                                    color: (charFg ?? AppColors.accent)
                                        .withValues(alpha: 0.2))
                                : Border.all(
                                    color: isDark
                                        ? AppColors.darkBorder
                                        : AppColors.lightBorder),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // File/image attachment
                          if (message.imageUrl != null &&
                              message.imageUrl!.isNotEmpty) ...[
                            _buildAttachment(context, isDark),
                            if (message.content.isNotEmpty)
                              const SizedBox(height: 8),
                          ],
                          // Text content
                          if (message.content.isNotEmpty)
                            isUser
                                ? Text(
                                    message.content,
                                    style: TextStyle(
                                      color: isDark
                                          ? AppColors.darkTextPrimary
                                          : AppColors.lightTextPrimary,
                                      fontSize: 15,
                                      height: 1.5,
                                    ),
                                  )
                                : _buildMarkdownContent(context, isDark),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              if (isUser) const SizedBox(width: 40),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildAttachment(BuildContext context, bool isDark) {
    final isImage = message.fileType == 'image' ||
        (message.imageUrl != null &&
            (message.imageUrl!.endsWith('.jpg') ||
                message.imageUrl!.endsWith('.png') ||
                message.imageUrl!.endsWith('.gif') ||
                message.imageUrl!.endsWith('.webp')));

    if (isImage) {
      return GestureDetector(
        onTap: () => onImageTap?.call(message.imageUrl!),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxHeight: 200, maxWidth: 280),
            child: CachedNetworkImage(
              imageUrl: message.imageUrl!,
              fit: BoxFit.cover,
              placeholder: (context, url) => Container(
                width: 200,
                height: 120,
                color: isDark
                    ? AppColors.darkBgTertiary
                    : AppColors.lightBgTertiary,
                child: const Center(
                  child: CircularProgressIndicator(
                    color: AppColors.accent,
                    strokeWidth: 2,
                  ),
                ),
              ),
              errorWidget: (_, __, ___) => Container(
                width: 200,
                height: 60,
                decoration: BoxDecoration(
                  color: isDark
                      ? AppColors.darkBgTertiary
                      : AppColors.lightBgTertiary,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Center(
                  child: Icon(Icons.broken_image_outlined, size: 24),
                ),
              ),
            ),
          ),
        ),
      );
    }

    // Non-image file
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkBgTertiary : AppColors.lightBgTertiary,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            message.fileType == 'pdf'
                ? Icons.picture_as_pdf_outlined
                : Icons.insert_drive_file_outlined,
            size: 20,
            color: AppColors.accent,
          ),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              message.fileName ?? 'File',
              style: TextStyle(
                fontSize: 13,
                color: isDark
                    ? AppColors.darkTextPrimary
                    : AppColors.lightTextPrimary,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMarkdownContent(BuildContext context, bool isDark) {
    return MarkdownBody(
      data: message.content,
      selectable: true,
      shrinkWrap: true,
      styleSheet: MarkdownStyleSheet(
        p: TextStyle(
          color: isDark
              ? AppColors.darkTextPrimary
              : AppColors.lightTextPrimary,
          fontSize: 15,
          height: 1.5,
        ),
        code: GoogleFonts.jetBrainsMono(
          fontSize: 13,
          color: AppColors.accent,
          backgroundColor:
              isDark ? AppColors.darkBgTertiary : AppColors.lightBgTertiary,
        ),
        codeblockDecoration: BoxDecoration(
          color:
              isDark ? AppColors.darkBgTertiary : AppColors.lightBgTertiary,
          borderRadius: BorderRadius.circular(8),
        ),
        codeblockPadding: const EdgeInsets.all(12),
        blockquoteDecoration: const BoxDecoration(
          border: Border(
            left: BorderSide(color: AppColors.accent, width: 3),
          ),
        ),
        blockquotePadding: const EdgeInsets.only(left: 12),
        h1: TextStyle(
          color: isDark
              ? AppColors.darkTextPrimary
              : AppColors.lightTextPrimary,
          fontSize: 22,
          fontWeight: FontWeight.bold,
        ),
        h2: TextStyle(
          color: isDark
              ? AppColors.darkTextPrimary
              : AppColors.lightTextPrimary,
          fontSize: 19,
          fontWeight: FontWeight.bold,
        ),
        h3: TextStyle(
          color: isDark
              ? AppColors.darkTextPrimary
              : AppColors.lightTextPrimary,
          fontSize: 17,
          fontWeight: FontWeight.w600,
        ),
        strong: const TextStyle(fontWeight: FontWeight.w600),
        listBullet: TextStyle(
          color: isDark
              ? AppColors.darkTextSecondary
              : AppColors.lightTextSecondary,
        ),
      ),
    );
  }
}
