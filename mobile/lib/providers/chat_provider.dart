import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/chat.dart';
import '../models/message.dart';
import '../services/cache_service.dart';
import '../services/chat_service.dart';
import '../services/sse_client.dart';

class ChatState {
  final List<Chat> chats;
  final Chat? activeChat;
  final bool isLoading;
  final bool isSending;
  final bool isStreaming;
  final String? error;
  final String streamingText;
  final bool isSearching;

  const ChatState({
    this.chats = const [],
    this.activeChat,
    this.isLoading = false,
    this.isSending = false,
    this.isStreaming = false,
    this.error,
    this.streamingText = '',
    this.isSearching = false,
  });

  ChatState copyWith({
    List<Chat>? chats,
    Chat? activeChat,
    bool? isLoading,
    bool? isSending,
    bool? isStreaming,
    String? error,
    String? streamingText,
    bool? isSearching,
    bool clearActiveChat = false,
    bool clearError = false,
  }) {
    return ChatState(
      chats: chats ?? this.chats,
      activeChat: clearActiveChat ? null : (activeChat ?? this.activeChat),
      isLoading: isLoading ?? this.isLoading,
      isSending: isSending ?? this.isSending,
      isStreaming: isStreaming ?? this.isStreaming,
      error: clearError ? null : (error ?? this.error),
      streamingText: streamingText ?? this.streamingText,
      isSearching: isSearching ?? this.isSearching,
    );
  }
}

class ChatNotifier extends StateNotifier<ChatState> {
  final ChatService _chatService = ChatService();
  final SseClient _sseClient = SseClient();
  final CacheService _cache = CacheService.instance;
  StreamSubscription? _streamSubscription;

  ChatNotifier() : super(const ChatState());

  Future<void> loadChats() async {
    state = state.copyWith(isLoading: true, clearError: true);

    // Show cached chats immediately while loading
    if (state.chats.isEmpty) {
      final cached = _cache.getCachedChats();
      if (cached.isNotEmpty) {
        state = state.copyWith(chats: cached);
      }
    }

    try {
      final chats = await _chatService.getChats();
      chats.sort((a, b) => b.createdAt.compareTo(a.createdAt));
      state = state.copyWith(chats: chats, isLoading: false);
      // Update cache in background
      _cache.cacheChats(chats);
    } catch (e) {
      // If we have cached chats, use them silently
      if (state.chats.isNotEmpty) {
        state = state.copyWith(isLoading: false);
      } else {
        state = state.copyWith(isLoading: false, error: 'Failed to load chats');
      }
    }
  }

  /// Pull-to-refresh — always fetches from network
  Future<void> refreshChats() async {
    try {
      final chats = await _chatService.getChats();
      chats.sort((a, b) => b.createdAt.compareTo(a.createdAt));
      state = state.copyWith(chats: chats);
      _cache.cacheChats(chats);
    } catch (e) {
      state = state.copyWith(error: 'Failed to refresh chats');
    }
  }

