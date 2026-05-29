class Character {
  final String id;
  final String chatId;
  final String userId;
  final String name;
  final String? personality;
  final String colorBg;
  final String colorFg;
  final String colorBorder;
  final String colorBgLight;
  final String colorTag;
  final String createdAt;

  const Character({
    required this.id,
    required this.chatId,
    required this.userId,
    required this.name,
    this.personality,
    this.colorBg = '#2D1B4E',
    this.colorFg = '#B388FF',
    this.colorBorder = 'rgba(179,136,255,0.2)',
    this.colorBgLight = 'rgba(179,136,255,0.06)',
    this.colorTag = 'rgba(179,136,255,0.15)',
    this.createdAt = '',
  });

  factory Character.fromJson(Map<String, dynamic> json) {
    return Character(
      id: json['id'] as String,
      chatId: json['chat_id'] as String? ?? '',
      userId: json['user_id'] as String? ?? '',
      name: json['name'] as String,
      personality: json['personality'] as String?,
      colorBg: json['color_bg'] as String? ?? '#2D1B4E',
      colorFg: json['color_fg'] as String? ?? '#B388FF',
      colorBorder: json['color_border'] as String? ?? 'rgba(179,136,255,0.2)',
      colorBgLight: json['color_bg_light'] as String? ?? 'rgba(179,136,255,0.06)',
      colorTag: json['color_tag'] as String? ?? 'rgba(179,136,255,0.15)',
      createdAt: json['created_at'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'chat_id': chatId,
      'user_id': userId,
      'name': name,
      'personality': personality,
      'color_bg': colorBg,
      'color_fg': colorFg,
      'color_border': colorBorder,
      'color_bg_light': colorBgLight,
      'color_tag': colorTag,
      'created_at': createdAt,
    };
  }
}

/// Preset color schemes for characters
class CharacterColorPreset {
  final String name;
  final String colorBg;
  final String colorFg;
  final String colorBorder;
  final String colorBgLight;
  final String colorTag;

  const CharacterColorPreset({
    required this.name,
    required this.colorBg,
    required this.colorFg,
    required this.colorBorder,
    required this.colorBgLight,
    required this.colorTag,
  });

  static const List<CharacterColorPreset> presets = [
    CharacterColorPreset(
      name: 'Purple',
      colorBg: '#2D1B4E',
      colorFg: '#B388FF',
      colorBorder: 'rgba(179,136,255,0.2)',
      colorBgLight: 'rgba(179,136,255,0.06)',
      colorTag: 'rgba(179,136,255,0.15)',
    ),
    CharacterColorPreset(
      name: 'Blue',
      colorBg: '#1B2E4E',
      colorFg: '#64B5F6',
      colorBorder: 'rgba(100,181,246,0.2)',
      colorBgLight: 'rgba(100,181,246,0.06)',
      colorTag: 'rgba(100,181,246,0.15)',
    ),
    CharacterColorPreset(
      name: 'Green',
      colorBg: '#1B4E2D',
      colorFg: '#81C784',
      colorBorder: 'rgba(129,199,132,0.2)',
      colorBgLight: 'rgba(129,199,132,0.06)',
      colorTag: 'rgba(129,199,132,0.15)',
    ),
    CharacterColorPreset(
      name: 'Red',
      colorBg: '#4E1B1B',
      colorFg: '#E57373',
      colorBorder: 'rgba(229,115,115,0.2)',
      colorBgLight: 'rgba(229,115,115,0.06)',
      colorTag: 'rgba(229,115,115,0.15)',
    ),
    CharacterColorPreset(
      name: 'Orange',
      colorBg: '#4E3A1B',
      colorFg: '#FFB74D',
      colorBorder: 'rgba(255,183,77,0.2)',
      colorBgLight: 'rgba(255,183,77,0.06)',
      colorTag: 'rgba(255,183,77,0.15)',
    ),
  ];
}
