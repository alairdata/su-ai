const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!;
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

// Subscription plans configuration
export const PLAN_CONFIG = {
  Pro: {
    priceUSD: 4.99, // Display price in USD
    name: 'Pro Plan',
    description: '150 messages per day with priority support',
    features: [
      '150 messages per day',
      'Priority support',
      'Advanced AI responses',
      'Cancel anytime',
    ],
  },
  Plus: {
    priceUSD: 9.99, // Display price in USD
    name: 'Plus Plan',
    description: '400 messages per day with 24/7 support',
    features: [
      '400 messages per day',
      '24/7 priority support',
      'Advanced AI responses',
      'Early access to new features',
      'Cancel anytime',
    ],
  },
};

export type PlanType = keyof typeof PLAN_CONFIG;

// Cache exchange rate for 1 hour to avoid excessive API calls
let cachedRate: { rate: number; timestamp: number } | null = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

// Fetch USD to GHS exchange rate from exchangerate-api.com
async function getExchangeRate(): Promise<number> {
  // Return cached rate if still valid
  if (cachedRate && Date.now() - cachedRate.timestamp < CACHE_DURATION) {
    return cachedRate.rate;
  }

  const apiKey = process.env.EXCHANGE_RATE_API_KEY;

  if (!apiKey) {
    console.warn('EXCHANGE_RATE_API_KEY not set, using fallback rate');
    return 15; // Fallback rate
  }

  try {
    const response = await fetch(
      `https://v6.exchangerate-api.com/v6/${apiKey}/pair/USD/GHS`
    );

    if (!response.ok) {
      throw new Error(`Exchange rate API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.result === 'success' && data.conversion_rate) {
      // Cache the rate
      cachedRate = {
        rate: data.conversion_rate,
        timestamp: Date.now(),
      };
      return data.conversion_rate;
    }

    throw new Error('Invalid response from exchange rate API');
  } catch (error) {
    console.error('Failed to fetch exchange rate:', error);
    // Return cached rate if available, otherwise fallback
    return cachedRate?.rate || 15;
  }
}

// Convert USD to GHS pesewas (smallest unit)
export async function convertUSDToGHS(amountUSD: number): Promise<number> {
  const exchangeRate = await getExchangeRate();
  const amountGHS = amountUSD * exchangeRate;
  // Convert to pesewas (multiply by 100)
  return Math.round(amountGHS * 100);
}

// Helper to make authenticated Paystack API requests
export async function paystackRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${PAYSTACK_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Paystack API error');
  }

  return data;
}

// Charge a card directly (for custom checkout)
export async function chargeCard(params: {
  email: string;
  amount: number; // Amount in pesewas (GHS)
  card: {
    number: string;
    cvv: string;
    expiry_month: string;
    expiry_year: string;
  };
  reference: string;
  metadata?: Record<string, unknown>;
}) {
  return paystackRequest<{
    status: boolean;
    message: string;
    data: {
      reference: string;
      status: string;
      display_text: string;
      authorization: {
        authorization_code: string;
        card_type: string;
        last4: string;
        exp_month: string;
        exp_year: string;
        bin: string;
        bank: string;
        reusable: boolean;
      };
      customer: {
        id: number;
        customer_code: string;
        email: string;
      };
    };
  }>('/charge', {
    method: 'POST',
    body: JSON.stringify({
      email: params.email,
      amount: params.amount,
      card: params.card,
      reference: params.reference,
      currency: 'GHS',
      metadata: params.metadata,
    }),
  });
}

// Submit OTP/PIN for charge that requires it
export async function submitChargeOTP(params: {
  reference: string;
  otp: string;
}) {
  return paystackRequest<{
    status: boolean;
    message: string;
    data: {
      reference: string;
      status: string;
      authorization: {
        authorization_code: string;
        card_type: string;
        last4: string;
        reusable: boolean;
      };
      customer: {
        customer_code: string;
        email: string;
      };
    };
  }>('/charge/submit_otp', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// Submit PIN for charge that requires it
export async function submitChargePIN(params: {
  reference: string;
  pin: string;
}) {
  return paystackRequest<{
    status: boolean;
    message: string;
    data: {
      reference: string;
      status: string;
    };
  }>('/charge/submit_pin', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// Charge mobile money
export async function chargeMobileMoney(params: {
  email: string;
  amount: number; // Amount in pesewas (GHS)
  mobile_money: {
    phone: string;
    provider: 'mtn' | 'vod' | 'tgo'; // MTN, Vodafone, AirtelTigo
  };
  reference: string;
  metadata?: Record<string, unknown>;
}) {
  return paystackRequest<{
    status: boolean;
    message: string;
    data: {
      reference: string;
      status: string;
      display_text: string;
    };
  }>('/charge', {
    method: 'POST',
    body: JSON.stringify({
      email: params.email,
      amount: params.amount,
      mobile_money: params.mobile_money,
      reference: params.reference,
      currency: 'GHS',
      metadata: params.metadata,
    }),
  });
}

// Charge using saved authorization (for recurring billing)
export async function chargeAuthorization(params: {
  email: string;
  amount: number; // Amount in pesewas (GHS)
  authorization_code: string;
  reference: string;
  metadata?: Record<string, unknown>;
}) {
  return paystackRequest<{
    status: boolean;
    message: string;
    data: {
      reference: string;
      status: string;
      authorization: {
        authorization_code: string;
        card_type: string;
        last4: string;
        reusable: boolean;
      };
      customer: {
        customer_code: string;
        email: string;
      };
    };
  }>('/transaction/charge_authorization', {
    method: 'POST',
    body: JSON.stringify({
      email: params.email,
      amount: params.amount,
      authorization_code: params.authorization_code,
      reference: params.reference,
      currency: 'GHS',
      metadata: params.metadata,
    }),
  });
}

// Verify a transaction/charge
export async function verifyTransaction(reference: string) {
  return paystackRequest<{
    status: boolean;
    message: string;
    data: {
      id: number;
      status: string;
      reference: string;
      amount: number;
      currency: string;
      customer: {
        id: number;
        customer_code: string;
        email: string;
      };
      metadata: Record<string, unknown>;
      paid_at: string;
      channel: string;
      authorization: {
        authorization_code: string;
        card_type: string;
        last4: string;
        exp_month: string;
        exp_year: string;
        reusable: boolean;
      };
    };
  }>(`/transaction/verify/${reference}`);
}

// Get or create a Paystack customer
export async function getOrCreateCustomer(
  email: string,
  userId: string
): Promise<string> {
  // Try to fetch existing customer
  try {
    const response = await paystackRequest<{
      status: boolean;
      data: { customer_code: string };
    }>(`/customer/${encodeURIComponent(email)}`);

    if (response.status && response.data?.customer_code) {
      return response.data.customer_code;
    }
  } catch {
    // Customer doesn't exist, create one
  }

  // Create new customer
  const createResponse = await paystackRequest<{
    status: boolean;
    data: { customer_code: string };
  }>('/customer', {
    method: 'POST',
    body: JSON.stringify({
      email,
      metadata: { userId },
    }),
  });

  return createResponse.data.customer_code;
}

// Verify webhook signature
export function verifyWebhookSignature(
  payload: string,
  signature: string
): boolean {
  const crypto = require('crypto');
  const hash = crypto
    .createHmac('sha512', PAYSTACK_SECRET_KEY)
    .update(payload)
    .digest('hex');
  return hash === signature;
}
