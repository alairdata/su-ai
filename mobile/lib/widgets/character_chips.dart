import 'package:flutter/material.dart';
import '../config/theme.dart';
import '../models/character.dart';
import '../utils/color_utils.dart';

class CharacterChips extends StatelessWidget {
  final List<Character> characters;
  final String? selectedCharacterId;
  final void Function(Character?) onSelect;
  final VoidCallback onAdd;
  final void Function(Character) onDelete;

  const CharacterChips({
    super.key,
    required this.characters,
    this.selectedCharacterId,
    required this.onSelect,
    required this.onAdd,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return SizedBox(
      height: 38,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        children: [
          // Add character button
          Padding(
            padding: const EdgeInsets.only(right: 6),
            child: ActionChip(
              avatar: const Icon(Icons.add, size: 16),
              label: const Text('Add'),
              onPressed: onAdd,
              backgroundColor: isDark
                  ? AppColors.darkBgTertiary
                  : AppColors.lightBgTertiary,
              side: BorderSide.none,
              labelStyle: TextStyle(
                fontSize: 12,
                color: isDark
                    ? AppColors.darkTextSecondary
                    : AppColors.lightTextSecondary,
              ),
              padding: const EdgeInsets.symmetric(horizontal: 4),
              materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
          ),
          // Character chips
          ...characters.map((char) {
            final isSelected = char.id == selectedCharacterId;
            final fgColor = parseColor(char.colorFg);

            return Padding(
              padding: const EdgeInsets.only(right: 6),
              child: GestureDetector(
                onLongPress: () => _showDeleteDialog(context, char),
                child: ChoiceChip(
                  label: Text('@${char.name}'),
                  selected: isSelected,
                  onSelected: (selected) {
                    onSelect(selected ? char : null);
                  },
                  selectedColor: fgColor.withValues(alpha: 0.15),
                  backgroundColor: isDark
                      ? AppColors.darkBgTertiary
                      : AppColors.lightBgTertiary,
                  side: isSelected
                      ? BorderSide(color: fgColor.withValues(alpha: 0.4))
                      : BorderSide.none,
                  labelStyle: TextStyle(
                    fontSize: 12,
                    color: isSelected ? fgColor : null,
                    fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                  ),
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
              ),
            );
          }),
        ],
      ),
    );
  }

  void _showDeleteDialog(BuildContext context, Character character) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Delete @${character.name}?'),
        content: const Text('This character will be removed from this chat.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              onDelete(character);
              Navigator.pop(ctx);
            },
            child: const Text('Delete',
                style: TextStyle(color: AppColors.danger)),
          ),
        ],
      ),
    );
  }
}
