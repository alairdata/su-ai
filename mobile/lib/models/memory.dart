class Memory {
  final String id;
  final String content;
  final String category;
  final String? sourceChatId;
  final String createdAt;
  final String updatedAt;

  const Memory({
    required this.id,
    required this.content,
    required this.category,
    this.sourceChatId,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Memory.fromJson(Map<String, dynamic> json) {
    return Memory(
      id: json['id'] as String,
      content: json['content'] as String,
      category: json['category'] as String? ?? 'context',
      sourceChatId: json['source_chat_id'] as String?,
      createdAt: json['created_at'] as String? ?? '',
      updatedAt: json['updated_at'] as String? ?? '',
    );
  }

  String get categoryLabel {
    switch (category) {
      case 'personal':
        return 'Personal';
      case 'preference':
        return 'Preference';
      case 'interest':
        return 'Interest';
      case 'context':
        return 'Context';
      default:
        return category;
    }
  }
}
