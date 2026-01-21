import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { createClient } from '@supabase/supabase-js';
import { cancelSubscriptionAtPeriodEnd } from '@/lib/stripe';

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
      .select('stripe_subscription_id, current_period_end')
      .eq('id', session.user.id)
      .single();

    if (fetchError || !user?.stripe_subscription_id) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 400 }
      );
    }

    // Cancel the subscription at period end via Stripe
    const subscription = await cancelSubscriptionAtPeriodEnd(user.stripe_subscription_id);

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

    // Get period end from subscription item
    const subscriptionItem = subscription.items?.data?.[0];
    const periodEnd = subscriptionItem?.current_period_end
      ? new Date(subscriptionItem.current_period_end * 1000).toISOString()
      : user.current_period_end;

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
