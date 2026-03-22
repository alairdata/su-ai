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
import { sendSubscriptionEmail, sendPaymentFailedEmail } from '@/lib/email';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Retry configuration — 3 days total before downgrade
const MAX_RETRY_ATTEMPTS = 2;
const RETRY_INTERVALS_DAYS = [1, 1]; // Retry after 1 day, then 1 more day
const GRACE_PERIOD_DAYS = 1; // 1 day after final retry before downgrade

// Cron secret to prevent unauthorized access - REQUIRED
const CRON_SECRET = process.env.CRON_SECRET;

// SECURITY: Track processed users to prevent duplicate charges in same run
const processedUsersThisRun = new Set<string>();

const LOCK_ID = 'billing_cron';
const MIN_CRON_INTERVAL_MINUTES = 5;

// Acquire a database-level lock to prevent concurrent cron runs across instances
async function acquireCronLock(): Promise<boolean> {
  // Try to insert a lock row — if it already exists and is recent, another instance is running
  const { data, error } = await supabase
    .from('cron_locks')
    .upsert(
      { id: LOCK_ID, locked_at: new Date().toISOString(), locked_by: crypto.randomUUID() },
      { onConflict: 'id' }
    )
    .select('locked_at')
    .single();

  if (error) {
    // Table might not exist — fall back to allowing the run
    console.warn('Cron lock table not available, proceeding without lock:', error.message);
    return true;
  }

  // Check if the lock was set recently (another instance might have just grabbed it)
  const lockedAt = new Date(data.locked_at);
  const minutesAgo = (Date.now() - lockedAt.getTime()) / 60000;

  // If lock is older than interval, it's stale — we grabbed it fresh via upsert
  return minutesAgo < MIN_CRON_INTERVAL_MINUTES;
}

async function releaseCronLock(): Promise<void> {
  await supabase
    .from('cron_locks')
    .delete()
    .eq('id', LOCK_ID);
}

