import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { submitChargeOTP, verifyTransaction } from '@/lib/paystack';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { reference, otp } = await request.json();

    if (!reference || !otp) {
      return NextResponse.json({ error: 'Missing reference or OTP' }, { status: 400 });
    }

    // Submit OTP to Paystack
    const response = await submitChargeOTP({ reference, otp });

    if (response.data.status === 'success') {
      // Verify the transaction to get full details
      const verification = await verifyTransaction(reference);
      const { metadata, authorization, customer } = verification.data;

      const plan = metadata?.plan as string;
      const userId = metadata?.userId as string;

      // Verify user matches
      if (userId !== session.user.id) {
        return NextResponse.json({ error: 'User mismatch' }, { status: 403 });
      }

      // Calculate subscription period end
      const currentPeriodEnd = new Date();
      currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 30);

      // Update user - save authorization for recurring billing
      const { error } = await supabase
        .from('users')
        .update({
          plan,
          paystack_customer_code: customer?.customer_code,
          paystack_subscription_code: reference,
          paystack_authorization_code: authorization?.authorization_code,
          subscription_status: 'active',
          current_period_end: currentPeriodEnd.toISOString(),
        })
        .eq('id', userId);

      if (error) {
        console.error('Failed to update user after OTP:', error);
        return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        status: 'success',
        message: 'Payment successful!',
        plan,
      });
    } else {
      return NextResponse.json({
        success: false,
        status: response.data.status,
        message: 'OTP verification failed. Please try again.',
      });
    }
  } catch (error) {
    console.error('OTP submission error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'OTP verification failed' },
      { status: 500 }
    );
  }
}
