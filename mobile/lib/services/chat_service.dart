import '../models/chat.dart';
import 'api_client.dart';

class ChatService {
  final ApiClient _api = ApiClient.instance;

  Future<List<Chat>> getChats() async {
    final response = await _api.get('/api/chats');
    final data = response.data as Map<String, dynamic>;
    final chats = (data['chats'] as List<dynamic>)
        .map((c) => Chat.fromJson(c as Map<String, dynamic>))
        .toList();
    return chats;
  }

  Future<Chat> getChat(String chatId) async {
    final response = await _api.get('/api/chats/$chatId');
    final data = response.data as Map<String, dynamic>;
    return Chat.fromJson(data['chat'] as Map<String, dynamic>);
  }

  Future<Chat> createChat({String title = 'New Chat'}) async {
    final response = await _api.post('/api/chats', data: {'title': title});
    final data = response.data as Map<String, dynamic>;
    return Chat.fromJson(data['chat'] as Map<String, dynamic>);
  }

  Future<void> deleteChat(String chatId) async {
    await _api.post('/api/chats/delete', data: {'chatId': chatId});
  }

  Future<void> renameChat(String chatId, String title) async {
    await _api.post('/api/chats/rename', data: {
      'chatId': chatId,
      'title': title,
    });
  }
}
