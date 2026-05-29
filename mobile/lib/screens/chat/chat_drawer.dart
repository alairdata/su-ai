import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../config/theme.dart';
import '../../models/chat.dart';
import '../../providers/auth_provider.dart';
import '../../providers/theme_provider.dart';
import 'package:intl/intl.dart';

class ChatDrawer extends ConsumerWidget {
  final List<Chat> chats;
  final String? activeChatId;
  final void Function(Chat) onChatSelected;
  final VoidCallback onNewChat;
  final void Function(String) onDeleteChat;
  final void Function(String, String) onRenameChat;
  final Future<void> Function()? onRefresh;

  const ChatDrawer({
    super.key,
    required this.chats,
    this.activeChatId,
    required this.onChatSelected,
    required this.onNewChat,
    required this.onDeleteChat,
    required this.onRenameChat,
    this.onRefresh,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final authState = ref.watch(authProvider);

    // Group chats by date
    final grouped = _groupChatsByDate(chats);

    return Drawer(
      child: SafeArea(
        child: Column(
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [
                          AppColors.gradientStart,
                          AppColors.gradientEnd,
                        ],
                      ),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Center(
                      child: Text(
                        'SU',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          authState.user?.name ?? 'User',
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 15,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        Text(
                          '${authState.user?.plan ?? 'Free'} Plan',
                          style: TextStyle(
                            fontSize: 12,
                            color: AppColors.accent,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: Icon(
                      isDark ? Icons.light_mode_outlined : Icons.dark_mode_outlined,
                      size: 20,
                    ),
                    onPressed: () => ref.read(themeProvider.notifier).toggle(),
                    tooltip: 'Toggle theme',
                  ),
                ],
              ),
            ),

            const Divider(height: 1),

            // New chat button
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: onNewChat,
                  icon: const Icon(Icons.add_rounded, size: 18),
                  label: const Text('New Chat'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.accent,
                    side: BorderSide(
                        color: AppColors.accent.withValues(alpha: 0.3)),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                ),
              ),
            ),

            // Chat list with pull-to-refresh
            Expanded(
              child: chats.isEmpty
                  ? Center(
                      child: Text(
                        'No chats yet',
                        style: TextStyle(
                          color: isDark
                              ? AppColors.darkTextMuted
                              : AppColors.lightTextMuted,
                        ),
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: onRefresh ?? () async {},
                      color: AppColors.accent,
                      child: ListView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.symmetric(horizontal: 8),
                        children: grouped.entries.map((entry) {
                          return Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Padding(
                                padding: const EdgeInsets.only(
                                  left: 12, top: 16, bottom: 4,
                                ),
                                child: Text(
                                  entry.key,
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                    color: isDark
                                        ? AppColors.darkTextMuted
                                        : AppColors.lightTextMuted,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                              ),
                              ...entry.value.map((chat) => _ChatTile(
                                    chat: chat,
                                    isActive: chat.id == activeChatId,
                                    onTap: () => onChatSelected(chat),
                                    onDelete: () => onDeleteChat(chat.id),
                                    onRename: (title) =>
                                        onRenameChat(chat.id, title),
                                  )),
                            ],
                          );
                        }).toList(),
                      ),
                    ),
            ),

            // Settings + Logout
            const Divider(height: 1),
            ListTile(
              leading: const Icon(Icons.settings_outlined, size: 20),
              title: const Text(
                'Settings',
                style: TextStyle(fontSize: 14),
              ),
              onTap: () {
                Navigator.pop(context);
                context.push('/settings');
              },
              dense: true,
            ),
            ListTile(
              leading: const Icon(Icons.logout_rounded, size: 20),
              title: const Text(
                'Log out',
                style: TextStyle(fontSize: 14),
              ),
              onTap: () {
                Navigator.pop(context);
                ref.read(authProvider.notifier).logout();
              },
              dense: true,
            ),
          ],
        ),
      ),
    );
  }

  Map<String, List<Chat>> _groupChatsByDate(List<Chat> chats) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final yesterday = today.subtract(const Duration(days: 1));

    final Map<String, List<Chat>> groups = {};

    for (final chat in chats) {
      final date = DateTime.tryParse(chat.createdAt);
      if (date == null) {
        groups.putIfAbsent('Older', () => []).add(chat);
        continue;
      }
      final chatDate = DateTime(date.year, date.month, date.day);

      String label;
      if (chatDate == today) {
        label = 'Today';
      } else if (chatDate == yesterday) {
        label = 'Yesterday';
      } else if (chatDate.isAfter(today.subtract(const Duration(days: 7)))) {
        label = 'This Week';
      } else {
        label = DateFormat('MMMM yyyy').format(date);
      }

      groups.putIfAbsent(label, () => []).add(chat);
    }

    return groups;
  }
}

class _ChatTile extends StatelessWidget {
  final Chat chat;
  final bool isActive;
  final VoidCallback onTap;
  final VoidCallback onDelete;
  final void Function(String) onRename;

  const _ChatTile({
    required this.chat,
    required this.isActive,
    required this.onTap,
    required this.onDelete,
    required this.onRename,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Dismissible(
      key: ValueKey(chat.id),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 16),
        decoration: BoxDecoration(
          color: AppColors.danger.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(10),
        ),
        child: const Icon(Icons.delete_outline, color: AppColors.danger),
      ),
      confirmDismiss: (_) async {
        return await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('Delete chat?'),
            content: const Text('This action cannot be undone.'),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('Cancel'),
              ),
              TextButton(
                onPressed: () => Navigator.pop(ctx, true),
                child: const Text('Delete',
                    style: TextStyle(color: AppColors.danger)),
              ),
            ],
          ),
        );
      },
      onDismissed: (_) => onDelete(),
      child: GestureDetector(
        onLongPress: () => _showRenameDialog(context),
        child: Container(
          margin: const EdgeInsets.symmetric(vertical: 1),
          decoration: BoxDecoration(
            color: isActive
                ? (isDark
                    ? AppColors.darkBgTertiary
                    : AppColors.lightBgTertiary)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(10),
          ),
          child: ListTile(
            onTap: onTap,
            title: Text(
              chat.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 14,
                fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
              ),
            ),
            dense: true,
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 12),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(10),
            ),
          ),
        ),
      ),
    );
  }

  void _showRenameDialog(BuildContext context) {
    final controller = TextEditingController(text: chat.title);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Rename chat'),
        content: TextField(
          controller: controller,
          autofocus: true,
          maxLength: 200,
          decoration: const InputDecoration(
            hintText: 'Chat title',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              final title = controller.text.trim();
              if (title.isNotEmpty) {
                onRename(title);
              }
              Navigator.pop(ctx);
            },
            child: const Text('Rename'),
          ),
        ],
      ),
    ).then((_) => controller.dispose());
  }
}
