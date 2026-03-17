import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/mobile-auth";
import { createClient } from "@supabase/supabase-js";

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

// Fixed start date for all data: Jan 28th 2026
const DATA_START_DATE = new Date('2026-01-28T00:00:00.000Z');

function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

// GET - Get historical data for charts
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") || "month"; // day, week, month, year

  // Calculate date range based on period - always start from Jan 28th 2026
  const now = new Date();
  let startDate: Date = new Date(DATA_START_DATE);
  let groupBy: "hour" | "day" | "week" | "month";

  switch (period) {
    case "day":
      // Last 24 hours, but not before start date
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      startDate = dayAgo > DATA_START_DATE ? dayAgo : DATA_START_DATE;
      groupBy = "hour";
      break;
    case "week":
      // Last 7 days, but not before start date
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      startDate = weekAgo > DATA_START_DATE ? weekAgo : DATA_START_DATE;
      groupBy = "day";
      break;
    case "month":
      // Last 30 days, but not before start date
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      startDate = monthAgo > DATA_START_DATE ? monthAgo : DATA_START_DATE;
      groupBy = "day";
      break;
    case "year":
      // Always from start date
      startDate = DATA_START_DATE;
      groupBy = "month";
      break;
    default:
      startDate = DATA_START_DATE;
      groupBy = "day";
  }

  // Fetch users for signup trend (within period)
  const { data: usersRaw, error: usersError } = await supabase
    .from("users")
    .select("email, created_at")
    .gte("created_at", startDate.toISOString())
    .order("created_at", { ascending: true });

  if (usersError) {
    console.error("Failed to fetch user history:", usersError);
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
  }

  const users = usersRaw || [];

  // Fetch ALL users for cumulative count (for avg calculation)
  const { data: allUsersRaw } = await supabase
    .from("users")
    .select("id, email, created_at")
    .order("created_at", { ascending: true });

  const allUsers = allUsersRaw || [];

  // Fetch messages for message trend (within period)
  // ONLY count user messages, not assistant responses
  const { data: messagesData, error: messagesError } = await supabase
    .from("messages")
    .select("created_at, chat_id")
    .eq("role", "user")
    .gte("created_at", startDate.toISOString())
    .order("created_at", { ascending: true });

  let messages: { created_at: string; chat_id?: string }[] = messagesData || [];
  if (messagesError) console.error("Messages error:", messagesError);

  // Fetch ALL messages for cumulative count
  // ONLY count user messages, not assistant responses
  const { data: allMessagesData } = await supabase
    .from("messages")
    .select("created_at")
    .eq("role", "user")
    .order("created_at", { ascending: true });
  let allMessages: { created_at: string }[] = allMessagesData || [];

  // Fetch deleted messages from deleted_chats (archived as JSON)
  // and merge them into messages, allMessages for complete chart data
  try {
    const { data: deletedChats } = await supabase.from("deleted_chats").select("messages, user_id");
    if (deletedChats) {
      for (const chat of deletedChats) {
        const msgs = Array.isArray(chat.messages) ? chat.messages : [];
        for (const m of msgs) {
          if (m.role === "user" && m.created_at) {
            allMessages.push({ created_at: m.created_at });
            if (new Date(m.created_at) >= startDate) {
              messages.push({ created_at: m.created_at, chat_id: `deleted_${chat.user_id}` });
            }
          }
        }
      }
    }
  } catch (e) {
    console.error("Failed to fetch deleted messages for charts:", e);
  }

  // Re-sort after merging deleted messages
  allMessages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  // Build chat_id → user_id map for active user tracking
  const chatUserMap = new Map<string, string>();
  const { data: chatMappings } = await supabase
    .from("chats")
    .select("id, user_id");
  for (const chat of (chatMappings || [])) {
    chatUserMap.set(chat.id, chat.user_id);
  }

  // Count messages per user using user_message_stats for accurate totals
  const userMessageCounts: Map<string, number> = new Map();
  const { data: userMsgStats } = await supabase
    .from("user_message_stats")
    .select("id, total_messages");

  if (userMsgStats) {
    for (const s of userMsgStats) {
      if ((s.total_messages || 0) > 0) {
        userMessageCounts.set(s.id, s.total_messages);
      }
    }
  }

  // Get top 10 users by message count
  const sortedUsers = Array.from(userMessageCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // Get user details for top users
  const topUserIds = sortedUsers.map(([id]) => id);
  const { data: topUserDetails } = await supabase
    .from("users")
    .select("id, name, email")
    .in("id", topUserIds);

  const userDetailsMap = new Map((topUserDetails || []).map(u => [u.id, u]));

  const topUsers = sortedUsers.map(([userId, messageCount]) => {
    const user = userDetailsMap.get(userId);
    return {
      id: userId,
      name: user?.name || 'Unknown',
      email: user?.email || '',
      messageCount
    };
  });

  // Calculate message distribution (total messages per user, bucketed with emails)
  const messageDistribution: { bucket: string; count: number; users: { email: string; total: number }[] }[] = [];
  const bucketDefs: { label: string; min: number; max: number }[] = [
    { label: "0", min: 0, max: 0 },
    { label: "1", min: 1, max: 1 },
    { label: "2", min: 2, max: 2 },
    { label: "3-5", min: 3, max: 5 },
    { label: "6-10", min: 6, max: 10 },
    { label: "11-20", min: 11, max: 20 },
    { label: "21-30", min: 21, max: 30 },
    { label: "31-40", min: 31, max: 40 },
    { label: "41-50", min: 41, max: 50 },
    { label: "51-60", min: 51, max: 60 },
    { label: "61-70", min: 61, max: 70 },
    { label: "71-80", min: 71, max: 80 },
    { label: "81-90", min: 81, max: 90 },
    { label: "91-100", min: 91, max: 100 },
    { label: "100+", min: 101, max: Infinity },
  ];
  const bucketUsers: { email: string; total: number }[][] = bucketDefs.map(() => []);

  // Build user ID → email map
  const userEmailMap = new Map(allUsers.map(u => [u.id, u.email]));

  // Users with 0 messages
  const usersWithMessages = new Set(userMessageCounts.keys());
  for (const u of allUsers) {
    if (!usersWithMessages.has(u.id)) {
      bucketUsers[0].push({ email: u.email, total: 0 });
    }
  }

  for (const [userId, msgCount] of userMessageCounts.entries()) {
    const email = userEmailMap.get(userId) || 'unknown';
    for (let i = 0; i < bucketDefs.length; i++) {
      if (msgCount >= bucketDefs[i].min && msgCount <= bucketDefs[i].max) {
        bucketUsers[i].push({ email, total: msgCount });
        break;
      }
    }
  }

  for (let i = 0; i < bucketDefs.length; i++) {
    bucketUsers[i].sort((a, b) => b.total - a.total);
    messageDistribution.push({ bucket: bucketDefs[i].label, count: bucketUsers[i].length, users: bucketUsers[i] });
  }

  // Group data by time period
  const userTrend = groupDataByPeriod(users || [], groupBy, startDate, now);
  const messageTrend = groupDataByPeriod(messages || [], groupBy, startDate, now);

  // Calculate avg messages per user trend
  const avgTrend = calculateAvgTrend(
    allUsers || [],
    allMessages || [],
    groupBy,
    startDate,
    now
  );

  // Calculate active user trend (unique users who sent messages per time bucket)
  const activeUserTrend = calculateActiveUserTrend(messages, chatUserMap, groupBy, startDate, now);

  // Calculate period-specific stats
  const periodStats = {
    signups: users.length,
    messages: messages.length,
    avgMessagesPerUser: users.length > 0
      ? Math.round((messages.length / users.length) * 10) / 10
      : 0
  };

  return NextResponse.json({
    userTrend,
    messageTrend,
    avgTrend,
    activeUserTrend,
    topUsers,
    messageDistribution,
    periodStats,
    period,
    hasMessages: messages.length > 0
  });
}

