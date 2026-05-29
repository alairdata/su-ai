import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/mobile-auth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TIERS = [
  { points: 30, bonus_msgs: 2 },
  { points: 70, bonus_msgs: 4 },
  { points: 150, bonus_msgs: 8 },
];

function getBoostExpiry(): Date {
  const expiry = new Date();
  expiry.setUTCDate(expiry.getUTCDate() + 7);
  expiry.setUTCHours(23, 59, 59, 999);
  return expiry;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tier_points } = await req.json();
    const tier = TIERS.find(t => t.points === tier_points);
    if (!tier) {
      return NextResponse.json({ error: 'Invalid tier. Choose 30, 70, or 150 points.' }, { status: 400 });
    }

    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('points')
      .eq('id', session.user.id)
      .single();

    if (fetchError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.points < tier.points) {
      return NextResponse.json({
        error: `You need ${tier.points} points to redeem this. You have ${user.points}.`,
        points: user.points,
      }, { status: 400 });
    }

    const newPoints = user.points - tier.points;
    const boostExpiry = getBoostExpiry();

    const { error: updateError } = await supabase
      .from('users')
      .update({
        points: newPoints,
        weekly_bonus_msgs: tier.bonus_msgs,
        bonus_week_number: null,
        bonus_year: null,
        bonus_expires_at: boostExpiry.toISOString(),
      })
      .eq('id', session.user.id);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to redeem points' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      points_spent: tier.points,
      points_remaining: newPoints,
      bonus_msgs: tier.bonus_msgs,
      boost_expires: 'Sunday midnight UTC',
    });
  } catch (error) {
    console.error('Redeem error:', error);
    return NextResponse.json({ error: 'Failed to redeem' }, { status: 500 });
  }
}
