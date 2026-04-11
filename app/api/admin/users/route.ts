import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/mobile-auth";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, getClientIP, rateLimitHeaders } from "@/lib/rate-limit";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Admin emails - comma-separated in env var
// SECURITY: Do NOT fallback to VIP_EMAILS - admin access must be explicit
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(email => email.trim().toLowerCase())
  .filter(email => email.length > 0);

function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  if (ADMIN_EMAILS.length === 0) {
    console.error('SECURITY: ADMIN_EMAILS not configured!');
    return false;
  }
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

// SECURITY: Rate limit for admin endpoints
const ADMIN_RATE_LIMIT = { limit: 30, windowSeconds: 60 };

// GET - List all users (with safety limit)
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limiting for admin endpoints
  const clientIP = getClientIP(req);
  const rateLimitKey = `admin-users:${session.user.id}:${clientIP}`;
  const rateLimitResult = rateLimit(rateLimitKey, ADMIN_RATE_LIMIT);

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: rateLimitHeaders(rateLimitResult) }
    );
  }

  // SECURITY: Limit results to prevent DOS and data exposure
  const url = new URL(req.url);
  const limitParam = url.searchParams.get('limit');
  const limit = Math.min(Math.max(1, parseInt(limitParam || '500') || 500), 500); // Max 500 users

  // SECURITY: Don't expose original_name to prevent PII leakage
  const { data: users, error } = await supabase
    .from("users")
    .select("id, name, email, plan, messages_used_today, last_reset_date, created_at, subscription_status, current_period_end")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Failed to fetch users:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }

  // Fix stale messages_used_today: if last_reset_date is not today, show 0
  const todayStr = new Date().toISOString().split('T')[0];
  for (const user of (users || [])) {
    const resetDate = user.last_reset_date
      ? new Date(user.last_reset_date).toISOString().split('T')[0]
      : null;
    if (resetDate !== todayStr) {
      user.messages_used_today = 0;
    }
  }

  // Get message counts from user_message_stats view (includes deleted + undeleted)
  const userIds = (users || []).map(u => u.id);
  const { data: messageStats } = await supabase
    .from("user_message_stats")
    .select("id, undeleted_messages, deleted_messages, total_messages")
    .in("id", userIds);

  const messageStatsMap = new Map(
    (messageStats || []).map(s => [s.id, s])
  );

  // Get active days per user (unique days with at least one message in active chats)
  // Fetch all chats for these users in one paginated bulk query
  const allChats: { id: string; user_id: string }[] = [];
  let chatOffset = 0;
  const chatPageSize = 1000;
  while (true) {
    const { data: chatPage } = await supabase
      .from("chats")
      .select("id, user_id")
      .in("user_id", userIds)
      .range(chatOffset, chatOffset + chatPageSize - 1);
    if (!chatPage || chatPage.length === 0) break;
    allChats.push(...chatPage);
    if (chatPage.length < chatPageSize) break;
    chatOffset += chatPageSize;
  }

  // Build chatId → userId map
  const chatToUser = new Map<string, string>();
  for (const chat of allChats) {
    chatToUser.set(chat.id, chat.user_id);
  }

  // Single bulk query for all messages across all chats — avoids N+1
  const allChatIds = allChats.map(c => c.id);
  const userActiveDays = new Map<string, Set<string>>();

  if (allChatIds.length > 0) {
    let msgOffset = 0;
    const msgPageSize = 1000;
    while (true) {
      const { data: msgPage } = await supabase
        .from("messages")
        .select("chat_id, created_at")
        .in("chat_id", allChatIds)
        .eq("role", "user")
        .range(msgOffset, msgOffset + msgPageSize - 1);
      if (!msgPage || msgPage.length === 0) break;
      for (const msg of msgPage) {
        const userId = chatToUser.get(msg.chat_id);
        if (!userId) continue;
        if (!userActiveDays.has(userId)) userActiveDays.set(userId, new Set());
        userActiveDays.get(userId)!.add(new Date(msg.created_at).toISOString().split('T')[0]);
      }
      if (msgPage.length < msgPageSize) break;
      msgOffset += msgPageSize;
    }
  }

  const activeDaysMap = new Map<string, number>();
  for (const [userId, days] of userActiveDays.entries()) {
    activeDaysMap.set(userId, days.size);
  }

  // Add total_messages, days_active (since joined), and active_days (with messages) to each user
  const todayDate = new Date().toISOString().split('T')[0];
  const todayMs = new Date(todayDate).getTime();
  const usersWithActivity = (users || []).map(user => {
    const joinDate = new Date(user.created_at).toISOString().split('T')[0];
    const joinMs = new Date(joinDate).getTime();
    const daysSinceJoined = Math.round((todayMs - joinMs) / (1000 * 60 * 60 * 24)) + 1;
    const stats = messageStatsMap.get(user.id);
    return {
      ...user,
      total_messages: stats?.total_messages || 0,
      days_active: daysSinceJoined,
      active_days: activeDaysMap.get(user.id) || 0,
    };
  });

  return NextResponse.json({ users: usersWithActivity });
}