interface DataPoint {
  created_at: string;
}

function groupDataByPeriod(
  data: DataPoint[],
  groupBy: "hour" | "day" | "week" | "month",
  startDate: Date,
  endDate: Date
): { label: string; count: number; cumulative: number }[] {
  const groups: Map<string, number> = new Map();

  // Initialize all periods with 0
  const current = new Date(startDate);
  while (current <= endDate) {
    const key = getGroupKey(current, groupBy);
    groups.set(key, 0);

    switch (groupBy) {
      case "hour":
        current.setHours(current.getHours() + 1);
        break;
      case "day":
        current.setDate(current.getDate() + 1);
        break;
      case "week":
        current.setDate(current.getDate() + 7);
        break;
      case "month":
        current.setMonth(current.getMonth() + 1);
        break;
    }
  }

  // Count items in each period
  for (const item of data) {
    const date = new Date(item.created_at);
    const key = getGroupKey(date, groupBy);
    groups.set(key, (groups.get(key) || 0) + 1);
  }

  // Convert to array with cumulative counts
  const result: { label: string; count: number; cumulative: number }[] = [];
  let cumulative = 0;

  // Use insertion order (already chronological from startDate → endDate)
  for (const key of groups.keys()) {
    const count = groups.get(key) || 0;
    cumulative += count;
    result.push({ label: key, count, cumulative });
  }

  return result;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getWeekNumber(date: Date): number {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + startOfYear.getDay() + 1) / 7);
}

