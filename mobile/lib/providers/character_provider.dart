import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/character.dart';
import '../services/character_service.dart';

class CharacterState {
  final List<Character> characters;
  final bool isLoading;
  final String? error;

  const CharacterState({
    this.characters = const [],
    this.isLoading = false,
    this.error,
  });

  CharacterState copyWith({
    List<Character>? characters,
    bool? isLoading,
    String? error,
    bool clearError = false,
  }) {
    return CharacterState(
      characters: characters ?? this.characters,
      isLoading: isLoading ?? this.isLoading,
      error: clearError ? null : (error ?? this.error),
    );
  }
}

class CharacterNotifier extends StateNotifier<CharacterState> {
  final CharacterService _service = CharacterService();
  String? _currentChatId;

  CharacterNotifier() : super(const CharacterState());

  String? get currentChatId => _currentChatId;

  Future<void> loadCharacters(String chatId) async {
    _currentChatId = chatId;
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final characters = await _service.getCharacters(chatId);
      state = state.copyWith(characters: characters, isLoading: false);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: 'Failed to load characters');
    }
  }

  Future<Character?> createCharacter({
    required String name,
    String? personality,
    required CharacterColorPreset preset,
  }) async {
    if (_currentChatId == null) return null;
    if (state.characters.length >= 5) {
      state = state.copyWith(error: 'Maximum 5 characters per chat');
      return null;
    }

    try {
      final character = await _service.createCharacter(
        chatId: _currentChatId!,
        name: name,
        personality: personality,
        colorBg: preset.colorBg,
        colorFg: preset.colorFg,
        colorBorder: preset.colorBorder,
        colorBgLight: preset.colorBgLight,
        colorTag: preset.colorTag,
      );
      state = state.copyWith(characters: [...state.characters, character]);
      return character;
    } catch (e) {
      state = state.copyWith(error: 'Failed to create character');
      return null;
    }
  }

  Future<void> deleteCharacter(String id) async {
    try {
      await _service.deleteCharacter(id);
      state = state.copyWith(
        characters: state.characters.where((c) => c.id != id).toList(),
      );
    } catch (e) {
      state = state.copyWith(error: 'Failed to delete character');
    }
  }

  void clearCharacters() {
    _currentChatId = null;
    state = const CharacterState();
  }
}

final characterProvider =
    StateNotifierProvider<CharacterNotifier, CharacterState>((ref) {
  return CharacterNotifier();
});
