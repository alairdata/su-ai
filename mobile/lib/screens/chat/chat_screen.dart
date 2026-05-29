import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:file_picker/file_picker.dart';
import 'package:mime/mime.dart';
import '../../config/theme.dart';
import '../../models/character.dart';
import '../../providers/auth_provider.dart';
import '../../providers/chat_provider.dart';
import '../../providers/character_provider.dart';
import '../../services/feedback_service.dart';
import '../../services/upload_service.dart';
import '../../widgets/chat_input.dart';
import '../../widgets/character_chips.dart';
import '../../widgets/create_character_dialog.dart';
import '../../widgets/file_preview_bar.dart';
import '../../widgets/message_actions.dart';
import '../../widgets/message_bubble.dart';
import '../../widgets/streaming_bubble.dart';
import '../../widgets/daily_limit_modal.dart';
import '../../widgets/image_fullscreen.dart';
import 'chat_drawer.dart';

class ChatScreen extends ConsumerStatefulWidget {
  const ChatScreen({super.key});

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final _scrollController = ScrollController();
  final _scaffoldKey = GlobalKey<ScaffoldState>();
  final _feedbackService = FeedbackService();
  final _uploadService = UploadService();

  // File attachment state
  String? _attachedFileName;
  String? _attachedMimeType;
  Uint8List? _attachedBytes;
  String? _uploadedFileUrl;
  double? _uploadProgress;
  bool _isUploading = false;

  // Character state
  Character? _selectedCharacter;

  // Hover state for message actions
  int? _hoveredMessageIndex;

  @override
  void initState() {
    super.initState();
    Future.microtask(() => _loadInitialData());
  }

  Future<void> _loadInitialData() async {
    if (!mounted) return;
    final chatNotifier = ref.read(chatProvider.notifier);
    chatNotifier.onMessageSent = () {
      if (mounted) {
        ref.read(authProvider.notifier).incrementMessageCount();
      }
    };

    await chatNotifier.loadChats();
    if (!mounted) return;

    final state = ref.read(chatProvider);
    if (state.chats.isEmpty) {
      await chatNotifier.createChat();
    } else {
      chatNotifier.setActiveChat(state.chats.first);
    }

    // Load characters for active chat
    _loadCharactersForActiveChat();
  }

  void _loadCharactersForActiveChat() {
    final activeChat = ref.read(chatProvider).activeChat;
    if (activeChat != null) {
      ref.read(characterProvider.notifier).loadCharacters(activeChat.id);
    }
  }

  void _scrollToBottom() {
    if (_scrollController.hasClients) {
      Future.delayed(const Duration(milliseconds: 100), () {
        if (_scrollController.hasClients) {
          _scrollController.animateTo(
            _scrollController.position.maxScrollExtent,
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeOut,
          );
        }
      });
    }
  }

  void _handleSend(String text) {
    final user = ref.read(authProvider).user;
    if (user != null && user.messagesUsedToday >= user.dailyLimit) {
      _showLimitModal();
      return;
    }

    ref.read(chatProvider.notifier).sendMessage(
      text,
      fileUrl: _uploadedFileUrl,
      fileType: _attachedMimeType != null
          ? (_attachedMimeType!.startsWith('image/')
              ? 'image'
              : _attachedMimeType!.contains('pdf')
                  ? 'pdf'
                  : 'text/code')
          : null,
      fileName: _attachedFileName,
      characterId: _selectedCharacter?.id,
    );

    // Clear attachment after sending
    setState(() {
      _attachedFileName = null;
      _attachedMimeType = null;
      _attachedBytes = null;
      _uploadedFileUrl = null;
      _uploadProgress = null;
    });
  }

