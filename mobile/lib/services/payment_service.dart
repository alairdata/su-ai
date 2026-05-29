import 'api_client.dart';

class PaymentInitResult {
  final bool success;
  final String? reference;
  final String? authorizationUrl;
  final int? amount;
  final String? error;

  const PaymentInitResult({
    required this.success,
    this.reference,
    this.authorizationUrl,
    this.amount,
    this.error,
  });
}

class PaymentVerifyResult {
  final bool success;
  final String? plan;
  final String? message;
  final String? status;

  const PaymentVerifyResult({
    required this.success,
    this.plan,
    this.message,
    this.status,
  });
}

class PlanChangeResult {
  final bool success;
  final String? message;
  final String? newPlan;
  final bool immediate;
  final String? effectiveDate;
  final String? error;
  final String? redirect;

  const PlanChangeResult({
    required this.success,
    this.message,
    this.newPlan,
    this.immediate = false,
    this.effectiveDate,
    this.error,
    this.redirect,
  });
}

class CancelResult {
  final bool success;
  final String? message;
  final String? currentPeriodEnd;
  final String? error;

  const CancelResult({
    required this.success,
    this.message,
    this.currentPeriodEnd,
    this.error,
  });
}

class PaymentService {
  final ApiClient _api = ApiClient.instance;

  Future<PaymentInitResult> initializePayment(String plan) async {
    try {
      final response = await _api.post(
        '/api/payment/initialize',
        data: {'plan': plan},
      );
      final data = response.data as Map<String, dynamic>;
      return PaymentInitResult(
        success: data['success'] == true,
        reference: data['reference'] as String?,
        authorizationUrl: data['authorization_url'] as String?,
        amount: data['amount'] as int?,
      );
    } catch (e) {
      return PaymentInitResult(
        success: false,
        error: _extractError(e),
      );
    }
  }

  Future<PaymentVerifyResult> verifyPayment(String reference) async {
    try {
      final response = await _api.post(
        '/api/payment/verify',
        data: {'reference': reference},
      );
      final data = response.data as Map<String, dynamic>;
      return PaymentVerifyResult(
        success: data['success'] == true,
        plan: data['plan'] as String?,
        message: data['message'] as String?,
        status: data['status'] as String?,
      );
    } catch (e) {
      return PaymentVerifyResult(
        success: false,
        message: _extractError(e),
      );
    }
  }

  Future<PlanChangeResult> changePlan(String newPlan) async {
    try {
      final response = await _api.post(
        '/api/subscription/change-plan',
        data: {'newPlan': newPlan},
      );
      final data = response.data as Map<String, dynamic>;
      return PlanChangeResult(
        success: data['success'] == true,
        message: data['message'] as String?,
        newPlan: data['newPlan'] as String?,
        immediate: data['immediate'] == true,
        effectiveDate: data['effectiveDate'] as String?,
      );
    } catch (e) {
      final error = _extractError(e);
      return PlanChangeResult(
        success: false,
        error: error,
        redirect: _extractField(e, 'redirect'),
      );
    }
  }

  Future<CancelResult> cancelSubscription() async {
    try {
      final response = await _api.post('/api/subscription/cancel');
      final data = response.data as Map<String, dynamic>;
      return CancelResult(
        success: data['success'] == true,
        message: data['message'] as String?,
        currentPeriodEnd: data['current_period_end'] as String?,
      );
    } catch (e) {
      return CancelResult(
        success: false,
        error: _extractError(e),
      );
    }
  }

  String _extractError(dynamic e) {
    if (e is Exception) {
      try {
        final dioError = e as dynamic;
        final data = dioError.response?.data;
        if (data is Map<String, dynamic> && data['error'] != null) {
          return data['error'] as String;
        }
      } catch (_) {}
    }
    return 'Something went wrong. Please try again.';
  }

  String? _extractField(dynamic e, String field) {
    try {
      final dioError = e as dynamic;
      final data = dioError.response?.data;
      if (data is Map<String, dynamic>) {
        return data[field] as String?;
      }
    } catch (_) {}
    return null;
  }
}
