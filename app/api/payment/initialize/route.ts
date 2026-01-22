import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { createCheckoutSession, PLAN_CONFIG, PlanType } from '@/lib/stripe';
import { rateLimit, getClientIP, rateLimitHeaders, RATE_LIMITS, getUserIPKey } from '@/lib/rate-limit';

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

    const { plan } = await request.json();

    // Validate plan
    if (!plan || !['Pro', 'Plus'].includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

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
    console.error('Payment initialization error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to initialize payment', details: errorMessage },
      { status: 500 }
    );
  }
}
