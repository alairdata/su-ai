import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppColors {
  AppColors._();

  // Dark theme
  static const Color darkBg = Color(0xFF0C0C0E);
  static const Color darkBgSecondary = Color(0xFF141416);
  static const Color darkBgTertiary = Color(0xFF1A1A1E);
  static const Color darkBgHover = Color(0xFF222228);
  static const Color darkTextPrimary = Color(0xFFF0EDE8);
  static const Color darkTextSecondary = Color(0xFF8A8690);
  static const Color darkTextMuted = Color(0xFF5A5660);
  static const Color darkBorder = Color(0x0FFFFFFF);
  static const Color darkBorderActive = Color(0x1FFFFFFF);

  // Light theme
  static const Color lightBg = Color(0xFFF8F7F4);
  static const Color lightBgSecondary = Color(0xFFFFFFFF);
  static const Color lightBgTertiary = Color(0xFFF0EDE8);
  static const Color lightBgHover = Color(0xFFE8E4DE);
  static const Color lightTextPrimary = Color(0xFF1A1A1E);
  static const Color lightTextSecondary = Color(0xFF6B6570);
  static const Color lightTextMuted = Color(0xFF9A9498);
  static const Color lightBorder = Color(0x0F000000);
  static const Color lightBorderActive = Color(0x1F000000);

  // Accent colors
  static const Color accent = Color(0xFFE8A04C);
  static const Color accentLight = Color(0xFFD08A30);
  static const Color accentDim = Color(0x1FE8A04C);
  static const Color accentGlow = Color(0x0FE8A04C);
  static const Color gradientStart = Color(0xFFE8A04C);
  static const Color gradientEnd = Color(0xFFE8624C);

  // Semantic
  static const Color danger = Color(0xFFE85A5A);
  static const Color success = Color(0xFF4CAF50);
}

class AppTheme {
  AppTheme._();

  static TextTheme _buildTextTheme(TextTheme base) {
    return GoogleFonts.dmSansTextTheme(base);
  }

  static ThemeData dark() {
    final base = ThemeData.dark();
    return base.copyWith(
      scaffoldBackgroundColor: AppColors.darkBg,
      colorScheme: const ColorScheme.dark(
        surface: AppColors.darkBg,
        primary: AppColors.accent,
        secondary: AppColors.accentLight,
        error: AppColors.danger,
        onSurface: AppColors.darkTextPrimary,
        onPrimary: AppColors.darkBg,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.darkBg,
        foregroundColor: AppColors.darkTextPrimary,
        elevation: 0,
        scrolledUnderElevation: 0,
      ),
      drawerTheme: const DrawerThemeData(
        backgroundColor: AppColors.darkBgSecondary,
      ),
      cardTheme: const CardThemeData(
        color: AppColors.darkBgSecondary,
        elevation: 0,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.darkBgSecondary,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.darkBorder),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.darkBorder),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.accent),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.danger),
        ),
        hintStyle: const TextStyle(color: AppColors.darkTextMuted),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.accent,
          foregroundColor: AppColors.darkBg,
          minimumSize: const Size(double.infinity, 52),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.accent,
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: AppColors.darkBorder,
        thickness: 1,
      ),
      textTheme: _buildTextTheme(base.textTheme),
    );
  }

  static ThemeData light() {
    final base = ThemeData.light();
    return base.copyWith(
      scaffoldBackgroundColor: AppColors.lightBg,
      colorScheme: const ColorScheme.light(
        surface: AppColors.lightBg,
        primary: AppColors.accentLight,
        secondary: AppColors.accent,
        error: AppColors.danger,
        onSurface: AppColors.lightTextPrimary,
        onPrimary: Colors.white,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.lightBg,
        foregroundColor: AppColors.lightTextPrimary,
        elevation: 0,
        scrolledUnderElevation: 0,
      ),
      drawerTheme: const DrawerThemeData(
        backgroundColor: AppColors.lightBgSecondary,
      ),
      cardTheme: const CardThemeData(
        color: AppColors.lightBgSecondary,
        elevation: 0,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.lightBgSecondary,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.lightBorder),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.lightBorder),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.accentLight),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.danger),
        ),
        hintStyle: const TextStyle(color: AppColors.lightTextMuted),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.accentLight,
          foregroundColor: Colors.white,
          minimumSize: const Size(double.infinity, 52),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.accentLight,
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: AppColors.lightBorder,
        thickness: 1,
      ),
      textTheme: _buildTextTheme(base.textTheme),
    );
  }
}
