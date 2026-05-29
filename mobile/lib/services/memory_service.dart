import '../models/memory.dart';
import 'api_client.dart';

class MemoryService {
  final ApiClient _api = ApiClient.instance;

  Future<List<Memory>> getMemories() async {
    final response = await _api.get('/api/memories');
    final data = response.data as Map<String, dynamic>;
    return (data['memories'] as List<dynamic>)
        .map((m) => Memory.fromJson(m as Map<String, dynamic>))
        .toList();
  }

  Future<void> deleteMemory(String id) async {
    await _api.delete('/api/memories', queryParameters: {'id': id});
  }

  Future<void> clearAll() async {
    await _api.post('/api/memories/clear');
  }
}
