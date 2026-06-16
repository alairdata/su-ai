// ⚠️ CRITICAL — DO NOT change the seeding logic in useChats.ts to use the JWT/session value.
// The message count MUST always be fetched from this endpoint on page load.
// The JWT caches a stale value and causes the counter to reset to 0 on refresh,
// letting users bypass the daily limit. This endpoint reads directly from the messages
// table (same source of truth as the increment_messages_used_today RPC).
// If this ever breaks, users can bypass daily limits by refreshing the page.
import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/mobile-auth';
import { createClient } from '@supabase/supabase-js';
import { PLAN_LIMITS } from '@/lib/constants';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Returns the actual message count for today from the messages table
// This is the single source of truth — same logic as the RPC
export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Get user's timezone and plan info for effective limit calculation
    const { data: user } = await supabase
      .from('users')
      .select('timezone, reset_timezone, plan, weekly_bonus_msgs, bonus_expires_at')
      .eq('id', userId)
      .single();

    const userTz = user?.reset_timezone || user?.timezone || 'UTC';

    // Count actual messages sent today in the user's timezone
    const { data, error } = await supabase.rpc('get_messages_used_today', {
      user_id_param: userId,
      user_tz_param: userTz,
    });

    // Compute effective daily limit (plan base + active weekly bonus)
    const now = new Date();
    const bonusActive = user?.bonus_expires_at && new Date(user.bonus_expires_at) > now;
    const bonusMsgs = bonusActive ? (user?.weekly_bonus_msgs || 0) : 0;
    const basePlanLimit = PLAN_LIMITS[user?.plan as keyof typeof PLAN_LIMITS] ?? 5;
    const effectiveLimit = basePlanLimit + bonusMsgs;

    if (error) {
      // Fallback: count from messages table directly using UTC day
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);

      const { count } = await supabase
        .from('messages')
        .select('*, chats!inner(user_id)', { count: 'exact', head: true })
        .eq('chats.user_id', userId)
        .eq('role', 'user')
        .gte('created_at', todayStart.toISOString());

      return NextResponse.json({ count: count || 0, limit: effectiveLimit });
    }

    return NextResponse.json({ count: data || 0, limit: effectiveLimit });
  } catch (err) {
    console.error('message-count error:', err);
    return NextResponse.json({ count: 0 });
  }
}
