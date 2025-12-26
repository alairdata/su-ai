// Paystack API helper (direct REST API - no package needed!)
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!;

export const PLAN_PRICES = {
  Pro: 19 * 100, // $19 = 1900 cents
  Enterprise: 99 * 100, // $99 = 9900 cents
};

export async function initializePaystackTransaction(
  email: string,
  amount: number,
  metadata: any,
  callbackUrl: string
) {
  const response = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      amount,
      currency: 'GHS',
      metadata,
      callback_url: callbackUrl,
    }),
  });

  return await response.json();
}

export async function verifyPaystackTransaction(reference: string) {
  const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
    },
  });

  return await response.json();
}