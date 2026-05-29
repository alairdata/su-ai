import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../config/theme.dart';
import '../../providers/auth_provider.dart';
import '../../services/payment_service.dart';
import 'paystack_webview.dart';

class PlansScreen extends ConsumerStatefulWidget {
  const PlansScreen({super.key});

  @override
  ConsumerState<PlansScreen> createState() => _PlansScreenState();
}

class _PlansScreenState extends ConsumerState<PlansScreen> {
  final PaymentService _paymentService = PaymentService();
  bool _loading = false;
  String? _selectedPlan;

  Future<void> _handleUpgrade(String plan) async {
    setState(() {
      _loading = true;
      _selectedPlan = plan;
    });

    final result = await _paymentService.initializePayment(plan);

    if (!mounted) return;

    setState(() => _loading = false);

    if (result.success && result.authorizationUrl != null) {
      final paymentResult = await Navigator.push<bool>(
        context,
        MaterialPageRoute(
          builder: (_) => PaystackWebView(
            url: result.authorizationUrl!,
            reference: result.reference!,
          ),
        ),
      );

      if (paymentResult == true && mounted) {
        // Payment successful, refresh user data
        final authNotifier = ref.read(authProvider.notifier);
        // Force a session refresh to get updated plan
        await authNotifier.login(
          ref.read(authProvider).user!.email,
          '', // Won't actually re-login, just refresh
        );
        // Better approach: just verify and update locally
        _verifyAndUpdate(result.reference!);
      }
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(result.error ?? 'Failed to initialize payment')),
      );
    }
  }

  Future<void> _verifyAndUpdate(String reference) async {
    final result = await _paymentService.verifyPayment(reference);
    if (!mounted) return;

    if (result.success && result.plan != null) {
      final user = ref.read(authProvider).user;
      if (user != null) {
        ref.read(authProvider.notifier).updateUser(
              user.copyWith(plan: result.plan),
            );
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result.message ?? 'Plan updated to ${result.plan}!'),
          backgroundColor: AppColors.success,
        ),
      );
    }
  }

  Future<void> _handleChangePlan(String newPlan) async {
    final user = ref.read(authProvider).user;
    if (user == null) return;

    final isDowngrade = user.plan == 'Plus' && newPlan == 'Pro';

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(isDowngrade ? 'Downgrade Plan' : 'Upgrade Plan'),
        content: Text(isDowngrade
            ? 'Your Plus features will remain active until the end of your billing period. After that, you\'ll be on the Pro plan.'
            : 'You\'ll be charged the prorated difference for upgrading to $newPlan.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(isDowngrade ? 'Downgrade' : 'Upgrade'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() {
      _loading = true;
      _selectedPlan = newPlan;
    });

    final result = await _paymentService.changePlan(newPlan);

    if (!mounted) return;
    setState(() => _loading = false);

    if (result.success) {
      if (result.immediate && result.newPlan != null) {
        ref.read(authProvider.notifier).updateUser(
              user.copyWith(plan: result.newPlan),
            );
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result.message ?? 'Plan change successful'),
          backgroundColor: AppColors.success,
        ),
      );
    } else if (result.redirect == 'checkout') {
      // No active subscription, need to go through checkout
      _handleUpgrade(newPlan);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(result.error ?? 'Failed to change plan')),
      );
    }
  }

  Future<void> _handleCancel() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancel Subscription'),
        content: const Text(
          'Your subscription will remain active until the end of the current billing period. After that, you\'ll be downgraded to the Free plan.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Keep Subscription'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Cancel Subscription',
                style: TextStyle(color: AppColors.danger)),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() => _loading = true);

    final result = await _paymentService.cancelSubscription();

    if (!mounted) return;
    setState(() => _loading = false);

    if (result.success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result.message ?? 'Subscription cancelled'),
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(result.error ?? 'Failed to cancel')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final user = ref.watch(authProvider).user;
    final currentPlan = user?.plan ?? 'Free';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Plans'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Current plan badge
            Center(
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(
                  color: AppColors.accent.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  'Current Plan: $currentPlan',
                  style: const TextStyle(
                    color: AppColors.accent,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Plan cards
            _PlanCard(
              name: 'Free',
              price: '\$0',
              period: 'forever',
              features: const [
                '5 messages per day',
                'Basic AI responses',
                'Dark & light themes',
              ],
              isCurrent: currentPlan == 'Free',
              isDark: isDark,
              onSelect: null, // Can't "select" free
            ),
            const SizedBox(height: 12),

            _PlanCard(
              name: 'Pro',
              price: '\$4.99',
              period: '/month',
              features: const [
                '100 messages per day',
                'File uploads (images, PDFs)',
                'Custom characters',
                'Web search',
              ],
              isCurrent: currentPlan == 'Pro',
              isPopular: true,
              isDark: isDark,
              loading: _loading && _selectedPlan == 'Pro',
              onSelect: currentPlan == 'Pro'
                  ? null
                  : currentPlan == 'Plus'
                      ? () => _handleChangePlan('Pro')
                      : () => _handleUpgrade('Pro'),
              buttonLabel: currentPlan == 'Pro'
                  ? 'Current Plan'
                  : currentPlan == 'Plus'
                      ? 'Downgrade'
                      : 'Upgrade',
            ),
            const SizedBox(height: 12),

            _PlanCard(
              name: 'Plus',
              price: '\$9.99',
              period: '/month',
              features: const [
                '300 messages per day',
                'Everything in Pro',
                'AI memory across chats',
                'Priority responses',
              ],
              isCurrent: currentPlan == 'Plus',
              isDark: isDark,
              loading: _loading && _selectedPlan == 'Plus',
              onSelect: currentPlan == 'Plus'
                  ? null
                  : currentPlan == 'Pro'
                      ? () => _handleChangePlan('Plus')
                      : () => _handleUpgrade('Plus'),
              buttonLabel: currentPlan == 'Plus'
                  ? 'Current Plan'
                  : 'Upgrade',
            ),

            // Cancel subscription
            if (currentPlan != 'Free') ...[
              const SizedBox(height: 24),
              Center(
                child: TextButton(
                  onPressed: _loading ? null : _handleCancel,
                  child: const Text(
                    'Cancel Subscription',
                    style: TextStyle(
                      color: AppColors.danger,
                      fontSize: 14,
                    ),
                  ),
                ),
              ),
            ],

            const SizedBox(height: 16),
            Center(
              child: Text(
                'Payments are processed securely via Paystack',
                style: TextStyle(
                  fontSize: 12,
                  color: isDark
                      ? AppColors.darkTextMuted
                      : AppColors.lightTextMuted,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PlanCard extends StatelessWidget {
  final String name;
  final String price;
  final String period;
  final List<String> features;
  final bool isCurrent;
  final bool isPopular;
  final bool isDark;
  final bool loading;
  final VoidCallback? onSelect;
  final String? buttonLabel;

  const _PlanCard({
    required this.name,
    required this.price,
    required this.period,
    required this.features,
    this.isCurrent = false,
    this.isPopular = false,
    required this.isDark,
    this.loading = false,
    this.onSelect,
    this.buttonLabel,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkBgSecondary : AppColors.lightBgSecondary,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isCurrent
              ? AppColors.accent
              : isPopular
                  ? AppColors.accent.withValues(alpha: 0.4)
                  : (isDark ? AppColors.darkBorder : AppColors.lightBorder),
          width: isCurrent || isPopular ? 2 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              Text(
                name,
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: isDark
                      ? AppColors.darkTextPrimary
                      : AppColors.lightTextPrimary,
                ),
              ),
              if (isPopular) ...[
                const SizedBox(width: 8),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppColors.accent,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Text(
                    'POPULAR',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
              if (isCurrent) ...[
                const SizedBox(width: 8),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppColors.success.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Text(
                    'CURRENT',
                    style: TextStyle(
                      color: AppColors.success,
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 8),

          // Price
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                price,
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w800,
                  color: AppColors.accent,
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Text(
                  period,
                  style: TextStyle(
                    fontSize: 14,
                    color: isDark
                        ? AppColors.darkTextSecondary
                        : AppColors.lightTextSecondary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Features
          ...features.map((f) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  children: [
                    const Icon(Icons.check_circle, color: AppColors.accent, size: 18),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        f,
                        style: TextStyle(
                          fontSize: 14,
                          color: isDark
                              ? AppColors.darkTextSecondary
                              : AppColors.lightTextSecondary,
                        ),
                      ),
                    ),
                  ],
                ),
              )),

          // Button
          if (onSelect != null || isCurrent) ...[
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: loading ? null : onSelect,
                style: ElevatedButton.styleFrom(
                  backgroundColor: isCurrent
                      ? (isDark ? AppColors.darkBgTertiary : AppColors.lightBgTertiary)
                      : AppColors.accent,
                  foregroundColor: isCurrent
                      ? (isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary)
                      : Colors.white,
                  minimumSize: const Size(double.infinity, 44),
                ),
                child: loading
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : Text(buttonLabel ?? (isCurrent ? 'Current Plan' : 'Select')),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
