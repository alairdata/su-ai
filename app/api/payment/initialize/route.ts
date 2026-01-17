import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { stripe, PLAN_PRICES, PlanType } from '@/lib/stripe';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { plan } = await request.json();

    if (!plan || !['Pro', 'Enterprise'].includes(plan)) {
      return NextResponse.json(
        { error: 'Invalid plan' },
        { status: 400 }
      );
    }

    const planDetails = PLAN_PRICES[plan as PlanType];
    const userId = session.user.id;

    // Create Stripe Checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: session.user.email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: planDetails.name,
              description: `Upgrade to ${plan} plan for UnFiltered-AI`,
            },
            unit_amount: planDetails.amount,
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: userId,
        plan: plan,
      },
      success_url: `${process.env.NEXTAUTH_URL}/payment/callback?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXTAUTH_URL}/?canceled=true`,
    });

    return NextResponse.json({
      checkoutUrl: checkoutSession.url,
      sessionId: checkoutSession.id,
    });
  } catch (error) {
    console.error('Payment initialization error:', error);
    return NextResponse.json(
      { error: 'Failed to initialize payment' },
      { status: 500 }
    );
  }
}
