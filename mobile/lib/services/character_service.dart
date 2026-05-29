import '../models/character.dart';
import 'api_client.dart';

class CharacterService {
  final ApiClient _api = ApiClient.instance;

  Future<List<Character>> getCharacters(String chatId) async {
    final response =
        await _api.get('/api/characters', queryParameters: {'chatId': chatId});
    final data = response.data as Map<String, dynamic>;
    return (data['characters'] as List<dynamic>)
        .map((c) => Character.fromJson(c as Map<String, dynamic>))
        .toList();
  }

  Future<Character> createCharacter({
    required String chatId,
    required String name,
    String? personality,
    required String colorBg,
    required String colorFg,
    required String colorBorder,
    required String colorBgLight,
    required String colorTag,
  }) async {
    final response = await _api.post('/api/characters', data: {
      'chatId': chatId,
      'name': name,
      'personality': personality,
      'color_bg': colorBg,
      'color_fg': colorFg,
      'color_border': colorBorder,
      'color_bg_light': colorBgLight,
      'color_tag': colorTag,
    });
    final data = response.data as Map<String, dynamic>;
    return Character.fromJson(data['character'] as Map<String, dynamic>);
  }

  Future<void> deleteCharacter(String id) async {
    await _api.delete('/api/characters', queryParameters: {'id': id});
  }
}
