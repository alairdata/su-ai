import Stripe from 'stripe';

// Initialize Stripe with secret key
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Subscription plans configuration
export const PLAN_CONFIG = {
  Free: {
    priceUSD: 0,
    messagesPerDay: 10,
    name: 'Free Plan',
    description: '10 messages per day',
    features: [
      '10 messages per day',
      'Basic support',
      'Chat on web',
      'Limited uploads',
      'Limited memory and context',
    ],
    stripePriceId: null,
  },
  Pro: {
    priceUSD: 0.99,
    messagesPerDay: 150,
    name: 'Pro Plan',
    description: '150 messages per day - 15x more than Free',
    features: [
      '150 messages per day',
      '15x more than Free',
      'Expanded memory and context',
      'Early access to new features',
      'More advanced reasoning models',
      'Memory across conversations',
    ],
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID!,
  },
  Plus: {
    priceUSD: 9.99,
    messagesPerDay: 300,
    name: 'Plus Plan',
    description: '300 messages per day - Everything in Pro and more',
    features: [
      'Everything in Pro',
      '300 messages per day',
      '30x more than Free, 2x more than Pro',
      'Higher outputs for more tasks',
      'Priority access at high traffic times',
      'Early access to advanced So UnFiltered AI features',
    ],
    stripePriceId: process.env.STRIPE_PLUS_PRICE_ID!,
  },
};

export type PlanType = 'Free' | 'Pro' | 'Plus';
export type PaidPlanType = 'Pro' | 'Plus';

// Helper to get message limit for a plan
export function getMessageLimit(plan: PlanType): number {
  return PLAN_CONFIG[plan].messagesPerDay;
}

// Create a Stripe Checkout Session for subscription
export async function createCheckoutSession(params: {
  email: string;
  userId: string;
  plan: PlanType;
  successUrl: string;
  cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
  const planConfig = PLAN_CONFIG[params.plan];

  // Debug: Log configuration
  console.log('Creating checkout session with:', {
    plan: params.plan,
    priceId: planConfig.stripePriceId,
    email: params.email,
    hasSecretKey: !!process.env.STRIPE_SECRET_KEY,
  });

  if (!planConfig.stripePriceId) {
    throw new Error(`Missing price ID for plan: ${params.plan}. Check STRIPE_${params.plan.toUpperCase()}_PRICE_ID env var.`);
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    customer_email: params.email,
    line_items: [
      {
        price: planConfig.stripePriceId,
        quantity: 1,
      },
    ],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: {
      userId: params.userId,
      plan: params.plan,
    },
    subscription_data: {
      metadata: {
        userId: params.userId,
        plan: params.plan,
      },
    },
  });

  return session;
}

// Retrieve a Checkout Session by ID
export async function getCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
  return stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['subscription', 'customer'],
  });
}

// Cancel a subscription at period end
export async function cancelSubscriptionAtPeriodEnd(subscriptionId: string): Promise<Stripe.Subscription> {
  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
}

// Verify webhook signature
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  );
}
