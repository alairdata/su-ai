class Message {
  final String id;
  final String role;
  final String content;
  final String createdAt;
  final String? imageUrl;
  final String? fileType;
  final String? fileName;
  final String? characterId;
  final String? characterName;
  final String characterColorBg;
  final String characterColorFg;
  final String characterColorBorder;
  final String characterColorBgLight;
  final String characterColorTag;

  const Message({
    required this.id,
    required this.role,
    required this.content,
    required this.createdAt,
    this.imageUrl,
    this.fileType,
    this.fileName,
    this.characterId,
    this.characterName,
    this.characterColorBg = '',
    this.characterColorFg = '',
    this.characterColorBorder = '',
    this.characterColorBgLight = '',
    this.characterColorTag = '',
  });

  factory Message.fromJson(Map<String, dynamic> json) {
    return Message(
      id: json['id'] as String? ?? '',
      role: json['role'] as String,
      content: json['content'] as String? ?? '',
      createdAt: json['created_at'] as String? ?? '',
      imageUrl: json['image_url'] as String?,
      fileType: json['file_type'] as String?,
      fileName: json['file_name'] as String?,
      characterId: json['character_id'] as String?,
      characterName: json['character_name'] as String?,
      characterColorBg: json['character_color_bg'] as String? ?? '',
      characterColorFg: json['character_color_fg'] as String? ?? '',
      characterColorBorder: json['character_color_border'] as String? ?? '',
      characterColorBgLight: json['character_color_bg_light'] as String? ?? '',
      characterColorTag: json['character_color_tag'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'role': role,
      'content': content,
      'created_at': createdAt,
      'image_url': imageUrl,
      'file_type': fileType,
      'file_name': fileName,
      'character_id': characterId,
      'character_name': characterName,
      'character_color_bg': characterColorBg,
      'character_color_fg': characterColorFg,
      'character_color_border': characterColorBorder,
      'character_color_bg_light': characterColorBgLight,
      'character_color_tag': characterColorTag,
    };
  }

  bool get isUser => role == 'user';
  bool get isAssistant => role == 'assistant';
  bool get hasCharacter => characterId != null && characterId!.isNotEmpty;

  Message copyWith({
    String? id,
    String? role,
    String? content,
    String? createdAt,
    String? imageUrl,
    String? fileType,
    String? fileName,
    String? characterId,
    String? characterName,
  }) {
    return Message(
      id: id ?? this.id,
      role: role ?? this.role,
      content: content ?? this.content,
      createdAt: createdAt ?? this.createdAt,
      imageUrl: imageUrl ?? this.imageUrl,
      fileType: fileType ?? this.fileType,
      fileName: fileName ?? this.fileName,
      characterId: characterId ?? this.characterId,
      characterName: characterName ?? this.characterName,
      characterColorBg: characterColorBg,
      characterColorFg: characterColorFg,
      characterColorBorder: characterColorBorder,
      characterColorBgLight: characterColorBgLight,
      characterColorTag: characterColorTag,
    );
  }
}