export async function GET(req: NextRequest) {
  // Verify cron secret (for Vercel Cron or external cron services)
  // SECURITY: Secret is REQUIRED - never allow requests without it
  const authHeader = req.headers.get('authorization');
  const cronSecret = authHeader?.replace('Bearer ', '');

  if (!CRON_SECRET || cronSecret !== CRON_SECRET) {
    console.error('Cron billing: Unauthorized access attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // SECURITY: Acquire database lock to prevent concurrent runs across instances
  const lockAcquired = await acquireCronLock();
  if (!lockAcquired) {
    console.warn('Cron billing: Another instance is running, skipping');
    return NextResponse.json({ error: 'Cron already running' }, { status: 409 });
  }

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

    // Find all users whose billing period has ended OR who are past_due/grace_period
    const { data: users, error: fetchError } = await supabase
      .from('users')
      .select('id, email, name, plan, subscription_status, current_period_end, paystack_authorization, paystack_customer_code, scheduled_plan, retry_count, last_retry_at, grace_period_end')
      .neq('plan', 'Free')
      .or(`current_period_end.lte.${now.toISOString()},subscription_status.eq.past_due,subscription_status.eq.grace_period`);

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

        // Handle grace period expiry - downgrade to Free
        if (user.subscription_status === 'grace_period') {
          if (user.grace_period_end && new Date(user.grace_period_end) <= now) {
            await supabase
              .from('users')
              .update({
                plan: 'Free',
                subscription_status: 'expired',
                paystack_authorization: null,
                current_period_end: null,
                retry_count: 0,
                last_retry_at: null,
                grace_period_end: null,
              })
              .eq('id', user.id);

            // Send downgrade email
            if (user.email) {
              try {
                await sendSubscriptionEmail(
                  user.email,
                  user.name || 'there',
                  'Free',
                  'downgraded',
                  undefined,
                  user.id
                );
              } catch (emailError) {
                console.error('Failed to send downgrade email:', emailError);
              }
            }

            results.cancelled++;
            console.log(`Grace period expired, downgraded user ${user.id} to Free`);
          }
          // Grace period not yet expired - skip
          continue;
        }

        // If no authorization, can't charge - mark as past_due
        if (!user.paystack_authorization) {
          const retryCount = (user.retry_count || 0) + 1;
          if (retryCount >= MAX_RETRY_ATTEMPTS) {
            // All retries exhausted, enter grace period
            const gracePeriodEnd = new Date();
            gracePeriodEnd.setDate(gracePeriodEnd.getDate() + GRACE_PERIOD_DAYS);

            await supabase
              .from('users')
              .update({
                subscription_status: 'grace_period',
                retry_count: retryCount,
                last_retry_at: now.toISOString(),
                grace_period_end: gracePeriodEnd.toISOString(),
              })
              .eq('id', user.id);
          } else {
            await supabase
              .from('users')
              .update({
                subscription_status: 'past_due',
                retry_count: retryCount,
                last_retry_at: now.toISOString(),
              })
              .eq('id', user.id);
          }

          // Send payment failed email
          if (user.email) {
            try {
              await sendPaymentFailedEmail(user.email, user.name || 'there', user.plan, Math.min(retryCount, MAX_RETRY_ATTEMPTS), MAX_RETRY_ATTEMPTS, user.id);
            } catch (emailError) {
              console.error('Failed to send payment failed email:', emailError);
            }
          }

          results.failed++;
          results.errors.push(`No authorization for user ${user.id}`);
          console.error('No authorization for user:', user.id);
          continue;
        }

        // For past_due users, check if it's time for a retry
        if (user.subscription_status === 'past_due' && user.last_retry_at) {
          const lastRetry = new Date(user.last_retry_at);
          const retryIndex = Math.min((user.retry_count || 1) - 1, RETRY_INTERVALS_DAYS.length - 1);
          const nextRetryDate = new Date(lastRetry);
          nextRetryDate.setDate(nextRetryDate.getDate() + RETRY_INTERVALS_DAYS[retryIndex]);

          if (now < nextRetryDate) {
            // Not time to retry yet
            continue;
          }
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
          // Update subscription period and reset retry state
          const newPeriodEnd = getNextBillingDate();

          await supabase
            .from('users')
            .update({
              subscription_status: 'active',
              current_period_end: newPeriodEnd.toISOString(),
              retry_count: 0,
              last_retry_at: null,
              grace_period_end: null,
            })
            .eq('id', user.id);

          results.renewed++;
          console.log(`Renewed subscription for user: ${user.id}, new period end: ${newPeriodEnd.toISOString()}`);
        } else {
          // Charge failed - increment retry count
          const retryCount = (user.retry_count || 0) + 1;

          if (retryCount >= MAX_RETRY_ATTEMPTS) {
            // All retries exhausted, enter grace period
            const gracePeriodEnd = new Date();
            gracePeriodEnd.setDate(gracePeriodEnd.getDate() + GRACE_PERIOD_DAYS);

            await supabase
              .from('users')
              .update({
                subscription_status: 'grace_period',
                retry_count: retryCount,
                last_retry_at: now.toISOString(),
                grace_period_end: gracePeriodEnd.toISOString(),
              })
              .eq('id', user.id);

            console.log(`User ${user.id} entered grace period until ${gracePeriodEnd.toISOString()}`);
          } else {
            await supabase
              .from('users')
              .update({
                subscription_status: 'past_due',
                retry_count: retryCount,
                last_retry_at: now.toISOString(),
              })
              .eq('id', user.id);
          }

          results.failed++;
          results.errors.push(`Charge failed for user ${user.id} (attempt ${retryCount}/${MAX_RETRY_ATTEMPTS})`);
          console.error('Charge failed for user:', user.id, `attempt ${retryCount}/${MAX_RETRY_ATTEMPTS}`);

          // Send payment failed email
          if (user.email) {
            try {
              await sendPaymentFailedEmail(user.email, user.name || 'there', user.plan, Math.min(retryCount, MAX_RETRY_ATTEMPTS), MAX_RETRY_ATTEMPTS, user.id);
            } catch (emailError) {
              console.error('Failed to send payment failed email:', emailError);
            }
          }
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
    await releaseCronLock();
    processedUsersThisRun.clear();
  }
}

// Also support POST for some cron services
export async function POST(req: NextRequest) {
  return GET(req);
}
