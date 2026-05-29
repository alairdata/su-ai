import 'package:flutter/material.dart';
import '../config/theme.dart';
import '../models/character.dart';
import '../utils/color_utils.dart';

class CreateCharacterDialog extends StatefulWidget {
  final Future<void> Function(String name, String? personality,
      CharacterColorPreset preset) onCreate;

  const CreateCharacterDialog({super.key, required this.onCreate});

  @override
  State<CreateCharacterDialog> createState() => _CreateCharacterDialogState();
}

class _CreateCharacterDialogState extends State<CreateCharacterDialog> {
  final _nameController = TextEditingController();
  final _personalityController = TextEditingController();
  int _selectedPreset = 0;
  bool _isCreating = false;

  @override
  void dispose() {
    _nameController.dispose();
    _personalityController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return AlertDialog(
      title: const Text('Create Character'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TextField(
              controller: _nameController,
              maxLength: 16,
              decoration: const InputDecoration(
                labelText: 'Name',
                hintText: 'e.g. Sage, Coach, Critic',
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _personalityController,
              maxLength: 300,
              maxLines: 3,
              decoration: const InputDecoration(
                labelText: 'Personality (optional)',
                hintText: 'Describe how this character behaves...',
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Color',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: isDark
                    ? AppColors.darkTextSecondary
                    : AppColors.lightTextSecondary,
              ),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: List.generate(
                CharacterColorPreset.presets.length,
                (i) {
                  final preset = CharacterColorPreset.presets[i];
                  final color = parseColor(preset.colorFg);
                  final isSelected = i == _selectedPreset;

                  return GestureDetector(
                    onTap: () => setState(() => _selectedPreset = i),
                    child: Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: color.withValues(alpha: 0.2),
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: isSelected
                              ? color
                              : Colors.transparent,
                          width: 2,
                        ),
                      ),
                      child: Center(
                        child: Container(
                          width: 20,
                          height: 20,
                          decoration: BoxDecoration(
                            color: color,
                            shape: BoxShape.circle,
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        TextButton(
          onPressed: _isCreating
              ? null
              : () async {
                  final name = _nameController.text.trim();
                  if (name.isEmpty) return;

                  setState(() => _isCreating = true);
                  await widget.onCreate(
                    name,
                    _personalityController.text.trim().isEmpty
                        ? null
                        : _personalityController.text.trim(),
                    CharacterColorPreset.presets[_selectedPreset],
                  );
                  if (context.mounted) Navigator.pop(context);
                },
          child: _isCreating
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('Create'),
        ),
      ],
    );
  }
}
