import 'api_client.dart';

class UserService {
  final ApiClient _api = ApiClient.instance;

  Future<bool> updateName(String name) async {
    try {
      await _api.post('/api/user/update-name', data: {'name': name});
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<bool> setTimezone(String timezone) async {
    try {
      await _api.post('/api/user/timezone', data: {'timezone': timezone});
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> completeOnboarding() async {
    await _api.post('/api/user/complete-onboarding');
  }
}
