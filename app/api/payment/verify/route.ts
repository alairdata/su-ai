import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { verifyPaystackTransaction } from '@/lib/paystack';
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
        { error: 'Missing payment reference' },
        { status: 400 }
      );
    }

    // Verify transaction with Paystack
    const response = await verifyPaystackTransaction(reference);

    if (!response.status || response.data?.status !== 'success') {
      return NextResponse.json(
        { error: 'Payment verification failed' },
        { status: 400 }
      );
    }

    const { metadata } = response.data;
    const plan = metadata.plan;
    const userId = (session.user as any).id;

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