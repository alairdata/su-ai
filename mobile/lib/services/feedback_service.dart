import 'api_client.dart';

class FeedbackService {
  final ApiClient _api = ApiClient.instance;

  Future<bool> submitFeedback({
    required String messageId,
    required String chatId,
    required String feedback, // "like" or "dislike"
  }) async {
    try {
      await _api.post('/api/feedback', data: {
        'messageId': messageId,
        'chatId': chatId,
        'feedback': feedback,
      });
      return true;
    } catch (e) {
      return false;
    }
  }
}
