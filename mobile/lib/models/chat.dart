import 'message.dart';

class Chat {
  final String id;
  final String title;
  final String createdAt;
  final List<Message> messages;

  const Chat({
    required this.id,
    required this.title,
    required this.createdAt,
    this.messages = const [],
  });

  factory Chat.fromJson(Map<String, dynamic> json) {
    return Chat(
      id: json['id'] as String,
      title: json['title'] as String? ?? 'New Chat',
      createdAt: json['created_at'] as String? ?? '',
      messages: (json['messages'] as List<dynamic>?)
              ?.map((m) => Message.fromJson(m as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'created_at': createdAt,
      'messages': messages.map((m) => m.toJson()).toList(),
    };
  }

  Chat copyWith({
    String? id,
    String? title,
    String? createdAt,
    List<Message>? messages,
  }) {
    return Chat(
      id: id ?? this.id,
      title: title ?? this.title,
      createdAt: createdAt ?? this.createdAt,
      messages: messages ?? this.messages,
    );
  }
}
