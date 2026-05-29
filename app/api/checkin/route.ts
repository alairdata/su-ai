import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/mobile-auth';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, getClientIP, getUserIPKey, RATE_LIMITS } from '@/lib/rate-limit';

const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const todayUTC = new Date().toISOString().split('T')[0];
    const { data: user } = await supabaseClient
      .from('users')
      .select('points, last_checkin_date, weekly_bonus_msgs, bonus_week_number, bonus_year')
      .eq('id', session.user.id)
      .single();

    if (!user) return NextResponse.json({ points: 0 });

    const already_checked_in = user.last_checkin_date === todayUTC;
    const at_cap = user.points >= POINTS_CAP;

    return NextResponse.json({
      points: user.points ?? 0,
      already_checked_in,
      at_cap,
      weekly_bonus_msgs: user.weekly_bonus_msgs ?? 0,
    });
  } catch {
    return NextResponse.json({ points: 0 });
  }
}

const supabase = supabaseClient;

const POINTS_PER_CHECKIN = 10;
const POINTS_CAP = 150;
const MIN_ACCOUNT_AGE_DAYS = 3;

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit: max 1 attempt per hour
    const clientIP = getClientIP(req);
    const rl = rateLimit(getUserIPKey(session.user.id, clientIP, 'checkin'), {
      limit: 1,
      windowSeconds: 60 * 60,
    });
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many check-in attempts. Try again later.' }, { status: 429 });
    }

    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('points, last_checkin_date, created_at')
      .eq('id', session.user.id)
      .single();

    if (fetchError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Account must be at least 3 days old
    const accountAgeDays = (Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24);
    if (accountAgeDays < MIN_ACCOUNT_AGE_DAYS) {
      return NextResponse.json({
        error: `Check-in unlocks after your account is ${MIN_ACCOUNT_AGE_DAYS} days old.`,
        unlocks_in_days: Math.ceil(MIN_ACCOUNT_AGE_DAYS - accountAgeDays),
      }, { status: 403 });
    }

    // Once per UTC day
    const todayUTC = new Date().toISOString().split('T')[0];
    if (user.last_checkin_date === todayUTC) {
      return NextResponse.json({
        error: 'Already checked in today.',
        already_checked_in: true,
        points: user.points,
      }, { status: 400 });
    }

    // Points cap
    if (user.points >= POINTS_CAP) {
      return NextResponse.json({
        error: 'You\'ve hit the 150-point cap. Redeem some points first then come back.',
        at_cap: true,
        points: user.points,
      }, { status: 400 });
    }

    const newPoints = Math.min(user.points + POINTS_PER_CHECKIN, POINTS_CAP);

    const { error: updateError } = await supabase
      .from('users')
      .update({ points: newPoints, last_checkin_date: todayUTC })
      .eq('id', session.user.id);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to check in' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      points: newPoints,
      points_earned: newPoints - user.points,
      at_cap: newPoints >= POINTS_CAP,
    });
  } catch (error) {
    console.error('Check-in error:', error);
    return NextResponse.json({ error: 'Failed to check in' }, { status: 500 });
  }
}
