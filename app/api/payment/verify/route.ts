import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { createClient } from '@supabase/supabase-js';
import { verifyTransaction, getNextBillingDate, PLAN_CONFIG } from '@/lib/paystack';
import { sendSubscriptionEmail } from '@/lib/email';

// SECURITY: Valid plans that can be purchased
const VALID_PAID_PLANS = ['Pro', 'Plus'] as const;
type PaidPlanType = typeof VALID_PAID_PLANS[number];

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
    const paystackResponse = await verifyTransaction(reference);

    console.log('Paystack verification response:', {
      reference,
      status: paystackResponse.data.status,
      amount: paystackResponse.data.amount,
    });

    // Check payment status
    if (paystackResponse.data.status === 'success') {
      const metadata = paystackResponse.data.metadata as { userId?: string; plan?: string };
      const plan = metadata?.plan;
      const userId = metadata?.userId;
      const authorization = paystackResponse.data.authorization;
      const customer = paystackResponse.data.customer;
      const amountPaid = paystackResponse.data.amount; // Amount in pesewas

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

      // SECURITY: Validate plan is a valid paid plan
      if (!VALID_PAID_PLANS.includes(plan as PaidPlanType)) {
        console.error('SECURITY: Invalid plan in payment metadata:', plan);
        return NextResponse.json(
          { error: 'Invalid plan type' },
          { status: 400 }
        );
      }

      // SECURITY: Verify amount paid matches expected plan price (with 10% tolerance for exchange rate fluctuation)
      const expectedPlanConfig = PLAN_CONFIG[plan as PaidPlanType];
      if (expectedPlanConfig) {
        // Amount is in pesewas, we need to verify it's reasonable
        // Minimum expected: priceUSD * 10 (assuming ~10 GHS/USD minimum) * 100 (pesewas)
        const minExpectedPesewas = expectedPlanConfig.priceUSD * 10 * 100 * 0.9; // 10% tolerance
        if (amountPaid < minExpectedPesewas) {
          console.error('SECURITY: Amount paid too low:', {
            amountPaid,
            minExpected: minExpectedPesewas,
            plan,
            userId
          });
          return NextResponse.json(
            { error: 'Payment amount mismatch' },
            { status: 400 }
          );
        }
      }

      // Check if authorization is reusable (for recurring billing)
      if (!authorization?.reusable) {
        console.warn('Authorization is not reusable for user:', userId);
      }

      // Calculate next billing date (30 days from now)
      const currentPeriodEnd = getNextBillingDate();

      // Update user's plan and save authorization for recurring billing
      const { error: updateError } = await supabase
        .from('users')
        .update({
          plan: plan,
          subscription_status: 'active',
          current_period_end: currentPeriodEnd.toISOString(),
          // Paystack-specific fields
          paystack_customer_code: customer?.customer_code || null,
          paystack_authorization: authorization?.authorization_code || null,
          paystack_card_last4: authorization?.last4 || null,
          paystack_card_brand: authorization?.card_type || null,
          // Clear any Stripe fields if migrating
          stripe_customer_id: null,
          stripe_subscription_id: null,
        })
        .eq('id', userId);

      if (updateError) {
        console.error('Failed to update user plan:', updateError);
        return NextResponse.json(
          { error: 'Failed to update plan' },
          { status: 500 }
        );
      }

      // Send subscription welcome email
      try {
        const { data: userData } = await supabase
          .from('users')
          .select('name, email')
          .eq('id', userId)
          .single();

        if (userData?.email) {
          await sendSubscriptionEmail(
            userData.email,
            userData.name || 'there',
            plan,
            'subscribed'
          );
        }
      } catch (emailError) {
        console.error('Failed to send subscription email:', emailError);
      }

      console.log('User subscription updated:', {
        userId,
        plan,
        currentPeriodEnd: currentPeriodEnd.toISOString(),
        hasAuthorization: !!authorization?.authorization_code,
      });

      return NextResponse.json({
        success: true,
        plan: plan,
        message: 'Payment verified and plan updated!',
      });
    } else if (paystackResponse.data.status === 'abandoned') {
      return NextResponse.json({
        success: false,
        status: 'abandoned',
        message: 'Payment was abandoned',
      });
    } else {
      return NextResponse.json({
        success: false,
        status: paystackResponse.data.status,
        message: `Payment status: ${paystackResponse.data.status}`,
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