function getGroupKey(date: Date, groupBy: "hour" | "day" | "week" | "month"): string {
  switch (groupBy) {
    case "hour":
      // Daily view: "00:00", "01:00", etc.
      return `${String(date.getHours()).padStart(2, '0')}:00`;
    case "day":
      // Weekly view: "Jan 1", "Jan 2", etc.
      return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`;
    case "week":
      // Monthly view: "Week 1", "Week 2", etc.
      return `Week ${getWeekNumber(date)}`;
    case "month":
      // Yearly view: "Jan", "Feb", etc.
      return MONTH_NAMES[date.getMonth()];
    default:
      return date.toISOString().split('T')[0];
  }
}

function calculateAvgTrend(
  allUsers: DataPoint[],
  allMessages: DataPoint[],
  groupBy: "hour" | "day" | "week" | "month",
  startDate: Date,
  endDate: Date
): { label: string; avg: number }[] {
  const result: { label: string; avg: number }[] = [];

  // Generate all time points
  const timePoints: Date[] = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    timePoints.push(new Date(current));
    switch (groupBy) {
      case "hour":
        current.setHours(current.getHours() + 1);
        break;
      case "day":
        current.setDate(current.getDate() + 1);
        break;
      case "week":
        current.setDate(current.getDate() + 7);
        break;
      case "month":
        current.setMonth(current.getMonth() + 1);
        break;
    }
  }

  // For each time point, calculate cumulative users and messages up to that point
  for (const timePoint of timePoints) {
    const usersUpToPoint = allUsers.filter(
      u => new Date(u.created_at) <= timePoint
    ).length;
    const messagesUpToPoint = allMessages.filter(
      m => new Date(m.created_at) <= timePoint
    ).length;

    const avg = usersUpToPoint > 0
      ? Math.round((messagesUpToPoint / usersUpToPoint) * 10) / 10
      : 0;

    result.push({
      label: getGroupKey(timePoint, groupBy),
      avg
    });
  }

  return result;
}

function calculateActiveUserTrend(
  messages: { created_at: string; chat_id?: string }[],
  chatUserMap: Map<string, string>,
  groupBy: "hour" | "day" | "week" | "month",
  startDate: Date,
  endDate: Date
): { label: string; count: number }[] {
  // Group unique user IDs per time bucket
  const bucketUsers = new Map<string, Set<string>>();

  // Initialize all periods
  const current = new Date(startDate);
  while (current <= endDate) {
    const key = getGroupKey(current, groupBy);
    if (!bucketUsers.has(key)) bucketUsers.set(key, new Set());
    switch (groupBy) {
      case "hour": current.setHours(current.getHours() + 1); break;
      case "day": current.setDate(current.getDate() + 1); break;
      case "week": current.setDate(current.getDate() + 7); break;
      case "month": current.setMonth(current.getMonth() + 1); break;
    }
  }

  // Count unique users per bucket
  for (const msg of messages) {
    let userId: string | null | undefined = null;
    if (msg.chat_id?.startsWith("deleted_")) {
      userId = msg.chat_id.replace("deleted_", "");
    } else if (msg.chat_id) {
      userId = chatUserMap.get(msg.chat_id);
    }
    if (!userId) continue;
    const key = getGroupKey(new Date(msg.created_at), groupBy);
    const users = bucketUsers.get(key);
    if (users) users.add(userId);
  }

  // Convert to array (insertion order = chronological)
  const result: { label: string; count: number }[] = [];
  for (const [label, users] of bucketUsers) {
    result.push({ label, count: users.size });
  }
  return result;
}
