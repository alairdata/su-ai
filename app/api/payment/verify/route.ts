import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { createClient } from '@supabase/supabase-js';
import { getCheckoutSession } from '@/lib/stripe';
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

    const { session_id } = await request.json();

    if (!session_id) {
      return NextResponse.json(
        { error: 'Missing session_id' },
        { status: 400 }
      );
    }

    // Retrieve the Stripe Checkout Session
    const checkoutSession = await getCheckoutSession(session_id);

    console.log('Stripe session verification:', {
      sessionId: checkoutSession.id,
      paymentStatus: checkoutSession.payment_status,
      status: checkoutSession.status,
    });

    // Check payment status
    if (checkoutSession.payment_status === 'paid' && checkoutSession.status === 'complete') {
      const metadata = checkoutSession.metadata;
      const plan = metadata?.plan as string;
      const userId = metadata?.userId as string;

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

      // Get subscription details
      const subscription = checkoutSession.subscription as Stripe.Subscription;
      const customer = checkoutSession.customer as Stripe.Customer;

      // Calculate subscription period end from Stripe subscription item
      const subscriptionItem = subscription?.items?.data?.[0];
      const currentPeriodEnd = subscriptionItem?.current_period_end
        ? new Date(subscriptionItem.current_period_end * 1000)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Fallback: 30 days from now

      // Update user's plan and subscription info in database
      const { error: updateError } = await supabase
        .from('users')
        .update({
          plan: plan,
          stripe_customer_id: typeof customer === 'string' ? customer : customer?.id,
          stripe_subscription_id: typeof subscription === 'string' ? subscription : subscription?.id,
          subscription_status: 'active',
          current_period_end: currentPeriodEnd.toISOString(),
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
        message: 'Payment verified and plan updated!',
      });
    } else if (checkoutSession.payment_status === 'unpaid' || checkoutSession.status === 'open') {
      return NextResponse.json({
        success: false,
        status: 'pending',
        message: 'Payment still processing',
      });
    } else if (checkoutSession.status === 'expired') {
      return NextResponse.json({
        success: false,
        status: 'failed',
        message: 'Checkout session expired',
      });
    } else {
      return NextResponse.json({
        success: false,
        status: checkoutSession.status || 'unknown',
        message: `Payment status: ${checkoutSession.payment_status}`,
      });
    }
  } catch (error) {
    console.error('Payment verification error:', error);
    return NextResponse.json({
      success: false,
      status: 'error',
      message: 'Verification check failed',
    });
  }
}
