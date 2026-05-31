import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/mobile-auth';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, getClientIP, rateLimitHeaders } from '@/lib/rate-limit';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
const ADMIN_RATE_LIMIT = { limit: 60, windowSeconds: 60 };

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email.toLowerCase())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = rateLimit(`admin-pevents:${session.user.id}:${getClientIP(req)}`, ADMIN_RATE_LIMIT);
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rateLimitHeaders(rl) });

  const { searchParams } = req.nextUrl;
  const eventType = searchParams.get('event_type') || '';
  const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 200);
  const offset = parseInt(searchParams.get('offset') || '0');

  let query = supabase
    .from('payment_events')
    .select(`
      id, event_type, plan, amount_usd, status, provider, failure_reason, created_at,
      user:user_id (id, name, email)
    `)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (eventType) query = query.eq('event_type', eventType);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });

  // Get total count
  let countQuery = supabase.from('payment_events').select('*', { count: 'exact', head: true });
  if (eventType) countQuery = countQuery.eq('event_type', eventType);
  const { count } = await countQuery;

  return NextResponse.json({ events: data || [], total: count || 0 });
}
