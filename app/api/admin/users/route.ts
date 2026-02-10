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

  // Get last active timestamp and message count for each user
  const userIds = (users || []).map(u => u.id);

  // Get all chats with their user_id
  const { data: chats } = await supabase
    .from("chats")
    .select("id, user_id")
    .in("user_id", userIds);

  const userChatIds = new Map<string, string[]>();
  for (const chat of (chats || [])) {
    const existing = userChatIds.get(chat.user_id) || [];
    existing.push(chat.id);
    userChatIds.set(chat.user_id, existing);
  }

  const lastActiveMap = new Map<string, string>();
  const messageCountMap = new Map<string, number>();
  const daysActiveMap = new Map<string, number>();

  // Get the most recent message, count, and days active for each user's chats
  for (const [userId, chatIds] of userChatIds.entries()) {
    if (chatIds.length === 0) continue;

    // Get only USER messages (not assistant) to calculate stats
    const { data: userMessages } = await supabase
      .from("messages")
      .select("created_at")
      .in("chat_id", chatIds)
      .eq("role", "user")
      .order("created_at", { ascending: false });

    if (userMessages && userMessages.length > 0) {
      // Last active = most recent message
      lastActiveMap.set(userId, userMessages[0].created_at);

      // Total messages
      messageCountMap.set(userId, userMessages.length);

      // Days active = unique days with messages
      const uniqueDays = new Set(
        userMessages.map(m => new Date(m.created_at).toISOString().split('T')[0])
      );
      daysActiveMap.set(userId, uniqueDays.size);
    }
  }

  // Add last_active, total_messages, and days_active to each user
  const usersWithActivity = (users || []).map(user => ({
    ...user,
    total_messages: messageCountMap.get(user.id) || 0,
    days_active: daysActiveMap.get(user.id) || 0,
    last_active: lastActiveMap.get(user.id) || null
  }));

  return NextResponse.json({ users: usersWithActivity });
}
