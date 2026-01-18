import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { verifyTransaction } from '@/lib/paystack';
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

    const { reference } = await request.json();

    if (!reference) {
      return NextResponse.json(
        { error: 'Missing reference' },
        { status: 400 }
      );
    }

    // Verify the transaction with Paystack
    const verification = await verifyTransaction(reference);

    if (!verification.status || verification.data.status !== 'success') {
      return NextResponse.json(
        { error: 'Payment not completed' },
        { status: 400 }
      );
    }

    const { metadata, customer } = verification.data;
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
        { error: 'Plan not found in transaction' },
        { status: 400 }
      );
    }

    // Calculate subscription period end (30 days from now for monthly)
    const currentPeriodEnd = new Date();
    currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 30);

    // Update user's plan and subscription info in database
    const { error: updateError } = await supabase
      .from('users')
      .update({
        plan: plan,
        paystack_customer_code: customer.customer_code,
        paystack_subscription_code: reference, // Using reference as subscription identifier
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
  } catch (error) {
    console.error('Payment verification error:', error);
    return NextResponse.json(
      { error: 'Payment verification failed' },
      { status: 500 }
    );
  }
}
