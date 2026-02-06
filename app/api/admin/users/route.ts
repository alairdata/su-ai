import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Admin emails - comma-separated in env var
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || process.env.VIP_EMAILS || '')
  .split(',')
  .map(email => email.trim().toLowerCase())
  .filter(email => email.length > 0);

function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

// GET - List all users
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: users, error } = await supabase
    .from("users")
    .select("id, name, email, plan, messages_used_today, created_at, subscription_status, current_period_end, original_name")
    .order("created_at", { ascending: false });

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

  // Get the most recent message and count for each user's chats
  for (const [userId, chatIds] of userChatIds.entries()) {
    if (chatIds.length === 0) continue;

    // Get last message
    const { data: lastMsg } = await supabase
      .from("messages")
      .select("created_at")
      .in("chat_id", chatIds)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (lastMsg) {
      lastActiveMap.set(userId, lastMsg.created_at);
    }

    // Get message count
    const { count } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .in("chat_id", chatIds);

    messageCountMap.set(userId, count || 0);
  }

  // Add last_active and total_messages to each user
  const usersWithActivity = (users || []).map(user => ({
    ...user,
    total_messages: messageCountMap.get(user.id) || 0,
    last_active: lastActiveMap.get(user.id) || null
  }));

  return NextResponse.json({ users: usersWithActivity });
}
