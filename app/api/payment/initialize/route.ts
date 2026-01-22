import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { createCheckoutSession, PlanType } from '@/lib/stripe';
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
    const userId = session.user.id;
    const email = session.user.email;
    const baseUrl = process.env.NEXTAUTH_URL;

    // Create Stripe Checkout Session
    const checkoutSession = await createCheckoutSession({
      email,
      userId,
      plan: plan as PlanType,
      successUrl: `${baseUrl}/payment/callback?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}/?canceled=true`,
    });

    console.log('Stripe checkout session created:', {
      sessionId: checkoutSession.id,
      plan,
      userId,
    });

    // Return the checkout URL (compatible with existing frontend)
    return NextResponse.json({
      success: true,
      authorization_url: checkoutSession.url,
      session_id: checkoutSession.id,
    });
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeErrorForClient(error) },
      { status: 500 }
    );
  }
}
