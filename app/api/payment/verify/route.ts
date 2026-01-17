import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { stripe } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing session ID' },
        { status: 400 }
      );
    }

    // Retrieve the Stripe Checkout session with subscription expanded
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });

    // For subscriptions, check if subscription was created
    if (checkoutSession.mode === 'subscription') {
      const subscription = checkoutSession.subscription as Stripe.Subscription;

      if (!subscription || subscription.status !== 'active') {
        return NextResponse.json(
          { error: 'Subscription not active' },
          { status: 400 }
        );
      }

      const plan = checkoutSession.metadata?.plan;
      const userId = checkoutSession.metadata?.userId;

      // Verify the user matches
      if (userId !== session.user.id) {
        return NextResponse.json(
          { error: 'User mismatch' },
          { status: 403 }
        );
      }

      if (!plan) {
        return NextResponse.json(
          { error: 'Plan not found in session' },
          { status: 400 }
        );
      }

      // Update user's plan and subscription info in database
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subscriptionData = subscription as any;
      const { error: updateError } = await supabase
        .from('users')
        .update({
          plan: plan,
          stripe_customer_id: checkoutSession.customer as string,
          stripe_subscription_id: subscription.id,
          subscription_status: subscription.status,
          current_period_end: subscriptionData.current_period_end
            ? new Date(subscriptionData.current_period_end * 1000).toISOString()
            : null,
        })
        .eq('id', userId);

      if (updateError) {
        console.error('Failed to update user plan:', updateError);
        return NextResponse.json(
          { error: 'Failed to update plan' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        plan: plan,
        message: 'Subscription activated successfully!',
      });
    }

    // Fallback for one-time payments (legacy)
    if (checkoutSession.payment_status !== 'paid') {
      return NextResponse.json(
        { error: 'Payment not completed' },
        { status: 400 }
      );
    }

    const plan = checkoutSession.metadata?.plan;
    const userId = checkoutSession.metadata?.userId;

    if (userId !== session.user.id) {
      return NextResponse.json(
        { error: 'User mismatch' },
        { status: 403 }
      );
    }

    if (!plan) {
      return NextResponse.json(
        { error: 'Plan not found in session' },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({ plan: plan })
      .eq('id', userId);

    if (updateError) {
      console.error('Failed to update user plan:', updateError);
      return NextResponse.json(
        { error: 'Failed to update plan' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      plan: plan,
      message: 'Payment verified and plan updated!',
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    return NextResponse.json(
      { error: 'Payment verification failed' },
      { status: 500 }
    );
  }
}