  void _showLimitModal() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const DailyLimitModal(),
    );
  }

  Future<void> _createNewChat() async {
    _scaffoldKey.currentState?.closeDrawer();
    await ref.read(chatProvider.notifier).createChat();
    _selectedCharacter = null;
    _loadCharactersForActiveChat();
  }

  // --- File attachment ---

  void _showAttachOptions() {
    final user = ref.read(authProvider).user;
    if (user != null && user.plan == 'Free') {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('File uploads require a Pro or Plus plan'),
          behavior: SnackBarBehavior.floating,
          action: SnackBarAction(
            label: 'Upgrade',
            textColor: AppColors.accent,
            onPressed: () => context.push('/plans'),
          ),
        ),
      );
      return;
    }

    showModalBottomSheet(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.camera_alt_outlined),
              title: const Text('Camera'),
              onTap: () {
                Navigator.pop(ctx);
                _pickImage(ImageSource.camera);
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Gallery'),
              onTap: () {
                Navigator.pop(ctx);
                _pickImage(ImageSource.gallery);
              },
            ),
            ListTile(
              leading: const Icon(Icons.insert_drive_file_outlined),
              title: const Text('File'),
              onTap: () {
                Navigator.pop(ctx);
                _pickFile();
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _pickImage(ImageSource source) async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: source, maxWidth: 2048);
    if (picked == null) return;

    final bytes = await picked.readAsBytes();
    final mime = lookupMimeType(picked.name) ?? 'image/jpeg';

    setState(() {
      _attachedFileName = picked.name;
      _attachedMimeType = mime;
      _attachedBytes = bytes;
      _uploadedFileUrl = null;
    });

    await _uploadAttachment(bytes, picked.name, mime);
  }

  Future<void> _pickFile() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: [
        'pdf', 'txt', 'csv', 'md', 'html', 'json',
        'js', 'ts', 'py', 'css', 'sql', 'yaml', 'yml',
        'java', 'cpp', 'c', 'go', 'rs', 'rb',
        'jpg', 'jpeg', 'png', 'gif', 'webp',
      ],
      withData: true,
    );
    if (result == null || result.files.isEmpty) return;

    final file = result.files.first;
    if (file.bytes == null) return;

    final mime = lookupMimeType(file.name) ?? 'application/octet-stream';

    setState(() {
      _attachedFileName = file.name;
      _attachedMimeType = mime;
      _attachedBytes = file.bytes;
      _uploadedFileUrl = null;
    });

    await _uploadAttachment(file.bytes!, file.name, mime);
  }

  Future<void> _uploadAttachment(
      Uint8List bytes, String name, String mime) async {
    setState(() {
      _isUploading = true;
      _uploadProgress = 0;
    });

    final result = await _uploadService.uploadFile(
      fileName: name,
      bytes: bytes,
      mimeType: mime,
      onProgress: (sent, total) {
        if (mounted) {
          setState(() => _uploadProgress = sent / total);
        }
      },
    );

    if (mounted) {
      setState(() {
        _isUploading = false;
        _uploadProgress = null;
        if (result.success) {
          _uploadedFileUrl = result.url;
        } else {
          _attachedFileName = null;
          _attachedBytes = null;
          _attachedMimeType = null;
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(result.error ?? 'Upload failed'),
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      });
    }
  }

  void _clearAttachment() {
    setState(() {
      _attachedFileName = null;
      _attachedMimeType = null;
      _attachedBytes = null;
      _uploadedFileUrl = null;
      _uploadProgress = null;
    });
  }

  // --- Character ---

  void _showCreateCharacterDialog() {
    showDialog(
      context: context,
      builder: (_) => CreateCharacterDialog(
        onCreate: (name, personality, preset) async {
          await ref.read(characterProvider.notifier).createCharacter(
                name: name,
                personality: personality,
                preset: preset,
              );
        },
      ),
    );
  }

  // --- Message actions ---

  void _handleRegenerate() {
    final chatState = ref.read(chatProvider);
    final messages = chatState.activeChat?.messages ?? [];
    if (messages.isEmpty) return;

    // Find last user message index
    for (int i = messages.length - 1; i >= 0; i--) {
      if (messages[i].isUser) {
        ref.read(chatProvider.notifier).sendMessage(
              messages[i].content,
              regenerate: true,
              regenerateFromIndex: i,
            );
        break;
      }
    }
  }

  void _handleEdit(int messageIndex) {
    final chatState = ref.read(chatProvider);
    final messages = chatState.activeChat?.messages ?? [];
    if (messageIndex >= messages.length) return;

    final message = messages[messageIndex];
    // Show edit dialog
    final controller = TextEditingController(text: message.content);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Edit message'),
        content: TextField(
          controller: controller,
          maxLines: 5,
          autofocus: true,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              final newContent = controller.text.trim();
              if (newContent.isNotEmpty) {
                Navigator.pop(ctx);
                ref.read(chatProvider.notifier).sendMessage(
                      newContent,
                      editFromMessageIndex: messageIndex,
                    );
              }
            },
            child: const Text('Send'),
          ),
        ],
      ),
    ).then((_) => controller.dispose());
  }

  void _handleFeedback(String messageId, String feedback) {
    final chatId = ref.read(chatProvider).activeChat?.id;
    if (chatId == null) return;

    _feedbackService.submitFeedback(
      messageId: messageId,
      chatId: chatId,
      feedback: feedback,
    );

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(feedback == 'like' ? 'Thanks for the feedback!' : 'Sorry about that. We\'ll improve.'),
        duration: const Duration(seconds: 1),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  void _showFullscreenImage(String url) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => ImageFullscreen(imageUrl: url),
      ),
    );
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final chatState = ref.watch(chatProvider);
    final authState = ref.watch(authProvider);
    final charState = ref.watch(characterProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // Auto-scroll on streaming
    if (chatState.isStreaming || chatState.isSending) {
      _scrollToBottom();
    }

    // Load characters when active chat changes
    final activeId = chatState.activeChat?.id;
    if (activeId != null &&
        ref.read(characterProvider.notifier).currentChatId != activeId) {
      Future.microtask(() {
        ref.read(characterProvider.notifier).loadCharacters(activeId);
      });
    }

    final messages = chatState.activeChat?.messages ?? [];

    return Scaffold(
      key: _scaffoldKey,
      drawer: ChatDrawer(
        chats: chatState.chats,
        activeChatId: chatState.activeChat?.id,
        onChatSelected: (chat) {
          ref.read(chatProvider.notifier).setActiveChat(chat);
          ref.read(chatProvider.notifier).loadChat(chat.id);
          _selectedCharacter = null;
          _scaffoldKey.currentState?.closeDrawer();
        },
        onNewChat: _createNewChat,
        onDeleteChat: (chatId) {
          ref.read(chatProvider.notifier).deleteChat(chatId);
        },
        onRenameChat: (chatId, title) {
          ref.read(chatProvider.notifier).renameChat(chatId, title);
        },
        onRefresh: () => ref.read(chatProvider.notifier).refreshChats(),
      ),
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.menu_rounded),
          onPressed: () => _scaffoldKey.currentState?.openDrawer(),
        ),
        title: Text(
          chatState.activeChat?.title ?? 'New Chat',
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.add_rounded),
            onPressed: _createNewChat,
            tooltip: 'New chat',
          ),
        ],
      ),
      body: Column(
        children: [
          // Messages list
          Expanded(
            child: chatState.isLoading && messages.isEmpty
                ? const Center(
                    child:
                        CircularProgressIndicator(color: AppColors.accent))
                : messages.isEmpty && !chatState.isStreaming
                    ? _buildEmptyState(isDark)
                    : ListView.builder(
                        controller: _scrollController,
                        padding:
                            const EdgeInsets.only(top: 16, bottom: 16),
                        itemCount: messages.length +
                            (chatState.isStreaming ? 1 : 0),
                        itemBuilder: (context, index) {
                          if (index == messages.length &&
                              chatState.isStreaming) {
                            return StreamingBubble(
                              text: chatState.streamingText,
                              isSearching: chatState.isSearching,
                            );
                          }
                          final msg = messages[index];
                          return GestureDetector(
                            onTap: () {
                              setState(() {
                                _hoveredMessageIndex =
                                    _hoveredMessageIndex == index
                                        ? null
                                        : index;
                              });
                            },
                            child: Column(
                              children: [
                                MessageBubble(
                                  message: msg,
                                  onImageTap: _showFullscreenImage,
                                ),
                                if (_hoveredMessageIndex == index)
                                  MessageActions(
                                    message: msg,
                                    messageIndex: index,
                                    onRegenerate: msg.isAssistant
                                        ? _handleRegenerate
                                        : null,
                                    onEdit: msg.isUser
                                        ? _handleEdit
                                        : null,
                                    onFeedback: msg.isAssistant
                                        ? _handleFeedback
                                        : null,
                                  ),
                              ],
                            ),
                          );
                        },
                      ),
          ),

          // Error banner
          if (chatState.error != null)
            Container(
              width: double.infinity,
              padding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              color: AppColors.danger.withValues(alpha: 0.1),
              child: Row(
                children: [
                  const Icon(Icons.error_outline,
                      color: AppColors.danger, size: 16),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      chatState.error!,
                      style: const TextStyle(
                          color: AppColors.danger, fontSize: 13),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, size: 16),
                    onPressed: () =>
                        ref.read(chatProvider.notifier).clearError(),
                    color: AppColors.danger,
                  ),
                ],
              ),
            ),

          // Input
          ChatInput(
            onSend: _handleSend,
            isLoading: chatState.isSending || _isUploading,
            messagesUsed: authState.user?.messagesUsedToday ?? 0,
            messageLimit: authState.user?.dailyLimit ?? 5,
            onAttachFile: _showAttachOptions,
            filePreview: _attachedFileName != null
                ? FilePreviewBar(
                    fileName: _attachedFileName!,
                    mimeType: _attachedMimeType,
                    imageBytes: _attachedMimeType?.startsWith('image/') == true
                        ? _attachedBytes
                        : null,
                    uploadProgress: _uploadProgress,
                    onRemove: _clearAttachment,
                  )
                : null,
            characterChips: charState.characters.isNotEmpty ||
                    chatState.activeChat != null
                ? CharacterChips(
                    characters: charState.characters,
                    selectedCharacterId: _selectedCharacter?.id,
                    onSelect: (char) =>
                        setState(() => _selectedCharacter = char),
                    onAdd: _showCreateCharacterDialog,
                    onDelete: (char) {
                      ref
                          .read(characterProvider.notifier)
                          .deleteCharacter(char.id);
                      if (_selectedCharacter?.id == char.id) {
                        setState(() => _selectedCharacter = null);
                      }
                    },
                  )
                : null,
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState(bool isDark) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppColors.gradientStart, AppColors.gradientEnd],
                ),
                borderRadius: BorderRadius.circular(18),
              ),
              child: const Center(
                child: Text(
                  'SU',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 24),
            Text(
              'So UnFiltered AI',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: isDark
                    ? AppColors.darkTextPrimary
                    : AppColors.lightTextPrimary,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'No filters. No restrictions.\nJust real answers.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                color: isDark
                    ? AppColors.darkTextSecondary
                    : AppColors.lightTextSecondary,
                height: 1.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
