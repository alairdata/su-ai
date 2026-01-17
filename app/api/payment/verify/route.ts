import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { stripe } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';

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

    // Retrieve the Stripe Checkout session
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);

    // Verify payment was successful
    if (checkoutSession.payment_status !== 'paid') {
      return NextResponse.json(
        { error: 'Payment not completed' },
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

    // Update user's plan in database
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
