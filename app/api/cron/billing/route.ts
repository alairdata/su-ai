import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  chargeAuthorization,
  generateReference,
  getNextBillingDate,
  PLAN_CONFIG,
  usdToGhsPesewas,
  PlanType
} from '@/lib/paystack';
import { sendSubscriptionEmail } from '@/lib/email';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Cron secret to prevent unauthorized access - REQUIRED
const CRON_SECRET = process.env.CRON_SECRET;

// SECURITY: Track processed users to prevent duplicate charges in same run
const processedUsersThisRun = new Set<string>();

// SECURITY: Simple lock to prevent concurrent cron runs
let cronRunning = false;
let lastCronRun = 0;
const MIN_CRON_INTERVAL = 5 * 60 * 1000; // 5 minutes minimum between runs

export async function GET(req: NextRequest) {
  // Verify cron secret (for Vercel Cron or external cron services)
  // SECURITY: Secret is REQUIRED - never allow requests without it
  const authHeader = req.headers.get('authorization');
  const cronSecret = authHeader?.replace('Bearer ', '');

  if (!CRON_SECRET || cronSecret !== CRON_SECRET) {
    console.error('Cron billing: Unauthorized access attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // SECURITY: Prevent concurrent cron runs
  if (cronRunning) {
    console.warn('Cron billing: Already running, skipping duplicate execution');
    return NextResponse.json({ error: 'Cron already running' }, { status: 409 });
  }

  // SECURITY: Prevent too-frequent runs (idempotency window)
  const now = Date.now();
  if (now - lastCronRun < MIN_CRON_INTERVAL) {
    console.warn('Cron billing: Too soon since last run, skipping');
    return NextResponse.json({ error: 'Cron run too recent' }, { status: 429 });
  }

  cronRunning = true;
  lastCronRun = now;
  processedUsersThisRun.clear();

  console.log('Starting billing cron job...');

  const results = {
    processed: 0,
    renewed: 0,
    cancelled: 0,
    failed: 0,
    errors: [] as string[],
  };

  try {
    // Get current date (start of day for comparison)
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Find all users whose billing period has ended
    const { data: users, error: fetchError } = await supabase
      .from('users')
      .select('id, email, name, plan, subscription_status, current_period_end, paystack_authorization, paystack_customer_code, scheduled_plan')
      .neq('plan', 'Free')
      .lte('current_period_end', now.toISOString());

    if (fetchError) {
      console.error('Failed to fetch users:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    if (!users || users.length === 0) {
      console.log('No users to process');
      return NextResponse.json({ message: 'No users to process', results });
    }

    console.log(`Found ${users.length} users to process`);

    for (const user of users) {
      results.processed++;

      // SECURITY: Skip if already processed in this run (duplicate prevention)
      if (processedUsersThisRun.has(user.id)) {
        console.warn('Skipping duplicate user in same run:', user.id);
        continue;
      }
      processedUsersThisRun.add(user.id);

      // SECURITY: Double-check period end is actually in the past
      const periodEnd = new Date(user.current_period_end);
      if (periodEnd > now) {
        console.warn('Skipping user - period not yet ended:', user.id, periodEnd);
        continue;
      }

      try {
        // If subscription is canceling, downgrade to Free
        if (user.subscription_status === 'canceling') {
          await supabase
            .from('users')
            .update({
              plan: 'Free',
              subscription_status: 'canceled',
              paystack_authorization: null,
              current_period_end: null,
            })
            .eq('id', user.id);

          // Send cancellation complete email
          if (user.email) {
            try {
              await sendSubscriptionEmail(
                user.email,
                user.name || 'there',
                user.plan,
                'cancelled'
              );
            } catch (emailError) {
              console.error('Failed to send cancel email:', emailError);
            }
          }

          results.cancelled++;
          console.log(`Cancelled subscription for user: ${user.id}`);
          continue;
        }

        // Handle plan downgrade (Plus → Pro)
        if (user.subscription_status === 'downgrading') {
          // SECURITY: Use scheduled_plan if set, otherwise default to Pro
          const newPlan = user.scheduled_plan || 'Pro';

          // Charge for the new (lower) plan
          const planConfig = PLAN_CONFIG[newPlan as PlanType];
          if (planConfig && user.paystack_authorization) {
            const amount = await usdToGhsPesewas(planConfig.priceUSD);
            const reference = generateReference(`downgrade_${user.id.slice(0, 8)}`);

            const chargeResult = await chargeAuthorization({
              email: user.email,
              amount,
              authorization_code: user.paystack_authorization,
              reference,
              metadata: {
                userId: user.id,
                plan: newPlan,
                type: 'downgrade_renewal',
              },
            });

            if (chargeResult.data.status === 'success') {
              const newPeriodEnd = getNextBillingDate();
              await supabase
                .from('users')
                .update({
                  plan: newPlan,
                  subscription_status: 'active',
                  current_period_end: newPeriodEnd.toISOString(),
                  scheduled_plan: null, // Clear scheduled plan
                })
                .eq('id', user.id);

              console.log(`Downgraded user ${user.id} from ${user.plan} to ${newPlan}`);
              results.renewed++;
              continue;
            }
          }

          // If charge failed, mark as past_due
          await supabase
            .from('users')
            .update({ subscription_status: 'past_due' })
            .eq('id', user.id);

          results.failed++;
          console.error('Downgrade charge failed for user:', user.id);
          continue;
        }

        // If no authorization, can't charge - mark as past_due
        if (!user.paystack_authorization) {
          await supabase
            .from('users')
            .update({ subscription_status: 'past_due' })
            .eq('id', user.id);

          results.failed++;
          results.errors.push(`No authorization for user ${user.id}`);
          console.error('No authorization for user:', user.id);
          continue;
        }

        // Charge the saved card for renewal
        const planConfig = PLAN_CONFIG[user.plan as PlanType];
        if (!planConfig) {
          results.failed++;
          results.errors.push(`Invalid plan for user ${user.id}: ${user.plan}`);
          continue;
        }

        const amount = await usdToGhsPesewas(planConfig.priceUSD);
        const reference = generateReference(`renewal_${user.id.slice(0, 8)}`);

        console.log(`Charging user ${user.id} for ${user.plan}: ${amount} pesewas`);

        const chargeResult = await chargeAuthorization({
          email: user.email,
          amount,
          authorization_code: user.paystack_authorization,
          reference,
          metadata: {
            userId: user.id,
            plan: user.plan,
            type: 'renewal',
          },
        });

        if (chargeResult.data.status === 'success') {
          // Update subscription period
          const newPeriodEnd = getNextBillingDate();

          await supabase
            .from('users')
            .update({
              subscription_status: 'active',
              current_period_end: newPeriodEnd.toISOString(),
            })
            .eq('id', user.id);

          results.renewed++;
          console.log(`Renewed subscription for user: ${user.id}, new period end: ${newPeriodEnd.toISOString()}`);
        } else {
          // Charge failed - mark as past_due
          await supabase
            .from('users')
            .update({ subscription_status: 'past_due' })
            .eq('id', user.id);

          results.failed++;
          results.errors.push(`Charge failed for user ${user.id}`);
          console.error('Charge failed for user:', user.id, chargeResult);

          // TODO: Send payment failed email
        }
      } catch (userError) {
        results.failed++;
        results.errors.push(`Error processing user ${user.id}: ${userError}`);
        console.error('Error processing user:', user.id, userError);
      }
    }

    console.log('Billing cron job complete:', results);

    return NextResponse.json({
      message: 'Billing cron job complete',
      results,
    });
  } catch (error) {
    console.error('Billing cron job error:', error);
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 });
  } finally {
    // SECURITY: Always release lock
    cronRunning = false;
    processedUsersThisRun.clear();
  }
}

// Also support POST for some cron services
export async function POST(req: NextRequest) {
  return GET(req);
}
