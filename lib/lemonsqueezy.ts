import { createHmac } from 'crypto';

const LEMONSQUEEZY_API_KEY = process.env.LEMONSQUEEZY_API_KEY!;
const BASE_URL = 'https://api.lemonsqueezy.com/v1';

export const PLAN_VARIANTS: Record<string, string> = {
  Pro: process.env.LEMONSQUEEZY_PRO_VARIANT_ID!,
  Plus: process.env.LEMONSQUEEZY_PLUS_VARIANT_ID!,
};

export const PLAN_CONFIG = {
  Pro: { priceUSD: 4.99, name: 'Pro' },
  Plus: { priceUSD: 9.99, name: 'Plus' },
};

async function lsRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${LEMONSQUEEZY_API_KEY}`,
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data.errors?.[0]?.detail || data.message || 'Lemon Squeezy API error';
    throw new Error(msg);
  }
  return data as T;
}

export async function createCheckout(params: {
  plan: string;
  email: string;
  userId: string;
  successUrl: string;
}): Promise<string> {
  const variantId = PLAN_VARIANTS[params.plan];
  if (!variantId) throw new Error(`No variant ID configured for plan: ${params.plan}`);

  const storeId = process.env.LEMONSQUEEZY_STORE_ID!;

  const body = {
    data: {
      type: 'checkouts',
      attributes: {
        checkout_data: {
          email: params.email,
          custom: {
            user_id: params.userId,
            plan: params.plan,
          },
        },
        product_options: {
          redirect_url: params.successUrl,
        },
      },
      relationships: {
        store: { data: { type: 'stores', id: storeId } },
        variant: { data: { type: 'variants', id: variantId } },
      },
    },
  };

  const res = await lsRequest<{ data: { attributes: { url: string } } }>('/checkouts', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  return res.data.attributes.url;
}

export async function cancelSubscription(subscriptionId: string): Promise<void> {
  await lsRequest(`/subscriptions/${subscriptionId}`, { method: 'DELETE' });
}

export async function updateSubscriptionVariant(subscriptionId: string, variantId: string): Promise<void> {
  const body = {
    data: {
      type: 'subscriptions',
      id: subscriptionId,
      attributes: { variant_id: parseInt(variantId) },
    },
  };
  await lsRequest(`/subscriptions/${subscriptionId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function getCustomerPortalUrl(subscriptionId: string): Promise<string | null> {
  try {
    const res = await lsRequest<{
      data: { attributes: { urls: { customer_portal: string } } };
    }>(`/subscriptions/${subscriptionId}`);
    return res.data.attributes.urls.customer_portal ?? null;
  } catch {
    return null;
  }
}

export function verifyWebhookSignature(payload: string, signature: string): boolean {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET!;
  const hmac = createHmac('sha256', secret).update(payload).digest('hex');
  return hmac === signature;
}

export function getNextBillingDate(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date;
}
