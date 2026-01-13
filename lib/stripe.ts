import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Prices in cents (USD)
export const PLAN_PRICES = {
  Pro: {
    amount: 1900, // $19.00
    name: 'Pro Plan',
  },
  Enterprise: {
    amount: 9900, // $99.00
    name: 'Enterprise Plan',
  },
};

export type PlanType = keyof typeof PLAN_PRICES;
