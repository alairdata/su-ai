import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from "@/lib/mobile-auth";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Update whats_new_seen to true
    const { error } = await supabase
      .from('users')
      .update({ whats_new_seen: true })
      .eq('id', userId);

    if (error) {
      console.error('Failed to dismiss whats new:', error);
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Dismiss whats new error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
