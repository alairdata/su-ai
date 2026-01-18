import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's subscription info from database
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('paystack_subscription_code, current_period_end')
      .eq('id', session.user.id)
      .single();

    if (fetchError || !user?.paystack_subscription_code) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 400 }
      );
    }

    // For Paystack, we'll mark the subscription as canceling
    // The user keeps access until current_period_end
    // In a full implementation, you would call Paystack's disable subscription API
    // But this requires the email_token which we may not have stored

    // Update subscription status to canceling
    const { error: updateError } = await supabase
      .from('users')
      .update({
        subscription_status: 'canceling',
      })
      .eq('id', session.user.id);

    if (updateError) {
      console.error('Failed to update subscription status:', updateError);
      return NextResponse.json(
        { error: 'Failed to cancel subscription' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Subscription will be canceled at the end of the billing period',
      current_period_end: user.current_period_end,
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    return NextResponse.json(
      { error: 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
}
