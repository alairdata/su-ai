import 'dart:convert';
import 'package:hive_flutter/hive_flutter.dart';
import '../models/chat.dart';

/// Hive-based offline cache for chat list.
/// Provides read-only access to chats when offline.
class CacheService {
  static CacheService? _instance;
  static CacheService get instance => _instance ??= CacheService._();

  CacheService._();

  static const String _chatBoxName = 'chats_cache';
  late Box<String> _chatBox;

  Future<void> init() async {
    await Hive.initFlutter();
    _chatBox = await Hive.openBox<String>(_chatBoxName);
  }

  /// Cache the full chat list (serialized as JSON strings)
  Future<void> cacheChats(List<Chat> chats) async {
    await _chatBox.clear();
    final Map<String, String> entries = {};
    for (final chat in chats) {
      entries[chat.id] = jsonEncode(chat.toJson());
    }
    await _chatBox.putAll(entries);
  }

  /// Retrieve cached chats (for offline use)
  List<Chat> getCachedChats() {
    try {
      return _chatBox.values.map((json) {
        return Chat.fromJson(jsonDecode(json) as Map<String, dynamic>);
      }).toList()
        ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    } catch (_) {
      return [];
    }
  }

  /// Cache a single chat's messages
  Future<void> cacheSingleChat(Chat chat) async {
    await _chatBox.put(chat.id, jsonEncode(chat.toJson()));
  }

  /// Remove a chat from cache
  Future<void> removeChatFromCache(String chatId) async {
    await _chatBox.delete(chatId);
  }

  /// Clear all cached data
  Future<void> clearAll() async {
    await _chatBox.clear();
  }
}
