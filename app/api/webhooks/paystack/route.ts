import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/paystack';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('x-paystack-signature');

  // Verify webhook signature if secret is configured
  if (process.env.PAYSTACK_WEBHOOK_SECRET && signature) {
    if (!verifyWebhookSignature(body, signature)) {
      console.error('Webhook signature verification failed');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }
  }

  let event;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    switch (event.event) {
      case 'charge.success': {
        await handleChargeSuccess(event.data);
        break;
      }

      case 'subscription.create': {
        await handleSubscriptionCreate(event.data);
        break;
      }

      case 'subscription.disable':
      case 'subscription.not_renew': {
        await handleSubscriptionDisabled(event.data);
        break;
      }

      case 'invoice.payment_failed': {
        await handlePaymentFailed(event.data);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.event}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleChargeSuccess(data: any) {
  const { metadata, customer, reference } = data;
  const userId = metadata?.userId;
  const plan = metadata?.plan;

  if (!userId) {
    console.error('No userId in charge metadata');
    return;
  }

  // Calculate subscription period end (30 days from now for monthly)
  const currentPeriodEnd = new Date();
  currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 30);

  const updateData: Record<string, unknown> = {
    paystack_customer_code: customer?.customer_code,
    paystack_subscription_code: reference,
    subscription_status: 'active',
    current_period_end: currentPeriodEnd.toISOString(),
  };

  if (plan) {
    updateData.plan = plan;
  }

  const { error } = await supabase
    .from('users')
    .update(updateData)
    .eq('id', userId);

  if (error) {
    console.error('Failed to update after charge success:', error);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSubscriptionCreate(data: any) {
  const { customer, subscription_code, next_payment_date } = data;

  // Find user by customer code
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('id')
    .eq('paystack_customer_code', customer?.customer_code)
    .single();

  if (fetchError || !user) {
    console.error('User not found for subscription:', customer?.customer_code);
    return;
  }

  const { error } = await supabase
    .from('users')
    .update({
      paystack_subscription_code: subscription_code,
      subscription_status: 'active',
      current_period_end: next_payment_date
        ? new Date(next_payment_date).toISOString()
        : null,
    })
    .eq('id', user.id);

  if (error) {
    console.error('Failed to update subscription:', error);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSubscriptionDisabled(data: any) {
  const { customer, subscription_code } = data;

  // Find user by customer code or subscription code
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('id')
    .or(`paystack_customer_code.eq.${customer?.customer_code},paystack_subscription_code.eq.${subscription_code}`)
    .single();

  if (fetchError || !user) {
    console.error('User not found for subscription cancellation');
    return;
  }

  // Downgrade to Free plan
  const { error } = await supabase
    .from('users')
    .update({
      plan: 'Free',
      subscription_status: 'canceled',
      paystack_subscription_code: null,
      current_period_end: null,
    })
    .eq('id', user.id);

  if (error) {
    console.error('Failed to cancel subscription:', error);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handlePaymentFailed(data: any) {
  const { customer, subscription } = data;

  // Find user by customer code
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('id')
    .eq('paystack_customer_code', customer?.customer_code)
    .single();

  if (fetchError || !user) {
    console.error('User not found for payment failure:', subscription?.subscription_code);
    return;
  }

  // Mark subscription as past_due
  const { error } = await supabase
    .from('users')
    .update({
      subscription_status: 'past_due',
    })
    .eq('id', user.id);

  if (error) {
    console.error('Failed to update after payment failed:', error);
  }
}
