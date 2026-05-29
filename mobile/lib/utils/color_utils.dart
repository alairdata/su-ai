import 'package:flutter/material.dart';

/// Parse a CSS color string (hex or rgba) into a Flutter Color
Color parseColor(String colorStr) {
  colorStr = colorStr.trim();

  // Handle hex colors
  if (colorStr.startsWith('#')) {
    String hex = colorStr.substring(1);
    if (hex.length == 6) hex = 'FF$hex';
    if (hex.length == 8) {
      return Color(int.parse(hex, radix: 16));
    }
  }

  // Handle rgba(r, g, b, a)
  if (colorStr.startsWith('rgba(')) {
    final inner = colorStr.substring(5, colorStr.length - 1);
    final parts = inner.split(',').map((s) => s.trim()).toList();
    if (parts.length == 4) {
      final r = int.tryParse(parts[0]) ?? 0;
      final g = int.tryParse(parts[1]) ?? 0;
      final b = int.tryParse(parts[2]) ?? 0;
      final a = double.tryParse(parts[3]) ?? 1.0;
      return Color.fromRGBO(r, g, b, a);
    }
  }

  // Handle rgb(r, g, b)
  if (colorStr.startsWith('rgb(')) {
    final inner = colorStr.substring(4, colorStr.length - 1);
    final parts = inner.split(',').map((s) => s.trim()).toList();
    if (parts.length == 3) {
      final r = int.tryParse(parts[0]) ?? 0;
      final g = int.tryParse(parts[1]) ?? 0;
      final b = int.tryParse(parts[2]) ?? 0;
      return Color.fromRGBO(r, g, b, 1.0);
    }
  }

  // Fallback
  return const Color(0xFFB388FF);
}
