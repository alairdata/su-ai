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

    if (!planConfig || plan === 'Free') {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    const userId = session.user.id;
    const email = session.user.email;

    // Convert USD price to GHS pesewas (live rate)
    const amountInPesewas = await usdToGhsPesewas(planConfig.priceUSD);
    const reference = generateReference(`${plan.toLowerCase()}_${userId.slice(0, 8)}`);

    // Initialize Paystack transaction
    const paystackResponse = await initializeTransaction({
      email,
      amount: amountInPesewas,
      reference,
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

    // Return data for Paystack popup
    return NextResponse.json({
      success: true,
      reference: paystackResponse.data.reference,
      access_code: paystackResponse.data.access_code,
      authorization_url: paystackResponse.data.authorization_url,
      amount: amountInPesewas,
      public_key: process.env.PAYSTACK_PUBLIC_KEY,
    });
  } catch (error) {
    console.error('Payment initialization error:', error);
    return NextResponse.json(
      { error: sanitizeErrorForClient(error) },
      { status: 500 }
    );
  }
}
