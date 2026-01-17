import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Subscription plans configuration
export const PLAN_CONFIG = {
  Pro: {
    amount: 499, // $4.99 per month
    name: 'Pro Plan',
    description: '150 messages per day with priority support',
    interval: 'month' as const,
  },
  Plus: {
    amount: 999, // $9.99 per month
    name: 'Plus Plan',
    description: '400 messages per day with 24/7 support',
    interval: 'month' as const,
  },
};

export type PlanType = keyof typeof PLAN_CONFIG;

// Helper to get or create a Stripe customer
export async function getOrCreateCustomer(email: string, userId: string): Promise<string> {
  // Search for existing customer
  const customers = await stripe.customers.list({ email, limit: 1 });

  if (customers.data.length > 0) {
    return customers.data[0].id;
  }

  // Create new customer
  const customer = await stripe.customers.create({
    email,
    metadata: { userId },
  });

  return customer.id;
}