  Future<void> loadChat(String chatId) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final chat = await _chatService.getChat(chatId);
      state = state.copyWith(activeChat: chat, isLoading: false);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: 'Failed to load chat');
    }
  }

  Future<Chat?> createChat() async {
    try {
      final chat = await _chatService.createChat();
      final updatedChats = [chat, ...state.chats];
      state = state.copyWith(chats: updatedChats, activeChat: chat);
      return chat;
    } catch (e) {
      state = state.copyWith(error: 'Failed to create chat');
      return null;
    }
  }

  Future<void> deleteChat(String chatId) async {
    try {
      await _chatService.deleteChat(chatId);
      final updatedChats =
          state.chats.where((c) => c.id != chatId).toList();
      state = state.copyWith(
        chats: updatedChats,
        clearActiveChat: state.activeChat?.id == chatId,
      );
      _cache.removeChatFromCache(chatId);
    } catch (e) {
      state = state.copyWith(error: 'Failed to delete chat');
    }
  }

  Future<void> renameChat(String chatId, String title) async {
    try {
      await _chatService.renameChat(chatId, title);
      final updatedChats = state.chats.map((c) {
        if (c.id == chatId) return c.copyWith(title: title);
        return c;
      }).toList();
      state = state.copyWith(
        chats: updatedChats,
        activeChat: state.activeChat?.id == chatId
            ? state.activeChat!.copyWith(title: title)
            : state.activeChat,
      );
    } catch (e) {
      state = state.copyWith(error: 'Failed to rename chat');
    }
  }

  void setActiveChat(Chat chat) {
    state = state.copyWith(activeChat: chat);
  }

  /// Callback to increment message count (set by chat screen)
  void Function()? onMessageSent;

  /// Send a message and stream the response
  Future<void> sendMessage(
    String content, {
    String? fileUrl,
    String? fileType,
    String? fileName,
    String? characterId,
    bool regenerate = false,
    int? regenerateFromIndex,
    int? editFromMessageIndex,
  }) async {
    if (state.activeChat == null || content.trim().isEmpty) return;

    final chatId = state.activeChat!.id;

    // Add user message locally (unless regenerating)
    if (!regenerate && editFromMessageIndex == null) {
      final userMessage = Message(
        id: DateTime.now().millisecondsSinceEpoch.toString(),
        role: 'user',
        content: content,
        createdAt: DateTime.now().toIso8601String(),
        imageUrl: fileUrl,
        fileType: fileType,
        fileName: fileName,
      );

      final updatedMessages = [...state.activeChat!.messages, userMessage];
      state = state.copyWith(
        activeChat: state.activeChat!.copyWith(messages: updatedMessages),
        isSending: true,
        isStreaming: true,
        streamingText: '',
        clearError: true,
      );
    } else if (editFromMessageIndex != null) {
      // Trim messages from the edit point
      final trimmed =
          state.activeChat!.messages.sublist(0, editFromMessageIndex);
      final editedMsg = Message(
        id: DateTime.now().millisecondsSinceEpoch.toString(),
        role: 'user',
        content: content,
        createdAt: DateTime.now().toIso8601String(),
      );
      state = state.copyWith(
        activeChat:
            state.activeChat!.copyWith(messages: [...trimmed, editedMsg]),
        isSending: true,
        isStreaming: true,
        streamingText: '',
        clearError: true,
      );
    } else {
      // Regenerate — remove last assistant message
      final msgs = [...state.activeChat!.messages];
      if (msgs.isNotEmpty && msgs.last.isAssistant) {
        msgs.removeLast();
      }
      state = state.copyWith(
        activeChat: state.activeChat!.copyWith(messages: msgs),
        isSending: true,
        isStreaming: true,
        streamingText: '',
        clearError: true,
      );
    }

    // Notify parent about message sent
    onMessageSent?.call();

    String fullText = '';
    bool gotError = false;

    try {
      await for (final event in _sseClient.sendMessage(
        message: content,
        chatId: chatId,
        fileUrl: fileUrl,
        fileType: fileType,
        fileName: fileName,
        characterId: characterId,
        regenerate: regenerate,
        regenerateFromIndex: regenerateFromIndex,
        editFromMessageIndex: editFromMessageIndex,
      )) {
        if (!mounted) return;

        if (event.error != null) {
          gotError = true;
          state = state.copyWith(
            error: event.error,
            isSending: false,
            isStreaming: false,
          );
          return;
        }

        if (event.searching != null) {
          state = state.copyWith(isSearching: event.searching!);
        }

        if (event.text != null) {
          fullText += event.text!;
          state = state.copyWith(streamingText: fullText);
        }

        if (event.title != null) {
          // Update chat title
          final updatedChats = state.chats.map((c) {
            if (c.id == chatId) return c.copyWith(title: event.title);
            return c;
          }).toList();
          state = state.copyWith(
            chats: updatedChats,
            activeChat: state.activeChat!.copyWith(title: event.title),
          );
        }

        if (event.done == true) {
          break;
        }
      }
    } catch (e) {
      if (!gotError) {
        state = state.copyWith(
          error: 'Stream interrupted',
          isSending: false,
          isStreaming: false,
        );
        return;
      }
    }

    if (!gotError && fullText.isNotEmpty) {
      // Add assistant message
      final assistantMessage = Message(
        id: '${DateTime.now().millisecondsSinceEpoch}_ai',
        role: 'assistant',
        content: fullText,
        createdAt: DateTime.now().toIso8601String(),
      );

      final finalMessages = [
        ...state.activeChat!.messages,
        assistantMessage,
      ];
      state = state.copyWith(
        activeChat: state.activeChat!.copyWith(messages: finalMessages),
        isSending: false,
        isStreaming: false,
        streamingText: '',
        isSearching: false,
      );
    } else {
      state = state.copyWith(
        isSending: false,
        isStreaming: false,
        streamingText: '',
        isSearching: false,
      );
    }
  }

  void clearError() {
    state = state.copyWith(clearError: true);
  }

  @override
  void dispose() {
    _streamSubscription?.cancel();
    super.dispose();
  }
}

final chatProvider = StateNotifierProvider<ChatNotifier, ChatState>((ref) {
  return ChatNotifier();
});
