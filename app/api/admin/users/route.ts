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
    .select("id, name, email, plan, messages_used_today, total_messages, created_at, subscription_status, current_period_end, original_name")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch users:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }

  // Get last active timestamp for each user (last message sent)
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

  // Get last message timestamp per chat
  const allChatIds = Array.from(new Set((chats || []).map(c => c.id)));

  const lastActiveMap = new Map<string, string>();

  if (allChatIds.length > 0) {
    // Get the most recent message for each user's chats
    for (const [userId, chatIds] of userChatIds.entries()) {
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
    }
  }

  // Add last_active to each user
  const usersWithActivity = (users || []).map(user => ({
    ...user,
    last_active: lastActiveMap.get(user.id) || null
  }));

  return NextResponse.json({ users: usersWithActivity });
}
