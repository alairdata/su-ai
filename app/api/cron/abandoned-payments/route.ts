import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendAbandonedPaymentEmail } from '@/lib/email';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CRON_SECRET = process.env.CRON_SECRET;
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!;

// Check transactions from last 48 hours, send reminder for abandoned ones
const LOOKBACK_HOURS = 48;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = authHeader?.replace('Bearer ', '');

  if (!CRON_SECRET || cronSecret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = { checked: 0, emailed: 0, skipped: 0, errors: [] as string[] };

  try {
    // Fetch recent abandoned transactions from Paystack
    const since = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000);
    const response = await fetch(
      `https://api.paystack.co/transaction?status=abandoned&from=${since.toISOString()}&perPage=50`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const data = await response.json();

    if (!data.status || !data.data) {
      console.error('Paystack API error:', data);
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }

    for (const txn of data.data) {
      results.checked++;

      const email = txn.customer?.email;
      const metadata = txn.metadata as { userId?: string; plan?: string } | null;
      const plan = metadata?.plan;
      const userId = metadata?.userId;

      if (!email || !plan) {
        results.skipped++;
        continue;
      }

      // Check if we already sent a reminder for this user recently
      const { data: existing } = await supabase
        .from('abandoned_payment_reminders')
        .select('id')
        .eq('email', email)
        .gte('sent_at', since.toISOString())
        .limit(1);

      if (existing && existing.length > 0) {
        results.skipped++;
        continue;
      }

      // Check if user has already upgraded (no need to remind)
      if (userId) {
        const { data: user } = await supabase
          .from('users')
          .select('plan, subscription_status')
          .eq('id', userId)
          .single();

        if (user && user.plan !== 'Free' && user.subscription_status === 'active') {
          results.skipped++;
          continue;
        }
      }

      // Get user's name
      let name = 'there';
      if (userId) {
        const { data: user } = await supabase
          .from('users')
          .select('name')
          .eq('id', userId)
          .single();
        if (user?.name) name = user.name;
      }

      // Send the reminder
      const emailResult = await sendAbandonedPaymentEmail(email, name, plan, userId);

      if (emailResult.success) {
        // Record that we sent a reminder
        await supabase
          .from('abandoned_payment_reminders')
          .insert({ email, plan, user_id: userId, reference: txn.reference });

        results.emailed++;
        console.log(`Abandoned payment reminder sent to ${email} for ${plan}`);
      } else {
        results.errors.push(`Failed to email ${email}`);
      }
    }

    console.log('Abandoned payment cron complete:', results);
    return NextResponse.json({ message: 'Abandoned payment check complete', results });
  } catch (error) {
    console.error('Abandoned payment cron error:', error);
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
