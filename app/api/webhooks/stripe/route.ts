import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature, stripe } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { sendSubscriptionEmail } from '@/lib/email';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// SECURITY: Track processed webhook event IDs to prevent replay attacks
const processedWebhooks = new Set<string>();
const WEBHOOK_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Clean up old entries periodically
setInterval(() => {
  processedWebhooks.clear(); // Simple clear every 24 hours
}, WEBHOOK_CACHE_DURATION);

export async function POST(req: NextRequest) {
  // SECURITY: Validate Content-Type header
  const contentType = req.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    console.error('Invalid content-type:', contentType);
    return NextResponse.json({ error: 'Invalid content type' }, { status: 400 });
  }

  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    console.error('Missing stripe-signature header');
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = verifyWebhookSignature(body, signature);
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // SECURITY: Prevent webhook replay attacks using event ID
  const eventId = event.id;
  if (eventId) {
    if (processedWebhooks.has(eventId)) {
      console.log('Duplicate webhook ignored:', eventId);
      return NextResponse.json({ received: true, duplicate: true });
    }
    processedWebhooks.add(eventId);
  }

  console.log('Stripe webhook received:', event.type);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      }

      case 'customer.subscription.updated': {
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      }

      case 'invoice.payment_failed': {
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
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

// Helper to get current period end from subscription
function getSubscriptionPeriodEnd(subscription: Stripe.Subscription): Date {
  const subscriptionItem = subscription.items?.data?.[0];
  if (subscriptionItem?.current_period_end) {
    return new Date(subscriptionItem.current_period_end * 1000);
  }
  // Fallback: 30 days from now
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const plan = session.metadata?.plan;

  if (!userId) {
    console.error('No userId in checkout session metadata');
    return;
  }

  // Get subscription details if available
  let subscriptionId = session.subscription;
  let currentPeriodEnd: Date;

  if (subscriptionId && typeof subscriptionId === 'string') {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    currentPeriodEnd = getSubscriptionPeriodEnd(subscription);
  } else {
    // Fallback: 30 days from now
    currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }

  const customerId = typeof session.customer === 'string'
    ? session.customer
    : session.customer?.id;

  const updateData: Record<string, unknown> = {
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
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
    console.error('Failed to update after checkout completed:', error);
  } else {
    console.log(`User ${userId} upgraded to ${plan}`);

    // Send subscription welcome email
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('name, email')
        .eq('id', userId)
        .single();

      if (userData?.email && plan) {
        await sendSubscriptionEmail(
          userData.email,
          userData.name || 'there',
          plan,
          'subscribed'
        );
      }
    } catch (emailError) {
      console.error('Failed to send subscription email:', emailError);
    }
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;

  if (!userId) {
    // Try to find user by stripe_subscription_id
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('id')
      .eq('stripe_subscription_id', subscription.id)
      .single();

    if (fetchError || !user) {
      console.error('User not found for subscription update:', subscription.id);
      return;
    }

    await updateUserSubscription(user.id, subscription);
  } else {
    await updateUserSubscription(userId, subscription);
  }
}

async function updateUserSubscription(userId: string, subscription: Stripe.Subscription) {
  const status = mapStripeStatus(subscription.status);
  const currentPeriodEnd = getSubscriptionPeriodEnd(subscription);

  const updateData: Record<string, unknown> = {
    subscription_status: status,
    current_period_end: currentPeriodEnd.toISOString(),
  };

  // If subscription is set to cancel at period end
  if (subscription.cancel_at_period_end) {
    updateData.subscription_status = 'canceling';
  }

  // Check if plan changed (from metadata or price lookup)
  const newPlan = subscription.metadata?.plan;
  if (newPlan && ['Pro', 'Plus'].includes(newPlan)) {
    updateData.plan = newPlan;
    // If it was a scheduled downgrade that's now active
    if (subscription.metadata?.scheduledDowngrade === 'true' && !subscription.cancel_at_period_end) {
      updateData.subscription_status = 'active';
    }
  }

  // Also check current price to determine plan
  const currentPriceId = subscription.items?.data?.[0]?.price?.id;
  if (currentPriceId) {
    if (currentPriceId === process.env.STRIPE_PRO_PRICE_ID) {
      updateData.plan = 'Pro';
    } else if (currentPriceId === process.env.STRIPE_PLUS_PRICE_ID) {
      updateData.plan = 'Plus';
    }
  }

  const { error } = await supabase
    .from('users')
    .update(updateData)
    .eq('id', userId);

  if (error) {
    console.error('Failed to update subscription:', error);
  } else {
    console.log(`User ${userId} subscription updated:`, updateData);
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;

  // Find user by subscription ID if no userId in metadata
  let userIdToUpdate = userId;
  if (!userIdToUpdate) {
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('id')
      .eq('stripe_subscription_id', subscription.id)
      .single();

    if (fetchError || !user) {
      console.error('User not found for subscription deletion:', subscription.id);
      return;
    }
    userIdToUpdate = user.id;
  }

  // Get user info before downgrading (for email)
  const { data: userData } = await supabase
    .from('users')
    .select('name, email, plan')
    .eq('id', userIdToUpdate)
    .single();

  const previousPlan = userData?.plan;

  // Downgrade to Free plan
  const { error } = await supabase
    .from('users')
    .update({
      plan: 'Free',
      subscription_status: 'canceled',
      stripe_subscription_id: null,
      current_period_end: null,
    })
    .eq('id', userIdToUpdate);

  if (error) {
    console.error('Failed to cancel subscription:', error);
  } else {
    console.log(`User ${userIdToUpdate} downgraded to Free`);

    // Send subscription ended email (different from cancellation email)
    // Note: The cancellation confirmation email was already sent when they initiated cancellation
    // This is for when the subscription actually ends
    if (userData?.email && previousPlan && previousPlan !== 'Free') {
      try {
        await sendSubscriptionEmail(
          userData.email,
          userData.name || 'there',
          previousPlan,
          'cancelled'
        );
      } catch (emailError) {
        console.error('Failed to send subscription ended email:', emailError);
      }
    }
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  // Get subscription ID from parent.subscription_details
  const subscriptionDetails = invoice.parent?.subscription_details;
  const subscriptionId = subscriptionDetails?.subscription;

  if (!subscriptionId) {
    return;
  }

  const subId = typeof subscriptionId === 'string' ? subscriptionId : subscriptionId.id;

  // Find user by subscription ID
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('id')
    .eq('stripe_subscription_id', subId)
    .single();

  if (fetchError || !user) {
    console.error('User not found for payment failure:', subId);
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

function mapStripeStatus(stripeStatus: Stripe.Subscription.Status): string {
  switch (stripeStatus) {
    case 'active':
      return 'active';
    case 'past_due':
      return 'past_due';
    case 'canceled':
      return 'canceled';
    case 'unpaid':
      return 'past_due';
    case 'trialing':
      return 'active';
    case 'incomplete':
    case 'incomplete_expired':
      return 'pending';
    case 'paused':
      return 'paused';
    default:
      return stripeStatus;
  }
}
