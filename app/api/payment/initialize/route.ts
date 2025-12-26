import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { initializePaystackTransaction, PLAN_PRICES } from '@/lib/paystack';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { plan } = await request.json();

    if (!plan || !['Pro', 'Enterprise'].includes(plan)) {
      return NextResponse.json(
        { error: 'Invalid plan' },
        { status: 400 }
      );
    }

    const amount = PLAN_PRICES[plan as 'Pro' | 'Enterprise'];

    // Initialize Paystack transaction
    const response = await initializePaystackTransaction(
      session.user.email,
      amount,
      {
        userId: (session.user as any).id,
        plan: plan,
      },
      `${process.env.NEXTAUTH_URL}/payment/callback`
    );

    if (response.status && response.data) {
      return NextResponse.json({
        authorizationUrl: response.data.authorization_url,
        reference: response.data.reference,
      });
    } else {
      throw new Error(response.message || 'Failed to initialize payment');
    }
  } catch (error) {
    console.error('Payment initialization error:', error);
    return NextResponse.json(
      { error: 'Failed to initialize payment' },
      { status: 500 }
    );
  }
}