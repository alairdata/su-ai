import { NextRequest, NextResponse } from "next/server";
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

// Fixed start date for all data: Jan 28th 2026
const DATA_START_DATE = new Date('2026-01-28T00:00:00.000Z');

function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

// GET - Get historical data for charts
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

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

  // Filter out excluded emails
  const users = (usersRaw || []).filter(
    u => !EXCLUDED_EMAILS.includes(u.email?.toLowerCase() || '')
  );

  // Fetch ALL users for cumulative count (for avg calculation)
  const { data: allUsersRaw } = await supabase
    .from("users")
    .select("id, email, created_at")
    .order("created_at", { ascending: true });

  // Get excluded user IDs and filter out excluded emails
  const excludedUserIds = (allUsersRaw || [])
    .filter(u => EXCLUDED_EMAILS.includes(u.email?.toLowerCase() || ''))
    .map(u => u.id);

  const allUsers = (allUsersRaw || []).filter(
    u => !EXCLUDED_EMAILS.includes(u.email?.toLowerCase() || '')
  );

  // Get chat IDs belonging to excluded users
  let excludedChatIds: string[] = [];
  if (excludedUserIds.length > 0) {
    const { data: excludedChats } = await supabase
      .from("chats")
      .select("id")
      .in("user_id", excludedUserIds);
    excludedChatIds = (excludedChats || []).map(c => c.id);
  }

  // Fetch messages for message trend (within period) - excluding messages from excluded users
  let messages: { created_at: string; chat_id?: string }[] = [];
  if (excludedChatIds.length > 0) {
    const { data, error: messagesError } = await supabase
      .from("messages")
      .select("created_at, chat_id")
      .gte("created_at", startDate.toISOString())
      .order("created_at", { ascending: true });

    messages = (data || []).filter(m => !excludedChatIds.includes(m.chat_id));
    if (messagesError) console.error("Messages error:", messagesError);
  } else {
    const { data, error: messagesError } = await supabase
      .from("messages")
      .select("created_at, chat_id")
      .gte("created_at", startDate.toISOString())
      .order("created_at", { ascending: true });
    messages = data || [];
    if (messagesError) console.error("Messages error:", messagesError);
  }

  // Fetch ALL messages for cumulative count - excluding messages from excluded users
  let allMessages: { created_at: string }[] = [];
  if (excludedChatIds.length > 0) {
    const { data } = await supabase
      .from("messages")
      .select("created_at, chat_id")
      .order("created_at", { ascending: true });
    allMessages = (data || []).filter(m => !excludedChatIds.includes(m.chat_id));
  } else {
    const { data } = await supabase
      .from("messages")
      .select("created_at")
      .order("created_at", { ascending: true });
    allMessages = data || [];
  }

  // Fetch chats with message counts for top users - within period
  const { data: chatsWithCounts } = await supabase
    .from("chats")
    .select("id, user_id")
    .gte("created_at", startDate.toISOString());

  // Count messages per user in period
  const userMessageCounts: Map<string, number> = new Map();
  const filteredChats = (chatsWithCounts || []).filter(c => !excludedUserIds.includes(c.user_id));

  // Get message counts per chat
  for (const chat of filteredChats) {
    const chatMessages = messages.filter(m => m.chat_id === chat.id);
    const currentCount = userMessageCounts.get(chat.user_id) || 0;
    userMessageCounts.set(chat.user_id, currentCount + chatMessages.length);
  }

  // Also count messages from chats created before the period but messages sent in period
  if (excludedChatIds.length > 0) {
    const { data: periodMessages } = await supabase
      .from("messages")
      .select("chat_id")
      .gte("created_at", startDate.toISOString());

    const { data: allChats } = await supabase
      .from("chats")
      .select("id, user_id");

    const chatToUser = new Map((allChats || []).map(c => [c.id, c.user_id]));

    for (const msg of (periodMessages || [])) {
      const userId = chatToUser.get(msg.chat_id);
      if (userId && !excludedUserIds.includes(userId)) {
        const currentCount = userMessageCounts.get(userId) || 0;
        userMessageCounts.set(userId, currentCount + 1);
      }
    }
  } else {
    const { data: periodMessages } = await supabase
      .from("messages")
      .select("chat_id")
      .gte("created_at", startDate.toISOString());

    const { data: allChats } = await supabase
      .from("chats")
      .select("id, user_id");

    const chatToUser = new Map((allChats || []).map(c => [c.id, c.user_id]));

    for (const msg of (periodMessages || [])) {
      const userId = chatToUser.get(msg.chat_id);
      if (userId && !excludedUserIds.includes(userId)) {
        const currentCount = userMessageCounts.get(userId) || 0;
        userMessageCounts.set(userId, currentCount + 1);
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

  // Calculate message distribution (0-10+ buckets based on messages per day in period)
  const daysDiff = Math.max(1, Math.ceil((now.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)));
  const messageDistribution: { bucket: string; count: number }[] = [];

  const buckets = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const bucketCounts = new Map<number, number>();
  buckets.forEach(b => bucketCounts.set(b, 0));

  for (const [, msgCount] of userMessageCounts.entries()) {
    const avgPerDay = Math.round(msgCount / daysDiff);
    const bucket = Math.min(avgPerDay, 10);
    bucketCounts.set(bucket, (bucketCounts.get(bucket) || 0) + 1);
  }

  // Also count users with 0 messages
  const usersWithMessages = new Set(userMessageCounts.keys());
  const usersWithZero = allUsers.filter(u => !usersWithMessages.has(u.id)).length;
  bucketCounts.set(0, (bucketCounts.get(0) || 0) + usersWithZero);

  for (const bucket of buckets) {
    messageDistribution.push({
      bucket: bucket === 10 ? '10+' : String(bucket),
      count: bucketCounts.get(bucket) || 0
    });
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

  const sortedKeys = Array.from(groups.keys()).sort();
  for (const key of sortedKeys) {
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
