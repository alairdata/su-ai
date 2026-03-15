import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/mobile-auth";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(email => email.trim().toLowerCase())
  .filter(email => email.length > 0);

function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

// GET - Deeper insight analytics (real data)
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // ── Fetch all users ──
    const { data: allUsers } = await supabase
      .from("users")
      .select("id, name, email, plan, created_at, subscription_status, current_period_end")
      .order("created_at", { ascending: true });
    const users = allUsers || [];

    // ── Fetch all chats with user_id ──
    const { data: allChats } = await supabase
      .from("chats")
      .select("id, user_id, created_at");
    const chats = allChats || [];
    const chatUserMap = new Map<string, string>();
    const chatCreatedMap = new Map<string, string>();
    for (const c of chats) {
      chatUserMap.set(c.id, c.user_id);
      chatCreatedMap.set(c.id, c.created_at);
    }

    // ── Fetch all user messages with chat_id ──
    const { data: allMessages } = await supabase
      .from("messages")
      .select("id, chat_id, created_at")
      .eq("role", "user")
      .order("created_at", { ascending: true });
    const messages = allMessages || [];

    // ── Fetch deleted chat messages ──
    const { data: deletedChats } = await supabase
      .from("deleted_chats")
      .select("messages, user_id, deleted_at");

    // Build per-user message arrays (including deleted)
    const userMessages = new Map<string, { created_at: string; chat_id: string }[]>();

    // Active messages
    for (const msg of messages) {
      const userId = chatUserMap.get(msg.chat_id);
      if (!userId) continue;
      if (!userMessages.has(userId)) userMessages.set(userId, []);
      userMessages.get(userId)!.push({ created_at: msg.created_at, chat_id: msg.chat_id });
    }

    // Deleted messages
    for (const dc of (deletedChats || [])) {
      const msgs = Array.isArray(dc.messages) ? dc.messages : [];
      for (const m of msgs) {
        if (m.role === "user" && m.created_at) {
          if (!userMessages.has(dc.user_id)) userMessages.set(dc.user_id, []);
          userMessages.get(dc.user_id)!.push({ created_at: m.created_at, chat_id: `deleted_${dc.user_id}` });
        }
      }
    }

    // Sort each user's messages chronologically
    for (const [, msgs] of userMessages) {
      msgs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }

    // ── 1. FIRST SESSION DEPTH ──
    // For each user, count how many messages they sent in their first session
    // A "session" = messages within 30 min gaps on the same day
    const firstSessionCounts: number[] = [];

    for (const user of users) {
      const msgs = userMessages.get(user.id);
      if (!msgs || msgs.length === 0) continue;

      // First session: messages from first day, within 30-min gaps
      let sessionCount = 1;
      for (let i = 1; i < msgs.length; i++) {
        const gap = new Date(msgs[i].created_at).getTime() - new Date(msgs[i - 1].created_at).getTime();
        // If gap > 30 minutes, session ends
        if (gap > 30 * 60 * 1000) break;
        sessionCount++;
      }
      firstSessionCounts.push(sessionCount);
    }

    const sessionDepth = {
      sent1: firstSessionCounts.filter(c => c >= 1).length,
      sent3: firstSessionCounts.filter(c => c >= 3).length,
      sent5: firstSessionCounts.filter(c => c >= 5).length,
      sent10: firstSessionCounts.filter(c => c >= 10).length,
      sent20: firstSessionCounts.filter(c => c >= 20).length,
    };

    // ── 2. TIME TO GHOST ──
    // For users with 0 total messages, they ghosted on Day 0
    // For users who stopped, find last message date - signup date
    const now = new Date();
    const ghostBuckets = { day0: 0, day1: 0, day2_3: 0, day4_7: 0, day8_14: 0, day15_30: 0 };

    for (const user of users) {
      const msgs = userMessages.get(user.id);
      const signupDate = new Date(user.created_at);
      const daysSinceSignup = Math.floor((now.getTime() - signupDate.getTime()) / (1000 * 60 * 60 * 24));

      // Only consider users who haven't been active in 7+ days as potential ghosts
      if (!msgs || msgs.length === 0) {
        // Never sent a message
        ghostBuckets.day0++;
      } else {
        // Check if they're a ghost (no activity in last 14 days)
        const lastMsg = new Date(msgs[msgs.length - 1].created_at);
        const daysSinceLastMsg = Math.floor((now.getTime() - lastMsg.getTime()) / (1000 * 60 * 60 * 24));

        if (daysSinceLastMsg >= 14) {
          // They ghosted - when?
          const daysActiveAfterSignup = Math.floor((lastMsg.getTime() - signupDate.getTime()) / (1000 * 60 * 60 * 24));

          if (daysActiveAfterSignup <= 0) ghostBuckets.day0++;
          else if (daysActiveAfterSignup === 1) ghostBuckets.day1++;
          else if (daysActiveAfterSignup <= 3) ghostBuckets.day2_3++;
          else if (daysActiveAfterSignup <= 7) ghostBuckets.day4_7++;
          else if (daysActiveAfterSignup <= 14) ghostBuckets.day8_14++;
          else ghostBuckets.day15_30++;
        }
      }
    }

    // ── 3. COHORT RETENTION ──
    // Group users by signup week, track % who messaged on D1, D3, D7, D14, D30
    const cohorts: {
      week: string;
      size: number;
      d1: number | null;
      d3: number | null;
      d7: number | null;
      d14: number | null;
      d30: number | null;
    }[] = [];

    // Get the earliest signup date
    const earliestSignup = users.length > 0 ? new Date(users[0].created_at) : now;

    // Generate weekly cohorts from earliest signup to now
    const weekStart = new Date(earliestSignup);
    weekStart.setHours(0, 0, 0, 0);
    // Align to Monday
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));

    while (weekStart < now) {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const cohortUsers = users.filter(u => {
        const joined = new Date(u.created_at);
        return joined >= weekStart && joined < weekEnd;
      });

      if (cohortUsers.length > 0) {
        const daysFromCohortStart = Math.floor((now.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24));

        // For each retention day, count users who sent a message on or after that day from signup
        const retentionDay = (dayThreshold: number): number | null => {
          if (daysFromCohortStart < dayThreshold) return null; // Not enough time has passed

          let retained = 0;
          for (const user of cohortUsers) {
            const msgs = userMessages.get(user.id);
            if (!msgs || msgs.length === 0) continue;

            const signupDate = new Date(user.created_at);
            const thresholdDate = new Date(signupDate.getTime() + dayThreshold * 24 * 60 * 60 * 1000);

            // Did this user send any message on or after the threshold date?
            const hasMessageAfter = msgs.some(m => new Date(m.created_at) >= thresholdDate);
            if (hasMessageAfter) retained++;
          }

          return cohortUsers.length > 0 ? Math.round((retained / cohortUsers.length) * 100) : 0;
        };

        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const weekLabel = `${monthNames[weekStart.getMonth()]} W${Math.ceil(weekStart.getDate() / 7)}`;

        cohorts.push({
          week: weekLabel,
          size: cohortUsers.length,
          d1: retentionDay(1),
          d3: retentionDay(3),
          d7: retentionDay(7),
          d14: retentionDay(14),
          d30: retentionDay(30),
        });
      }

      weekStart.setDate(weekStart.getDate() + 7);
    }

    // Only return last 8 cohorts for display
    const recentCohorts = cohorts.slice(-8);

    // ── 4. RETURN FREQUENCY ──
    // Count unique days each user was active, then categorize
    const returnFreq = { daily: 0, twoThree: 0, weekly: 0, biweekly: 0, onceOnly: 0 };

    for (const user of users) {
      const msgs = userMessages.get(user.id);
      if (!msgs || msgs.length === 0) continue;

      // Count unique active days
      const activeDays = new Set<string>();
      for (const m of msgs) {
        activeDays.add(new Date(m.created_at).toISOString().split('T')[0]);
      }

      const dayCount = activeDays.size;
      const daysSinceSignup = Math.max(1, Math.floor((now.getTime() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24)));
      const frequency = dayCount / daysSinceSignup; // ratio of active days to total days

      if (dayCount === 1) returnFreq.onceOnly++;
      else if (frequency >= 0.7) returnFreq.daily++;  // Active 70%+ of days
      else if (frequency >= 0.3) returnFreq.twoThree++; // Active 30-70% of days
      else if (frequency >= 0.12) returnFreq.weekly++;   // ~1x/week
      else returnFreq.biweekly++;
    }

    // ── 5. DAU/MAU DATA ──
    // For each day in last 30 days, compute DAU/MAU
    const dauMauData: { label: string; dau: number; mau: number; ratio: number }[] = [];
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Precompute: for each day, which users were active
    const dailyActiveUsers = new Map<string, Set<string>>();
    for (const [userId, msgs] of userMessages) {
      for (const m of msgs) {
        const day = new Date(m.created_at).toISOString().split('T')[0];
        if (!dailyActiveUsers.has(day)) dailyActiveUsers.set(day, new Set());
        dailyActiveUsers.get(day)!.add(userId);
      }
    }

    // Iterate last 30 days
    for (let d = 0; d < 30; d++) {
      const date = new Date(now.getTime() - (29 - d) * 24 * 60 * 60 * 1000);
      const dayStr = date.toISOString().split('T')[0];
      const dau = dailyActiveUsers.get(dayStr)?.size || 0;

      // MAU = unique users active in the 30 days ending on this date
      const mauStart = new Date(date.getTime() - 29 * 24 * 60 * 60 * 1000);
      const mauUsers = new Set<string>();
      for (const [day, users] of dailyActiveUsers) {
        const dayDate = new Date(day);
        if (dayDate >= mauStart && dayDate <= date) {
          for (const u of users) mauUsers.add(u);
        }
      }
      const mau = mauUsers.size;
      const ratio = mau > 0 ? Math.round((dau / mau) * 100) : 0;

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const label = `${monthNames[date.getMonth()]} ${date.getDate()}`;

      dauMauData.push({ label, dau, mau, ratio });
    }

    const avgDauMau = dauMauData.length > 0
      ? (dauMauData.reduce((s, d) => s + d.ratio, 0) / dauMauData.length).toFixed(1)
      : "0";

    // ── 6. MRR HISTORY ──
    // Track when users got paid plans by looking at current paid users
    // Since we don't have subscription history, estimate from user created_at + plan
    const paidUsers = users.filter(u => u.plan !== "Free");
    const mrrHistory: { label: string; mrr: number }[] = [];

    // Generate weekly MRR points
    const mrrStart = new Date(earliestSignup);
    mrrStart.setHours(0, 0, 0, 0);

    const mrrCurrent = new Date(mrrStart);
    while (mrrCurrent <= now) {
      let mrr = 0;
      for (const pu of paidUsers) {
        const signedUp = new Date(pu.created_at);
        if (signedUp <= mrrCurrent) {
          mrr += pu.plan === "Pro" ? 4.99 : pu.plan === "Plus" ? 9.99 : 0;
        }
      }

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const label = `${monthNames[mrrCurrent.getMonth()]} ${mrrCurrent.getDate()}`;
      mrrHistory.push({ label, mrr: Math.round(mrr * 100) / 100 });

      mrrCurrent.setDate(mrrCurrent.getDate() + 7);
    }

    // Add current point
    let currentMRR = 0;
    for (const pu of paidUsers) {
      currentMRR += pu.plan === "Pro" ? 4.99 : pu.plan === "Plus" ? 9.99 : 0;
    }
    if (mrrHistory.length === 0 || mrrHistory[mrrHistory.length - 1].mrr !== currentMRR) {
      mrrHistory.push({ label: "Now", mrr: Math.round(currentMRR * 100) / 100 });
    }

    // ── 7. ACTIVE VS GHOST OVER TIME ──
    // For each week, count cumulative active (sent 1+ msg by that date) vs ghost
    const activeGhostTrend: { label: string; active: number; ghost: number }[] = [];
    const trendStart = new Date(earliestSignup);
    trendStart.setHours(0, 0, 0, 0);
    const trendCurrent = new Date(trendStart);

    while (trendCurrent <= now) {
      const cutoff = new Date(trendCurrent);
      let totalByDate = 0;
      let activeByDate = 0;

      for (const user of users) {
        if (new Date(user.created_at) > cutoff) continue;
        totalByDate++;
        const msgs = userMessages.get(user.id);
        if (msgs && msgs.some(m => new Date(m.created_at) <= cutoff)) {
          activeByDate++;
        }
      }

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const label = `${monthNames[trendCurrent.getMonth()]} ${trendCurrent.getDate()}`;
      activeGhostTrend.push({ label, active: activeByDate, ghost: totalByDate - activeByDate });

      trendCurrent.setDate(trendCurrent.getDate() + 7);
    }

    return NextResponse.json({
      sessionDepth,
      ghostBuckets,
      cohorts: recentCohorts,
      returnFreq,
      dauMauData: dauMauData.filter((_, i) => i % 3 === 0 || i === dauMauData.length - 1), // Sample every 3 days
      avgDauMau,
      mrrHistory: mrrHistory.slice(-10), // Last 10 data points
      activeGhostTrend: activeGhostTrend.slice(-10),
    });
  } catch (err) {
    console.error("Insights error:", err);
    return NextResponse.json({ error: "Failed to compute insights" }, { status: 500 });
  }
}
