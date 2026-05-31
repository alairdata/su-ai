import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type PaymentEventType =
  | 'checkout_started'
  | 'subscription_created'
  | 'payment_success'
  | 'payment_failed'
  | 'subscription_cancelled'
  | 'subscription_expired'
  | 'subscription_updated';

export async function logPaymentEvent(params: {
  user_id?: string | null;
  event_type: PaymentEventType;
  plan?: string | null;
  amount_usd?: number | null;
  status?: string | null;
  provider?: string;
  failure_reason?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    await supabase.from('payment_events').insert({
      user_id: params.user_id ?? null,
      event_type: params.event_type,
      plan: params.plan ?? null,
      amount_usd: params.amount_usd ?? null,
      status: params.status ?? null,
      provider: params.provider ?? 'lemonsqueezy',
      failure_reason: params.failure_reason ?? null,
      metadata: params.metadata ?? null,
    });
  } catch (err) {
    console.error('Failed to log payment event:', err);
  }
}
