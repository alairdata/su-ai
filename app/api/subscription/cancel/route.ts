import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { createClient } from '@supabase/supabase-js';
import { sendSubscriptionEmail } from '@/lib/email';

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
      .select('plan, current_period_end, paystack_authorization')
      .eq('id', session.user.id)
      .single();

    if (fetchError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 400 }
      );
    }

    if (user.plan === 'Free') {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 400 }
      );
    }

    // Simply mark the subscription as canceling
    // The cron job will handle the actual cancellation at period end
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

    const periodEnd = user.current_period_end;

    // Send cancellation email
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('name, email, plan')
        .eq('id', session.user.id)
        .single();

      if (userData?.email) {
        await sendSubscriptionEmail(
          userData.email,
          userData.name || 'there',
          userData.plan || 'subscription',
          'cancelled',
          periodEnd || undefined
        );
      }
    } catch (emailError) {
      console.error('Failed to send cancellation email:', emailError);
    }

    console.log('Subscription cancelled for user:', session.user.id);

    return NextResponse.json({
      success: true,
      message: 'Subscription will be canceled at the end of the billing period',
      current_period_end: periodEnd,
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    return NextResponse.json(
      { error: 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
}
