import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendFollowUpEmail, sendUpgradeNudgeEmail, sendCheckInEmail } from '@/lib/email';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CRON_SECRET = process.env.CRON_SECRET;

// Active free users who've sent 8+ messages in 5-7 days get the upgrade nudge
const UPGRADE_NUDGE_MIN_MESSAGES = 8;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = authHeader?.replace('Bearer ', '');

  if (!CRON_SECRET || cronSecret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = {
    reengagement: { checked: 0, emailed: 0, skipped: 0 },
    upgradeNudge: { checked: 0, emailed: 0, skipped: 0 },
    checkIn: { checked: 0, emailed: 0, skipped: 0 },
    errors: [] as string[],
  };

  try {
    // Flow 2: Day 2 re-engagement — verified 2-3 days ago, never sent a message
    const day2Start = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const day2End = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

    const { data: reengagementUsers } = await supabase
      .from('users')
      .select('id, email, name, total_messages')
      .gte('created_at', day2Start)
      .lt('created_at', day2End)
      .eq('total_messages', 0)
      .eq('plan', 'Free');

    for (const user of reengagementUsers ?? []) {
      results.reengagement.checked++;
      const result = await sendFollowUpEmail(user.email, user.name || 'there', 5, user.id);
      if (result.success) {
        results.reengagement.emailed++;
      } else {
        results.reengagement.skipped++;
        results.errors.push(`Re-engagement failed for ${user.email}`);
      }
    }

    // Flow 3: Day 5-7 upgrade nudge — active free users hitting limits
    const day5Start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const day5End = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

    const { data: nudgeUsers } = await supabase
      .from('users')
      .select('id, email, name, total_messages')
      .gte('created_at', day5Start)
      .lt('created_at', day5End)
      .eq('plan', 'Free')
      .gte('total_messages', UPGRADE_NUDGE_MIN_MESSAGES);

    for (const user of nudgeUsers ?? []) {
      results.upgradeNudge.checked++;
      const result = await sendUpgradeNudgeEmail(user.email, user.name || 'there', user.total_messages, user.id);
      if (result.success) {
        results.upgradeNudge.emailed++;
      } else {
        results.upgradeNudge.skipped++;
        results.errors.push(`Upgrade nudge failed for ${user.email}`);
      }
    }

    // Flow 4: Day 7 check-in — signed up 7-8 days ago, still never chatted
    const day7Start = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const day7End = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: checkInUsers } = await supabase
      .from('users')
      .select('id, email, name')
      .gte('created_at', day7Start)
      .lt('created_at', day7End)
      .eq('total_messages', 0);

    for (const user of checkInUsers ?? []) {
      results.checkIn.checked++;
      const result = await sendCheckInEmail(user.email, user.name || 'there', user.id);
      if (result.success) {
        results.checkIn.emailed++;
      } else {
        results.checkIn.skipped++;
        results.errors.push(`Check-in failed for ${user.email}`);
      }
    }

    console.log('User onboarding cron complete:', results);
    return NextResponse.json({ message: 'User onboarding cron complete', results });
  } catch (error) {
    console.error('User onboarding cron error:', error);
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
