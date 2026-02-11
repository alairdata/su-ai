// Paystack API Helper Functions

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!;
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

// Plan configuration (prices in USD for display, converted to GHS for charging)
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
  },
  Pro: {
    priceUSD: 4.99,
    messagesPerDay: 100,
    name: 'Pro Plan',
    description: '100 messages per day - 10x more than Free',
    features: [
      '100 messages per day',
      '10x more than Free',
      'Expanded memory and context',
      'Early access to new features',
      'Advanced reasoning models',
      'Memory across conversations',
    ],
  },
  Plus: {
    priceUSD: 9.99,
    messagesPerDay: 300,
    name: 'Plus Plan',
    description: '300 messages per day - Everything in Pro and more',
    features: [
      'Everything in Pro',
      '300 messages per day',
      '30x more than Free, 3x more than Pro',
      'Higher outputs for more tasks',
      'Priority access at high traffic times',
      'Early access to advanced features',
    ],
  },
};

export type PlanType = 'Free' | 'Pro' | 'Plus';
export type PaidPlanType = 'Pro' | 'Plus';

// Cache for exchange rate (refresh every hour)
// SECURITY: Store last known good rate to avoid hardcoded fallback issues
let cachedRate: { rate: number; timestamp: number } | null = null;
let lastKnownGoodRate: number | null = null; // Persists longer than cache
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour
const STALE_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours for stale fallback

// SECURITY: Exchange rate bounds to prevent currency manipulation attacks
// These should be updated if GHS/USD rate changes significantly (currently ~15 GHS/USD)
const MIN_EXCHANGE_RATE = 8; // Minimum reasonable rate
const MAX_EXCHANGE_RATE = 30; // Maximum reasonable rate

function validateExchangeRate(rate: number): boolean {
  if (typeof rate !== 'number' || isNaN(rate)) {
    console.error('SECURITY: Invalid exchange rate type:', rate);
    return false;
  }
  if (rate < MIN_EXCHANGE_RATE || rate > MAX_EXCHANGE_RATE) {
    console.error('SECURITY: Exchange rate out of bounds:', rate, `(expected ${MIN_EXCHANGE_RATE}-${MAX_EXCHANGE_RATE})`);
    return false;
  }
  return true;
}

// Get current USD to GHS exchange rate (live)
export async function getExchangeRate(): Promise<number> {
  // Return cached rate if still valid
  if (cachedRate && Date.now() - cachedRate.timestamp < CACHE_DURATION) {
    return cachedRate.rate;
  }

  const apiKey = process.env.EXCHANGE_RATE_API_KEY;
  const envFallbackRate = process.env.USD_TO_GHS_RATE ? parseFloat(process.env.USD_TO_GHS_RATE) : null;

  if (!apiKey) {
    // No API key - use env fallback or last known good rate
    if (envFallbackRate) {
      console.warn('No EXCHANGE_RATE_API_KEY, using USD_TO_GHS_RATE from env:', envFallbackRate);
      return envFallbackRate;
    }
    if (lastKnownGoodRate) {
      console.warn('No EXCHANGE_RATE_API_KEY, using last known good rate:', lastKnownGoodRate);
      return lastKnownGoodRate;
    }
    // SECURITY: Fail payment instead of using potentially wrong hardcoded rate
    console.error('CRITICAL: No exchange rate available - payment will fail');
    throw new Error('Exchange rate unavailable. Please try again later.');
  }

  try {
    const response = await fetch(
      `https://v6.exchangerate-api.com/v6/${apiKey}/pair/USD/GHS`
    );
    const data = await response.json();

    if (data.result === 'success' && data.conversion_rate) {
      // SECURITY: Validate rate is within reasonable bounds
      if (!validateExchangeRate(data.conversion_rate)) {
        console.error('SECURITY: Exchange rate failed validation, rejecting:', data.conversion_rate);
        throw new Error('Exchange rate validation failed. Please try again later.');
      }
      cachedRate = { rate: data.conversion_rate, timestamp: Date.now() };
      lastKnownGoodRate = data.conversion_rate; // Store as fallback
      console.log('Exchange rate fetched:', data.conversion_rate);
      return data.conversion_rate;
    }

    // API returned error - try fallbacks
    console.warn('Exchange rate API error:', data);
    if (cachedRate && Date.now() - cachedRate.timestamp < STALE_CACHE_DURATION) {
      console.warn('Using stale cached rate:', cachedRate.rate);
      return cachedRate.rate;
    }
    if (lastKnownGoodRate) {
      console.warn('Using last known good rate:', lastKnownGoodRate);
      return lastKnownGoodRate;
    }
    if (envFallbackRate) {
      console.warn('Using env fallback rate:', envFallbackRate);
      return envFallbackRate;
    }

    throw new Error('Exchange rate unavailable. Please try again later.');
  } catch (error) {
    console.error('Failed to fetch exchange rate:', error);

    // Try fallbacks before failing
    if (cachedRate && Date.now() - cachedRate.timestamp < STALE_CACHE_DURATION) {
      console.warn('API failed, using stale cached rate:', cachedRate.rate);
      return cachedRate.rate;
    }
    if (lastKnownGoodRate) {
      console.warn('API failed, using last known good rate:', lastKnownGoodRate);
      return lastKnownGoodRate;
    }
    if (envFallbackRate) {
      console.warn('API failed, using env fallback rate:', envFallbackRate);
      return envFallbackRate;
    }

    throw new Error('Exchange rate unavailable. Please try again later.');
  }
}

