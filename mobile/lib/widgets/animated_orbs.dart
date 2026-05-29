import 'dart:math';
import 'package:flutter/material.dart';
import 'dart:ui';

class AnimatedOrbs extends StatefulWidget {
  const AnimatedOrbs({super.key});

  @override
  State<AnimatedOrbs> createState() => _AnimatedOrbsState();
}

class _AnimatedOrbsState extends State<AnimatedOrbs>
    with TickerProviderStateMixin {
  late final AnimationController _controller1;
  late final AnimationController _controller2;
  late final AnimationController _controller3;

  @override
  void initState() {
    super.initState();
    _controller1 = AnimationController(
      duration: const Duration(seconds: 6),
      vsync: this,
    )..repeat(reverse: true);
    _controller2 = AnimationController(
      duration: const Duration(seconds: 8),
      vsync: this,
    )..repeat(reverse: true);
    _controller3 = AnimationController(
      duration: const Duration(seconds: 10),
      vsync: this,
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller1.dispose();
    _controller2.dispose();
    _controller3.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final size = MediaQuery.of(context).size;

    return SizedBox.expand(
      child: Stack(
        children: [
          // Orb 1 - top right
          AnimatedBuilder(
            animation: _controller1,
            builder: (_, __) {
              final dx = sin(_controller1.value * pi * 2) * 20;
              final dy = cos(_controller1.value * pi * 2) * 15;
              return Positioned(
                right: -150 + dx,
                top: -150 + dy,
                child: _Orb(
                  size: size.width * 1.2,
                  colors: isDark
                      ? [
                          const Color(0x80505A5A),
                          const Color(0x00505A5A),
                        ]
                      : [
                          const Color(0x66C8B4DC),
                          const Color(0x00C8B4DC),
                        ],
                ),
              );
            },
          ),
          // Orb 2 - bottom left
          AnimatedBuilder(
            animation: _controller2,
            builder: (_, __) {
              final dx = cos(_controller2.value * pi * 2) * 15;
              final dy = sin(_controller2.value * pi * 2) * 20;
              return Positioned(
                left: -100 + dx,
                bottom: -100 + dy,
                child: _Orb(
                  size: size.width,
                  colors: isDark
                      ? [
                          const Color(0x803C3C46),
                          const Color(0x003C3C46),
                        ]
                      : [
                          const Color(0x80B4C8DC),
                          const Color(0x00B4C8DC),
                        ],
                ),
              );
            },
          ),
          // Orb 3 - center
          AnimatedBuilder(
            animation: _controller3,
            builder: (_, __) {
              final dx = sin(_controller3.value * pi * 2) * 10;
              final dy = cos(_controller3.value * pi * 2) * 12;
              return Positioned(
                left: size.width * 0.3 + dx,
                top: size.height * 0.4 + dy,
                child: _Orb(
                  size: size.width * 0.85,
                  colors: isDark
                      ? [
                          const Color(0x66464650),
                          const Color(0x00464650),
                        ]
                      : [
                          const Color(0x59DCBEC8),
                          const Color(0x00DCBEC8),
                        ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}

class _Orb extends StatelessWidget {
  final double size;
  final List<Color> colors;

  const _Orb({required this.size, required this.colors});

  @override
  Widget build(BuildContext context) {
    return ImageFiltered(
      imageFilter: ImageFilter.blur(sigmaX: 40, sigmaY: 40),
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(colors: colors),
        ),
      ),
    );
  }
}
