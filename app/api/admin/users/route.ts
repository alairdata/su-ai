import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
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
  const session = await getServerSession(authOptions);

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
  const limit = Math.min(parseInt(limitParam || '500'), 500); // Max 500 users

  // SECURITY: Don't expose original_name to prevent PII leakage
  const { data: users, error } = await supabase
    .from("users")
    .select("id, name, email, plan, messages_used_today, created_at, subscription_status, current_period_end")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Failed to fetch users:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }

  // Get message counts per user (only user messages, not assistant)
  const userIds = (users || []).map(u => u.id);

  // Get all chats with their user_id (paginate to avoid Supabase 1000-row default limit)
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

  const userChatIds = new Map<string, string[]>();
  for (const chat of allChats) {
    const existing = userChatIds.get(chat.user_id) || [];
    existing.push(chat.id);
    userChatIds.set(chat.user_id, existing);
  }

  const messageCountMap = new Map<string, number>();
  const activeDaysMap = new Map<string, number>();

  // Get message dates for each user's chats (paginate to get all messages)
  for (const [userId, chatIds] of userChatIds.entries()) {
    if (chatIds.length === 0) continue;

    const allUserMessages: { created_at: string }[] = [];
    let msgOffset = 0;
    const msgPageSize = 1000;
    while (true) {
      const { data: msgPage } = await supabase
        .from("messages")
        .select("created_at")
        .in("chat_id", chatIds)
        .eq("role", "user")
        .range(msgOffset, msgOffset + msgPageSize - 1);
      if (!msgPage || msgPage.length === 0) break;
      allUserMessages.push(...msgPage);
      if (msgPage.length < msgPageSize) break;
      msgOffset += msgPageSize;
    }

    if (allUserMessages.length > 0) {
      messageCountMap.set(userId, allUserMessages.length);

      // Count unique days with at least one message
      const uniqueDays = new Set(
        allUserMessages.map(m => new Date(m.created_at).toISOString().split('T')[0])
      );
      activeDaysMap.set(userId, uniqueDays.size);
    }
  }

  // Add total_messages, days_active (since joined), and active_days (with messages) to each user
  const todayDate = new Date().toISOString().split('T')[0];
  const todayMs = new Date(todayDate).getTime();
  const usersWithActivity = (users || []).map(user => {
    // Use calendar dates (UTC) to match how active_days is counted
    const joinDate = new Date(user.created_at).toISOString().split('T')[0];
    const joinMs = new Date(joinDate).getTime();
    const daysSinceJoined = Math.round((todayMs - joinMs) / (1000 * 60 * 60 * 24)) + 1; // +1 to count join day
    return {
      ...user,
      total_messages: messageCountMap.get(user.id) || 0,
      days_active: daysSinceJoined,
      active_days: activeDaysMap.get(user.id) || 0,
    };
  });

  return NextResponse.json({ users: usersWithActivity });
}
