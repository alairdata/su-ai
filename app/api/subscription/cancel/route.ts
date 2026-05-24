import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/mobile-auth';
import { createClient } from '@supabase/supabase-js';
import { cancelSubscription } from '@/lib/lemonsqueezy';
import { sendSubscriptionEmail } from '@/lib/email';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PAYMENT_PROVIDER = process.env.PAYMENT_PROVIDER || 'paystack';

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('plan, current_period_end, paystack_authorization, lemonsqueezy_subscription_id')
      .eq('id', session.user.id)
      .single();

    if (fetchError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 400 });
    }

    if (user.plan === 'Free') {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 400 });
    }

    // ── Lemon Squeezy cancellation ──────────────────────────────────
    if (PAYMENT_PROVIDER === 'lemonsqueezy') {
      if (!user.lemonsqueezy_subscription_id) {
        return NextResponse.json({ error: 'No Lemon Squeezy subscription found' }, { status: 400 });
      }
      // LS cancels at period end by default on DELETE
      await cancelSubscription(user.lemonsqueezy_subscription_id);
    }

    // Mark as canceling in DB (works for both providers)
    const { error: updateError } = await supabase
      .from('users')
      .update({ subscription_status: 'canceling' })
      .eq('id', session.user.id);

    if (updateError) {
      console.error('Failed to update subscription status:', updateError);
      return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 });
    }

    const periodEnd = user.current_period_end;

    try {
      const { data: userData } = await supabase
        .from('users').select('name, email, plan').eq('id', session.user.id).single();
      if (userData?.email) {
        await sendSubscriptionEmail(
          userData.email, userData.name || 'there',
          userData.plan || 'subscription', 'cancelled', periodEnd || undefined
        );
      }
    } catch (emailError) {
      console.error('Failed to send cancellation email:', emailError);
    }

    return NextResponse.json({
      success: true,
      message: 'Subscription will be canceled at the end of the billing period',
      current_period_end: periodEnd,
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 });
  }
}