// Synchronous version for places where we can't await
export function getExchangeRateSync(): number {
  if (cachedRate && Date.now() - cachedRate.timestamp < CACHE_DURATION) {
    return cachedRate.rate;
  }
  if (lastKnownGoodRate) {
    return lastKnownGoodRate;
  }
  const envRate = process.env.USD_TO_GHS_RATE;
  if (envRate) {
    return parseFloat(envRate);
  }
  throw new Error('Exchange rate unavailable');
}

// Convert USD to GHS (in pesewas - smallest unit)
export async function usdToGhsPesewas(usdAmount: number): Promise<number> {
  const rate = await getExchangeRate();
  const ghsAmount = usdAmount * rate;
  // Convert to pesewas (multiply by 100) and round
  return Math.round(ghsAmount * 100);
}

// Convert USD to GHS (in cedis)
export async function usdToGhs(usdAmount: number): Promise<number> {
  const rate = await getExchangeRate();
  return Math.round(usdAmount * rate * 100) / 100;
}

// Helper to get message limit for a plan
export function getMessageLimit(plan: PlanType): number {
  return PLAN_CONFIG[plan].messagesPerDay;
}

// Paystack API request helper
async function paystackRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${PAYSTACK_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
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

// Initialize a transaction
export async function initializeTransaction(params: {
  email: string;
  amount: number; // Amount in pesewas (GHS smallest unit)
  reference?: string;
  callback_url?: string;
  metadata?: Record<string, unknown>;
  channels?: string[];
}): Promise<{
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}> {
  return paystackRequest('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      ...params,
      currency: 'GHS',
      channels: params.channels || ['card'], // Only card for subscriptions
    }),
  });
}

// Verify a transaction
export async function verifyTransaction(reference: string): Promise<{
  status: boolean;
  message: string;
  data: {
    id: number;
    status: 'success' | 'failed' | 'abandoned';
    reference: string;
    amount: number;
    currency: string;
    customer: {
      id: number;
      email: string;
      customer_code: string;
    };
    authorization: {
      authorization_code: string;
      card_type: string;
      last4: string;
      exp_month: string;
      exp_year: string;
      bin: string;
      bank: string;
      channel: string;
      signature: string;
      reusable: boolean;
      country_code: string;
    };
    metadata: Record<string, unknown>;
  };
}> {
  return paystackRequest(`/transaction/verify/${reference}`);
}

// Charge an authorization (for recurring payments)
export async function chargeAuthorization(params: {
  email: string;
  amount: number; // Amount in pesewas
  authorization_code: string;
  reference?: string;
  metadata?: Record<string, unknown>;
}): Promise<{
  status: boolean;
  message: string;
  data: {
    id: number;
    status: 'success' | 'failed';
    reference: string;
    amount: number;
    currency: string;
  };
}> {
  return paystackRequest('/transaction/charge_authorization', {
    method: 'POST',
    body: JSON.stringify({
      ...params,
      currency: 'GHS',
    }),
  });
}

// Create a customer
export async function createCustomer(params: {
  email: string;
  first_name?: string;
  last_name?: string;
  metadata?: Record<string, unknown>;
}): Promise<{
  status: boolean;
  message: string;
  data: {
    id: number;
    customer_code: string;
    email: string;
  };
}> {
  return paystackRequest('/customer', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// Verify webhook signature (Paystack uses your secret key for this)
export function verifyWebhookSignature(
  payload: string,
  signature: string
): boolean {
  const crypto = require('crypto');
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
    .update(payload)
    .digest('hex');
  return hash === signature;
}

// Generate a unique reference
export function generateReference(prefix: string = 'sub'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${random}`;
}

// Calculate next billing date (30 days from now)
export function getNextBillingDate(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date;
}
