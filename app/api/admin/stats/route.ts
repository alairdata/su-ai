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

// Emails to exclude from aggregations/stats
const EXCLUDED_EMAILS = ['datawithprincilla@gmail.com'];

function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

// GET - Get dashboard stats
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get user counts by plan (include id and email for filtering)
  const { data: allUsers, error: usersError } = await supabase
    .from("users")
    .select("id, email, plan, messages_used_today, created_at, subscription_status");

  if (usersError) {
    console.error("Failed to fetch stats:", usersError);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }

  // Get excluded user IDs
  const excludedUserIds = (allUsers || [])
    .filter(u => EXCLUDED_EMAILS.includes(u.email?.toLowerCase() || ''))
    .map(u => u.id);

  // Filter out excluded emails from aggregations
  const users = (allUsers || []).filter(
    u => !EXCLUDED_EMAILS.includes(u.email?.toLowerCase() || '')
  );

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Get chat IDs belonging to excluded users
  let excludedChatIds: string[] = [];
  if (excludedUserIds.length > 0) {
    const { data: excludedChats } = await supabase
      .from("chats")
      .select("id")
      .in("user_id", excludedUserIds);
    excludedChatIds = (excludedChats || []).map(c => c.id);
  }

  // Get total messages count (excluding messages from excluded users' chats)
  let totalMessages = 0;
  if (excludedChatIds.length > 0) {
    // Count messages NOT in excluded chats
    const { count } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .not("chat_id", "in", `(${excludedChatIds.join(",")})`);
    totalMessages = count || 0;
  } else {
    const { count } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true });
    totalMessages = count || 0;
  }

  const avgMessagesPerUser = users.length > 0
    ? Math.round((totalMessages / users.length) * 10) / 10
    : 0;

  const stats = {
    totalUsers: users.length,
    planCounts: {
      Free: users.filter(u => u.plan === "Free").length,
      Pro: users.filter(u => u.plan === "Pro").length,
      Plus: users.filter(u => u.plan === "Plus").length,
    },
    activeSubscriptions: users.filter(u => u.subscription_status === "active").length,
    totalMessagesToday: users.reduce((sum, u) => sum + (u.messages_used_today || 0), 0),
    signupsToday: users.filter(u => new Date(u.created_at) >= today).length,
    signupsThisWeek: users.filter(u => new Date(u.created_at) >= thisWeek).length,
    signupsThisMonth: users.filter(u => new Date(u.created_at) >= thisMonth).length,
    avgMessagesPerUser,
    totalMessages: totalMessages || 0,
  };

  return NextResponse.json({ stats });
}
