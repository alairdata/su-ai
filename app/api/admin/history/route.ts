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

  // Calculate date range based on period
  const now = new Date();
  let startDate: Date;
  let groupBy: "hour" | "day" | "week" | "month";

  switch (period) {
    case "day":
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      groupBy = "hour";
      break;
    case "week":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      groupBy = "day";
      break;
    case "month":
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      groupBy = "week";
      break;
    case "year":
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      groupBy = "month";
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      groupBy = "week";
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
    .select("email, created_at")
    .order("created_at", { ascending: true });

  // Filter out excluded emails from all users
  const allUsers = (allUsersRaw || []).filter(
    u => !EXCLUDED_EMAILS.includes(u.email?.toLowerCase() || '')
  );

  // Fetch messages for message trend (within period)
  const { data: messages, error: messagesError } = await supabase
    .from("messages")
    .select("created_at")
    .gte("created_at", startDate.toISOString())
    .order("created_at", { ascending: true });

  // Fetch ALL messages for cumulative count
  const { data: allMessages } = await supabase
    .from("messages")
    .select("created_at")
    .order("created_at", { ascending: true });

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

  return NextResponse.json({
    userTrend,
    messageTrend,
    avgTrend,
    period,
    hasMessages: !messagesError && messages !== null
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
