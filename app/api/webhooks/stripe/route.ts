import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        await handleSubscriptionChange(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        await handleSubscriptionCanceled(subscription);
        break;
      }

      case 'invoice.payment_succeeded': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const invoice = event.data.object as any;
        if (invoice.subscription) {
          await handlePaymentSucceeded(invoice);
        }
        break;
      }

      case 'invoice.payment_failed': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const invoice = event.data.object as any;
        if (invoice.subscription) {
          await handlePaymentFailed(invoice);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSubscriptionChange(subscription: any) {
  const userId = subscription.metadata?.userId;
  const plan = subscription.metadata?.plan;

  if (!userId) {
    console.error('No userId in subscription metadata');
    return;
  }

  const updateData: Record<string, unknown> = {
    stripe_subscription_id: subscription.id,
    subscription_status: subscription.status,
    current_period_end: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null,
  };

  // Only update plan if subscription is active
  if (subscription.status === 'active' && plan) {
    updateData.plan = plan;
  }

  const { error } = await supabase
    .from('users')
    .update(updateData)
    .eq('id', userId);

  if (error) {
    console.error('Failed to update subscription:', error);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSubscriptionCanceled(subscription: any) {
  const userId = subscription.metadata?.userId;

  if (!userId) {
    console.error('No userId in subscription metadata');
    return;
  }

  // Downgrade to Free plan
  const { error } = await supabase
    .from('users')
    .update({
      plan: 'Free',
      subscription_status: 'canceled',
      stripe_subscription_id: null,
      current_period_end: null,
    })
    .eq('id', userId);

  if (error) {
    console.error('Failed to cancel subscription:', error);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handlePaymentSucceeded(invoice: any) {
  const subscriptionId = invoice.subscription as string;

  // Get subscription to access metadata
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any;
  const userId = subscription.metadata?.userId;

  if (!userId) return;

  // Update the period end date
  const { error } = await supabase
    .from('users')
    .update({
      subscription_status: 'active',
      current_period_end: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null,
    })
    .eq('id', userId);

  if (error) {
    console.error('Failed to update after payment succeeded:', error);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handlePaymentFailed(invoice: any) {
  const subscriptionId = invoice.subscription as string;

  // Get subscription to access metadata
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any;
  const userId = subscription.metadata?.userId;

  if (!userId) return;

  // Mark subscription as past_due
  const { error } = await supabase
    .from('users')
    .update({
      subscription_status: 'past_due',
    })
    .eq('id', userId);

  if (error) {
    console.error('Failed to update after payment failed:', error);
  }
}
