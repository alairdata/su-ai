import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyWebhookSignature, getNextBillingDate } from '@/lib/lemonsqueezy';
import { sendSubscriptionEmail, sendPaymentFailedEmail } from '@/lib/email';
import { logPaymentEvent } from '@/lib/payment-events';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const VALID_PLANS = ['Pro', 'Plus'];

async function isWebhookProcessed(eventId: string, eventType: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_and_record_webhook', {
    p_event_id: eventId,
    p_provider: 'lemonsqueezy',
    p_event_type: eventType,
  });
  if (error) return false;
  return !data;
}

export async function POST(req: NextRequest) {
  const body = await req.text();

  if (!body?.trim()) {
    return NextResponse.json({ error: 'Empty body' }, { status: 400 });
  }

  const signature = req.headers.get('x-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  if (!verifyWebhookSignature(body, signature)) {
    console.error('[LS Webhook] Signature verification failed');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  let event: {
    meta: { event_name: string; custom_data?: { user_id?: string; plan?: string } };
    data: {
      id: string;
      attributes: {
        status: string;
        customer_id: number;
        variant_id: number;
        renews_at: string | null;
        ends_at: string | null;
        urls?: { customer_portal?: string };
        first_subscription_item?: { id: number };
      };
    };
  };

  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const eventName = event.meta.event_name;
  const subscriptionId = event.data.id;
  const eventId = `${eventName}:${subscriptionId}`;

  const isDuplicate = await isWebhookProcessed(eventId, eventName);
  if (isDuplicate) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  console.log('[LS Webhook]', eventName, subscriptionId);

  const customData = event.meta.custom_data;
  const userId = customData?.user_id;
  const plan = customData?.plan;
  const attrs = event.data.attributes;

  try {
    switch (eventName) {

      case 'subscription_created': {
        if (!userId || !plan || !VALID_PLANS.includes(plan)) {
          console.error('[LS Webhook] Missing/invalid custom data on subscription_created', { userId, plan });
          break;
        }

        const periodEnd = attrs.renews_at ? new Date(attrs.renews_at) : getNextBillingDate();

        await supabase.from('users').update({
          plan,
          subscription_status: 'active',
          current_period_end: periodEnd.toISOString(),
          subscription_started_at: new Date().toISOString(),
          last_paid_plan: plan,
          lemonsqueezy_customer_id: String(attrs.customer_id),
          lemonsqueezy_subscription_id: subscriptionId,
          lemonsqueezy_customer_portal_url: attrs.urls?.customer_portal ?? null,
        }).eq('id', userId);

        await supabase.from('subscription_events').insert({
          user_id: userId,
          event_type: 'subscribed',
          plan,
          amount_usd: plan === 'Pro' ? 4.99 : 9.99,
        });

        const { data: userData } = await supabase
          .from('users').select('name, email').eq('id', userId).single();
        if (userData?.email) {
          await sendSubscriptionEmail(userData.email, userData.name || 'there', plan, 'subscribed')
            .catch(() => {});
        }

        await logPaymentEvent({ user_id: userId, event_type: 'subscription_created', plan, amount_usd: plan === 'Pro' ? 4.99 : 9.99, status: 'active' });
        console.log('[LS Webhook] Subscription created:', { userId, plan });
        break;
      }

      case 'subscription_updated': {
        // Handles renewals and plan changes
        if (!userId) {
          // Try to look up by subscription ID
          const { data: user } = await supabase
            .from('users')
            .select('id, name, email, plan')
            .eq('lemonsqueezy_subscription_id', subscriptionId)
            .single();

          if (!user) {
            console.error('[LS Webhook] User not found for subscription_updated:', subscriptionId);
            break;
          }

          const periodEnd = attrs.renews_at ? new Date(attrs.renews_at) : getNextBillingDate();
          await supabase.from('users').update({
            subscription_status: attrs.status === 'active' ? 'active' : attrs.status,
            current_period_end: periodEnd.toISOString(),
            lemonsqueezy_customer_portal_url: attrs.urls?.customer_portal ?? null,
          }).eq('id', user.id);
          break;
        }

        const periodEnd = attrs.renews_at ? new Date(attrs.renews_at) : getNextBillingDate();
        await supabase.from('users').update({
          subscription_status: attrs.status === 'active' ? 'active' : attrs.status,
          current_period_end: periodEnd.toISOString(),
          lemonsqueezy_customer_portal_url: attrs.urls?.customer_portal ?? null,
        }).eq('id', userId);
        break;
      }

      case 'subscription_payment_success': {
        // Renewal succeeded — extend period
        const { data: user } = await supabase
          .from('users')
          .select('id, name, email, plan')
          .eq('lemonsqueezy_subscription_id', subscriptionId)
          .single();

        if (!user) break;

        const periodEnd = attrs.renews_at ? new Date(attrs.renews_at) : getNextBillingDate();
        await supabase.from('users').update({
          subscription_status: 'active',
          current_period_end: periodEnd.toISOString(),
          retry_count: 0,
          last_retry_at: null,
          grace_period_end: null,
        }).eq('id', user.id);

        await logPaymentEvent({ user_id: user.id, event_type: 'payment_success', plan: user.plan, amount_usd: user.plan === 'Pro' ? 4.99 : 9.99, status: 'renewed' });
        console.log('[LS Webhook] Renewal succeeded:', user.id);
        break;
      }

      case 'subscription_payment_failed': {
        const { data: user } = await supabase
          .from('users')
          .select('id, name, email, plan, retry_count')
          .eq('lemonsqueezy_subscription_id', subscriptionId)
          .single();

        if (!user) break;

        const retryCount = (user.retry_count || 0) + 1;
        await supabase.from('users').update({
          subscription_status: 'past_due',
          retry_count: retryCount,
          last_retry_at: new Date().toISOString(),
        }).eq('id', user.id);

        if (user.email) {
          await sendPaymentFailedEmail(user.email, user.name || 'there', user.plan || 'Pro', retryCount, 3, user.id)
            .catch(() => {});
        }

        await logPaymentEvent({ user_id: user.id, event_type: 'payment_failed', plan: user.plan, status: 'failed', failure_reason: `retry attempt ${retryCount}` });
        console.log('[LS Webhook] Payment failed:', user.id, `retry ${retryCount}`);
        break;
      }

      case 'subscription_payment_recovered': {
        const { data: user } = await supabase
          .from('users')
          .select('id')
          .eq('lemonsqueezy_subscription_id', subscriptionId)
          .single();

        if (!user) break;

        const periodEnd = attrs.renews_at ? new Date(attrs.renews_at) : getNextBillingDate();
        await supabase.from('users').update({
          subscription_status: 'active',
          current_period_end: periodEnd.toISOString(),
          retry_count: 0,
          last_retry_at: null,
          grace_period_end: null,
        }).eq('id', user.id);
        break;
      }

      case 'subscription_cancelled': {
        const { data: user } = await supabase
          .from('users')
          .select('id, name, email, plan, current_period_end')
          .eq('lemonsqueezy_subscription_id', subscriptionId)
          .single();

        if (!user) break;

        await supabase.from('users').update({
          subscription_status: 'canceling',
        }).eq('id', user.id);

        await logPaymentEvent({ user_id: user.id, event_type: 'subscription_cancelled', plan: user.plan, status: 'canceling' });
        if (user.email) {
          await sendSubscriptionEmail(user.email, user.name || 'there', user.plan || 'Pro', 'cancelled', user.current_period_end)
            .catch(() => {});
        }
        break;
      }

      case 'subscription_expired': {
        const { data: user } = await supabase
          .from('users')
          .select('id')
          .eq('lemonsqueezy_subscription_id', subscriptionId)
          .single();

        if (!user) break;

        await supabase.from('users').update({
          plan: 'Free',
          subscription_status: null,
          current_period_end: null,
          lemonsqueezy_subscription_id: null,
          lemonsqueezy_customer_portal_url: null,
        }).eq('id', user.id);

        await logPaymentEvent({ user_id: user.id, event_type: 'subscription_expired', status: 'expired' });
        console.log('[LS Webhook] Subscription expired, downgraded to Free:', user.id);
        break;
      }

      default:
        console.log('[LS Webhook] Unhandled event:', eventName);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[LS Webhook] Handler error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
