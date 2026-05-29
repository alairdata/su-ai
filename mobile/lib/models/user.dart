class User {
  final String id;
  final String email;
  final String name;
  final String plan;
  final int messagesUsedToday;
  final int totalMessages;
  final bool isNewUser;
  final bool onboardingComplete;
  final bool whatsNewSeen;
  final String createdAt;
  final String timezone;
  final String? subscriptionStatus;
  final String? currentPeriodEnd;

  const User({
    required this.id,
    required this.email,
    required this.name,
    required this.plan,
    required this.messagesUsedToday,
    required this.totalMessages,
    required this.isNewUser,
    required this.onboardingComplete,
    required this.whatsNewSeen,
    required this.createdAt,
    required this.timezone,
    this.subscriptionStatus,
    this.currentPeriodEnd,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] as String,
      email: json['email'] as String,
      name: json['name'] as String,
      plan: json['plan'] as String? ?? 'Free',
      messagesUsedToday: json['messagesUsedToday'] as int? ?? 0,
      totalMessages: json['totalMessages'] as int? ?? 0,
      isNewUser: json['isNewUser'] as bool? ?? false,
      onboardingComplete: json['onboardingComplete'] as bool? ?? false,
      whatsNewSeen: json['whatsNewSeen'] as bool? ?? false,
      createdAt: json['createdAt'] as String? ?? '',
      timezone: json['timezone'] as String? ?? 'UTC',
      subscriptionStatus: json['subscriptionStatus'] as String?,
      currentPeriodEnd: json['currentPeriodEnd'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'name': name,
      'plan': plan,
      'messagesUsedToday': messagesUsedToday,
      'totalMessages': totalMessages,
      'isNewUser': isNewUser,
      'onboardingComplete': onboardingComplete,
      'whatsNewSeen': whatsNewSeen,
      'createdAt': createdAt,
      'timezone': timezone,
      'subscriptionStatus': subscriptionStatus,
      'currentPeriodEnd': currentPeriodEnd,
    };
  }

  User copyWith({
    String? id,
    String? email,
    String? name,
    String? plan,
    int? messagesUsedToday,
    int? totalMessages,
    bool? isNewUser,
    bool? onboardingComplete,
    bool? whatsNewSeen,
    String? createdAt,
    String? timezone,
    String? subscriptionStatus,
    String? currentPeriodEnd,
  }) {
    return User(
      id: id ?? this.id,
      email: email ?? this.email,
      name: name ?? this.name,
      plan: plan ?? this.plan,
      messagesUsedToday: messagesUsedToday ?? this.messagesUsedToday,
      totalMessages: totalMessages ?? this.totalMessages,
      isNewUser: isNewUser ?? this.isNewUser,
      onboardingComplete: onboardingComplete ?? this.onboardingComplete,
      whatsNewSeen: whatsNewSeen ?? this.whatsNewSeen,
      createdAt: createdAt ?? this.createdAt,
      timezone: timezone ?? this.timezone,
      subscriptionStatus: subscriptionStatus ?? this.subscriptionStatus,
      currentPeriodEnd: currentPeriodEnd ?? this.currentPeriodEnd,
    );
  }

  int get dailyLimit {
    switch (plan) {
      case 'Pro':
        return 100;
      case 'Plus':
        return 300;
      default:
        return 5;
    }
  }
}
