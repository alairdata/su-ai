import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import {
  chargeCard,
  chargeMobileMoney,
  convertUSDToGHS,
  PLAN_CONFIG,
  PlanType,
} from '@/lib/paystack';
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

    const body = await request.json();
    const { plan, paymentMethod, card, mobileMoney } = body;

    // Validate plan
    if (!plan || !['Pro', 'Plus'].includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    const planDetails = PLAN_CONFIG[plan as PlanType];
    const userId = session.user.id;
    const email = session.user.email;

    // Convert USD to GHS (pesewas)
    const amountInPesewas = await convertUSDToGHS(planDetails.priceUSD);

    // Generate unique reference
    const reference = `sub_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const metadata = {
      userId,
      plan,
      priceUSD: planDetails.priceUSD,
    };

    let chargeResponse;

    if (paymentMethod === 'card') {
      // Validate card data exists (but NEVER log it)
      if (!card?.number || !card?.cvv || !card?.expiry) {
        return NextResponse.json({ error: 'Invalid card details' }, { status: 400 });
      }

      // Parse expiry (MM/YY format)
      const [expMonth, expYear] = card.expiry.split('/');

      // Charge the card - card details go directly to Paystack, never stored
      chargeResponse = await chargeCard({
        email,
        amount: amountInPesewas,
        card: {
          number: card.number.replace(/\s/g, ''), // Remove spaces
          cvv: card.cvv,
          expiry_month: expMonth,
          expiry_year: expYear,
        },
        reference,
        metadata,
      });
    } else if (paymentMethod === 'mobile') {
      // Validate mobile money data
      if (!mobileMoney?.phone || !mobileMoney?.provider) {
        return NextResponse.json({ error: 'Invalid mobile money details' }, { status: 400 });
      }

      // Map provider names to Paystack codes
      const providerMap: Record<string, 'mtn' | 'vod' | 'tgo'> = {
        mtn: 'mtn',
        vodafone: 'vod',
        airteltigo: 'tgo',
      };

      const provider = providerMap[mobileMoney.provider];
      if (!provider) {
        return NextResponse.json({ error: 'Invalid mobile money provider' }, { status: 400 });
      }

      // Charge mobile money
      chargeResponse = await chargeMobileMoney({
        email,
        amount: amountInPesewas,
        mobile_money: {
          phone: mobileMoney.phone.replace(/\s/g, ''),
          provider,
        },
        reference,
        metadata,
      });
    } else {
      return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 });
    }

    // Handle different charge statuses
    const { status: chargeStatus } = chargeResponse.data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const responseData = chargeResponse.data as any;

    if (chargeStatus === 'success') {
      // Payment successful - save authorization for recurring billing
      await handleSuccessfulPayment(
        userId,
        email,
        plan,
        reference,
        responseData.authorization?.authorization_code,
        responseData.customer?.customer_code
      );

      return NextResponse.json({
        success: true,
        status: 'success',
        message: 'Payment successful!',
        plan,
      });
    } else if (chargeStatus === 'send_otp') {
      // OTP required - return reference for OTP submission
      return NextResponse.json({
        success: false,
        status: 'send_otp',
        message: responseData.display_text || 'Please enter the OTP sent to your phone',
        reference,
      });
    } else if (chargeStatus === 'send_pin') {
      // PIN required
      return NextResponse.json({
        success: false,
        status: 'send_pin',
        message: 'Please enter your card PIN',
        reference,
      });
    } else if (chargeStatus === 'pending') {
      // For mobile money - payment is pending user approval
      return NextResponse.json({
        success: false,
        status: 'pending',
        message: responseData.display_text || 'Please approve the payment on your phone',
        reference,
      });
    } else {
      return NextResponse.json({
        success: false,
        status: 'failed',
        message: 'Payment failed. Please try again.',
      });
    }
  } catch (error) {
    // Log error but NEVER log payment details
    console.error('Payment charge error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Payment processing failed' },
      { status: 500 }
    );
  }
}

async function handleSuccessfulPayment(
  userId: string,
  email: string,
  plan: string,
  reference: string,
  authorizationCode?: string,
  customerCode?: string
) {
  // Calculate subscription period end (30 days from now)
  const currentPeriodEnd = new Date();
  currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 30);

  // Update user in database - save authorization_code for recurring billing
  const { error } = await supabase
    .from('users')
    .update({
      plan,
      paystack_customer_code: customerCode,
      paystack_subscription_code: reference,
      paystack_authorization_code: authorizationCode, // For recurring charges
      subscription_status: 'active',
      current_period_end: currentPeriodEnd.toISOString(),
    })
    .eq('id', userId);

  if (error) {
    console.error('Failed to update user after payment:', error);
    throw new Error('Failed to update subscription');
  }
}
