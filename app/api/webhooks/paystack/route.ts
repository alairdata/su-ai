import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyWebhookSignature, getNextBillingDate } from '@/lib/paystack';
import { sendSubscriptionEmail } from '@/lib/email';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Track processed webhook references to prevent replay attacks
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
  const signature = req.headers.get('x-paystack-signature');

  if (!signature) {
    console.error('Missing x-paystack-signature header');
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  // Verify webhook signature
  if (!verifyWebhookSignature(body, signature)) {
    console.error('Webhook signature verification failed');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  let event;
  try {
    event = JSON.parse(body);
  } catch (error) {
    console.error('Failed to parse webhook body:', error);
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // SECURITY: Prevent webhook replay attacks using reference
  const reference = event.data?.reference;
  if (reference) {
    const webhookKey = `${event.event}:${reference}`;
    if (processedWebhooks.has(webhookKey)) {
      console.log('Duplicate webhook ignored:', webhookKey);
      return NextResponse.json({ received: true, duplicate: true });
    }
    processedWebhooks.add(webhookKey);
  }

  console.log('Paystack webhook received:', event.event);

  try {
    switch (event.event) {
      case 'charge.success': {
        await handleChargeSuccess(event.data);
        break;
      }

      case 'charge.failed': {
        await handleChargeFailed(event.data);
        break;
      }

      case 'subscription.create': {
        // If using Paystack subscriptions (we're doing manual recurring instead)
        console.log('Subscription created:', event.data);
        break;
      }

      case 'subscription.disable': {
        console.log('Subscription disabled:', event.data);
        break;
      }

      case 'transfer.success': {
        // For when you receive payouts
        console.log('Transfer successful:', event.data);
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

async function handleChargeSuccess(data: {
  reference: string;
  amount: number;
  customer: {
    email: string;
    customer_code: string;
  };
  authorization: {
    authorization_code: string;
    card_type: string;
    last4: string;
    reusable: boolean;
  };
  metadata?: {
    userId?: string;
    plan?: string;
    type?: string; // 'renewal' for recurring charges
  };
}) {
  const { metadata, authorization, customer } = data;

  if (!metadata?.userId) {
    // Try to find user by customer code
    const { data: user } = await supabase
      .from('users')
      .select('id, email, name, plan')
      .eq('paystack_customer_code', customer.customer_code)
      .single();

    if (!user) {
      console.error('User not found for charge:', data.reference);
      return;
    }

    // This is likely a recurring charge
    if (metadata?.type === 'renewal') {
      const currentPeriodEnd = getNextBillingDate();

      await supabase
        .from('users')
        .update({
          subscription_status: 'active',
          current_period_end: currentPeriodEnd.toISOString(),
          // Update authorization in case card was updated
          paystack_authorization: authorization?.authorization_code || null,
          paystack_card_last4: authorization?.last4 || null,
          paystack_card_brand: authorization?.card_type || null,
        })
        .eq('id', user.id);

      console.log('Recurring charge successful for user:', user.id);
    }
    return;
  }

  // New subscription charge
  const { userId, plan } = metadata;

  if (plan) {
    const currentPeriodEnd = getNextBillingDate();

    const { error } = await supabase
      .from('users')
      .update({
        plan: plan,
        subscription_status: 'active',
        current_period_end: currentPeriodEnd.toISOString(),
        paystack_customer_code: customer?.customer_code || null,
        paystack_authorization: authorization?.authorization_code || null,
        paystack_card_last4: authorization?.last4 || null,
        paystack_card_brand: authorization?.card_type || null,
      })
      .eq('id', userId);

    if (error) {
      console.error('Failed to update user after webhook:', error);
      return;
    }

    // Send welcome email
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('name, email')
        .eq('id', userId)
        .single();

      if (userData?.email) {
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

    console.log(`User ${userId} subscribed to ${plan} via webhook`);
  }
}

async function handleChargeFailed(data: {
  reference: string;
  customer: {
    email: string;
    customer_code: string;
  };
  metadata?: {
    userId?: string;
    type?: string;
  };
}) {
  const { customer, metadata } = data;

  // Find user
  let userId = metadata?.userId;

  if (!userId) {
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('paystack_customer_code', customer.customer_code)
      .single();

    if (user) {
      userId = user.id;
    }
  }

  if (!userId) {
    console.error('User not found for failed charge:', data.reference);
    return;
  }

  // Mark subscription as past_due
  await supabase
    .from('users')
    .update({
      subscription_status: 'past_due',
    })
    .eq('id', userId);

  console.log('Marked user as past_due:', userId);

  // TODO: Send payment failed email
}
