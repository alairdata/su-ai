import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/mobile-auth';
import { createClient } from '@supabase/supabase-js';
import { initializeTransaction, PLAN_CONFIG as PAYSTACK_PLAN_CONFIG, usdToGhsPesewas, generateReference } from '@/lib/paystack';
import { createCheckout } from '@/lib/lemonsqueezy';
import { rateLimit, getClientIP, rateLimitHeaders, RATE_LIMITS, getUserIPKey } from '@/lib/rate-limit';
import { initializePaymentSchema, validateInput } from '@/lib/validations';
import { sanitizeErrorForClient } from '@/lib/env';
import { logPaymentEvent } from '@/lib/payment-events';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PAYMENT_PROVIDER = process.env.PAYMENT_PROVIDER || 'paystack'; // 'paystack' | 'lemonsqueezy'

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limiting - 10 payment attempts per 5 minutes
    const clientIP = getClientIP(request);
    const rateLimitKey = getUserIPKey(session.user.id, clientIP, 'payment');
    const rateLimitResult = rateLimit(rateLimitKey, RATE_LIMITS.payment);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many payment attempts. Please try again later.' },
        { status: 429, headers: rateLimitHeaders(rateLimitResult) }
      );
    }

    const body = await request.json();
    const validation = validateInput(initializePaymentSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { plan, billing } = validation.data;
    const userId = session.user.id;
    const email = session.user.email;

    // Verify user exists and check current plan
    const { data: dbUser, error: userError } = await supabase
      .from('users')
      .select('plan, subscription_status')
      .eq('id', userId)
      .single();

    if (userError || !dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const planTiers: Record<string, number> = { Free: 0, Pro: 1, Plus: 2 };
    const currentTier = planTiers[dbUser.plan] || 0;
    const requestedTier = planTiers[plan] || 0;

    if (requestedTier <= currentTier && dbUser.subscription_status === 'active') {
      return NextResponse.json(
        { error: `You already have ${dbUser.plan} plan or higher.` },
        { status: 400 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.so-unfiltered-ai.com';

    // ── Lemon Squeezy ──────────────────────────────────────────────
    if (PAYMENT_PROVIDER === 'lemonsqueezy') {
      await logPaymentEvent({
        user_id: userId,
        event_type: 'checkout_started',
        plan,
        provider: 'lemonsqueezy',
        status: 'initiated',
      });
      const checkoutUrl = await createCheckout({
        plan,
        email,
        userId,
        billing: billing as 'monthly' | 'yearly',
        successUrl: `${baseUrl}/payment/callback?provider=lemonsqueezy`,
      });

      return NextResponse.json({ success: true, authorization_url: checkoutUrl });
    }

    // ── Paystack (default) ─────────────────────────────────────────
    const planConfig = PAYSTACK_PLAN_CONFIG[plan as keyof typeof PAYSTACK_PLAN_CONFIG];
    if (!planConfig) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    const amountInPesewas = await usdToGhsPesewas(planConfig.priceUSD);
    const reference = generateReference(`${plan.toLowerCase()}_${userId.slice(0, 8)}`);

    const paystackResponse = await initializeTransaction({
      email,
      amount: amountInPesewas,
      reference,
      callback_url: `${baseUrl}/payment/callback`,
      channels: ['card', 'mobile_money'],
      metadata: { userId, plan, priceUSD: planConfig.priceUSD },
    });

    return NextResponse.json({
      success: true,
      reference: paystackResponse.data.reference,
      authorization_url: paystackResponse.data.authorization_url,
      amount: amountInPesewas,
    });
  } catch (error) {
    console.error('Payment initialization error:', error);
    return NextResponse.json({ error: sanitizeErrorForClient(error) }, { status: 500 });
  }
}
