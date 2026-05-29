import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../config/theme.dart';
import '../models/message.dart';

class MessageActions extends StatelessWidget {
  final Message message;
  final int messageIndex;
  final void Function()? onRegenerate;
  final void Function(int index)? onEdit;
  final void Function(String messageId, String feedback)? onFeedback;

  const MessageActions({
    super.key,
    required this.message,
    required this.messageIndex,
    this.onRegenerate,
    this.onEdit,
    this.onFeedback,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final iconColor =
        isDark ? AppColors.darkTextMuted : AppColors.lightTextMuted;

    return Padding(
      padding: EdgeInsets.only(
        left: message.isUser ? 56 : 52,
        right: message.isUser ? 16 : 56,
        bottom: 4,
      ),
      child: Row(
        mainAxisAlignment:
            message.isUser ? MainAxisAlignment.end : MainAxisAlignment.start,
        children: [
          // Copy
          _ActionButton(
            icon: Icons.copy_outlined,
            tooltip: 'Copy',
            color: iconColor,
            onPressed: () {
              Clipboard.setData(ClipboardData(text: message.content));
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Copied to clipboard'),
                  duration: Duration(seconds: 1),
                  behavior: SnackBarBehavior.floating,
                ),
              );
            },
          ),

          // Regenerate (AI messages only)
          if (message.isAssistant && onRegenerate != null)
            _ActionButton(
              icon: Icons.refresh_rounded,
              tooltip: 'Regenerate',
              color: iconColor,
              onPressed: onRegenerate!,
            ),

          // Edit (user messages only)
          if (message.isUser && onEdit != null)
            _ActionButton(
              icon: Icons.edit_outlined,
              tooltip: 'Edit',
              color: iconColor,
              onPressed: () => onEdit!(messageIndex),
            ),

          // Feedback (AI messages only)
          if (message.isAssistant && onFeedback != null) ...[
            _ActionButton(
              icon: Icons.thumb_up_outlined,
              tooltip: 'Good response',
              color: iconColor,
              onPressed: () => onFeedback!(message.id, 'like'),
            ),
            _ActionButton(
              icon: Icons.thumb_down_outlined,
              tooltip: 'Bad response',
              color: iconColor,
              onPressed: () => onFeedback!(message.id, 'dislike'),
            ),
          ],
        ],
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  final IconData icon;
  final String tooltip;
  final Color color;
  final VoidCallback onPressed;

  const _ActionButton({
    required this.icon,
    required this.tooltip,
    required this.color,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(6),
        child: Padding(
          padding: const EdgeInsets.all(6),
          child: Icon(icon, size: 16, color: color),
        ),
      ),
    );
  }
}
