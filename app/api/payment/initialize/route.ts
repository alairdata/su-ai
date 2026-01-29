import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import {
  initializeTransaction,
  PLAN_CONFIG,
  usdToGhsPesewas,
  generateReference,
  PlanType
} from '@/lib/paystack';
import { rateLimit, getClientIP, rateLimitHeaders, RATE_LIMITS, getUserIPKey } from '@/lib/rate-limit';
import { initializePaymentSchema, validateInput } from '@/lib/validations';
import { sanitizeErrorForClient } from '@/lib/env';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

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

    // Schema validation
    const validation = validateInput(initializePaymentSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { plan } = validation.data;
    const planConfig = PLAN_CONFIG[plan as PlanType];

    if (!planConfig) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    const userId = session.user.id;
    const email = session.user.email;

    // Convert USD price to GHS pesewas (live rate)
    const amountInPesewas = await usdToGhsPesewas(planConfig.priceUSD);
    const reference = generateReference(`${plan.toLowerCase()}_${userId.slice(0, 8)}`);

    // Get the base URL for callback
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.so-unfiltered-ai.com';

    // Initialize Paystack transaction with both card and mobile money
    const paystackResponse = await initializeTransaction({
      email,
      amount: amountInPesewas,
      reference,
      callback_url: `${baseUrl}/payment/callback`,
      channels: ['card', 'mobile_money'],
      metadata: {
        userId,
        plan,
        priceUSD: planConfig.priceUSD,
      },
    });

    console.log('Paystack transaction initialized:', {
      reference,
      plan,
      userId,
      amountPesewas: amountInPesewas,
    });

    // Return authorization URL for redirect
    return NextResponse.json({
      success: true,
      reference: paystackResponse.data.reference,
      authorization_url: paystackResponse.data.authorization_url,
      amount: amountInPesewas,
    });
  } catch (error) {
    console.error('Payment initialization error:', error);
    return NextResponse.json(
      { error: sanitizeErrorForClient(error) },
      { status: 500 }
    );
  }
}
