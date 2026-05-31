import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/mobile-auth';
import { createClient } from '@supabase/supabase-js';

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

    // Get user's timezone
    const { data: user } = await supabase
      .from('users')
      .select('timezone, reset_timezone')
      .eq('id', userId)
      .single();

    const userTz = user?.reset_timezone || user?.timezone || 'UTC';

    // Count actual messages sent today in the user's timezone
    const { data, error } = await supabase.rpc('get_messages_used_today', {
      user_id_param: userId,
      user_tz_param: userTz,
    });

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

      return NextResponse.json({ count: count || 0 });
    }

    return NextResponse.json({ count: data || 0 });
  } catch (err) {
    console.error('message-count error:', err);
    return NextResponse.json({ count: 0 });
  }
}
