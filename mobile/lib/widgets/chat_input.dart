import 'package:flutter/material.dart';
import '../config/theme.dart';

class ChatInput extends StatefulWidget {
  final void Function(String) onSend;
  final bool isLoading;
  final int messagesUsed;
  final int messageLimit;
  final VoidCallback? onAttachFile;
  final Widget? filePreview;
  final Widget? characterChips;

  const ChatInput({
    super.key,
    required this.onSend,
    this.isLoading = false,
    this.messagesUsed = 0,
    this.messageLimit = 5,
    this.onAttachFile,
    this.filePreview,
    this.characterChips,
  });

  @override
  State<ChatInput> createState() => _ChatInputState();
}

class _ChatInputState extends State<ChatInput> {
  final _controller = TextEditingController();
  final _focusNode = FocusNode();
  bool _hasText = false;

  @override
  void initState() {
    super.initState();
    _controller.addListener(() {
      final hasText = _controller.text.trim().isNotEmpty;
      if (hasText != _hasText) setState(() => _hasText = hasText);
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _send() {
    final text = _controller.text.trim();
    if (text.isEmpty || widget.isLoading) return;
    widget.onSend(text);
    _controller.clear();
    _focusNode.requestFocus();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkBg : AppColors.lightBg,
        border: Border(
          top: BorderSide(
            color: isDark ? AppColors.darkBorder : AppColors.lightBorder,
          ),
        ),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Character chips
            if (widget.characterChips != null) ...[
              const SizedBox(height: 6),
              widget.characterChips!,
            ],

            // File preview
            if (widget.filePreview != null) widget.filePreview!,

            // Message counter
            Padding(
              padding: const EdgeInsets.only(top: 8, left: 16, right: 16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    '${widget.messagesUsed}',
                    style: const TextStyle(
                      color: AppColors.accent,
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                    ),
                  ),
                  Text(
                    ' of ',
                    style: TextStyle(
                      color: isDark
                          ? AppColors.darkTextMuted
                          : AppColors.lightTextMuted,
                      fontSize: 13,
                    ),
                  ),
                  Text(
                    '${widget.messageLimit}',
                    style: const TextStyle(
                      color: AppColors.accent,
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                    ),
                  ),
                  Text(
                    ' messages today',
                    style: TextStyle(
                      color: isDark
                          ? AppColors.darkTextMuted
                          : AppColors.lightTextMuted,
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            // Input row
            Padding(
              padding: const EdgeInsets.only(left: 12, right: 12, bottom: 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  // Attach button
                  if (widget.onAttachFile != null)
                    Container(
                      height: 44,
                      width: 44,
                      margin: const EdgeInsets.only(right: 4),
                      child: IconButton(
                        onPressed:
                            widget.isLoading ? null : widget.onAttachFile,
                        icon: Icon(
                          Icons.attach_file_rounded,
                          color: isDark
                              ? AppColors.darkTextMuted
                              : AppColors.lightTextMuted,
                          size: 22,
                        ),
                      ),
                    ),
                  Expanded(
                    child: Container(
                      constraints: const BoxConstraints(maxHeight: 120),
                      decoration: BoxDecoration(
                        color: isDark
                            ? AppColors.darkBgSecondary
                            : AppColors.lightBgSecondary,
                        borderRadius: BorderRadius.circular(24),
                        border: Border.all(
                          color: isDark
                              ? AppColors.darkBorderActive
                              : AppColors.lightBorderActive,
                        ),
                      ),
                      child: TextField(
                        controller: _controller,
                        focusNode: _focusNode,
                        maxLines: 5,
                        minLines: 1,
                        textInputAction: TextInputAction.newline,
                        style: TextStyle(
                          color: isDark
                              ? AppColors.darkTextPrimary
                              : AppColors.lightTextPrimary,
                          fontSize: 15,
                        ),
                        decoration: InputDecoration(
                          hintText: 'Message So UnFiltered...',
                          hintStyle: TextStyle(
                            color: isDark
                                ? AppColors.darkTextMuted
                                : AppColors.lightTextMuted,
                          ),
                          border: InputBorder.none,
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 10,
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  // Send button
                  Container(
                    height: 44,
                    width: 44,
                    decoration: BoxDecoration(
                      color: _hasText && !widget.isLoading
                          ? AppColors.accent
                          : (isDark
                              ? AppColors.darkBgTertiary
                              : AppColors.lightBgTertiary),
                      shape: BoxShape.circle,
                    ),
                    child: IconButton(
                      tooltip: 'Send message',
                      onPressed:
                          _hasText && !widget.isLoading ? _send : null,
                      icon: widget.isLoading
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : Icon(
                              Icons.arrow_upward_rounded,
                              color: _hasText
                                  ? Colors.white
                                  : (isDark
                                      ? AppColors.darkTextMuted
                                      : AppColors.lightTextMuted),
                              size: 22,
                            ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
