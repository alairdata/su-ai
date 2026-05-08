import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/mobile-auth";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, getClientIP, rateLimitHeaders } from "@/lib/rate-limit";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// SECURITY: Do NOT fallback to VIP_EMAILS - admin access must be explicit
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(email => email.trim().toLowerCase())
  .filter(email => email.length > 0);

function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  if (ADMIN_EMAILS.length === 0) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

const ADMIN_RATE_LIMIT = { limit: 10, windowSeconds: 60 };

// POST - Reset daily message count for a specific user
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResult = rateLimit(`admin-reset-messages:${session.user.id}:${getClientIP(req)}`, ADMIN_RATE_LIMIT);
  if (!rateLimitResult.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: rateLimitHeaders(rateLimitResult) });
  }

  const body = await req.json().catch(() => ({}));
  const { userId } = body;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!userId || !uuidRegex.test(userId)) {
    return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
  }

  const { error } = await supabase
    .from("users")
    .update({ messages_used_today: 0, last_reset_date: new Date().toISOString() })
    .eq("id", userId);

  if (error) {
    console.error("Failed to reset message count:", error);
    return NextResponse.json({ error: "Failed to reset message count" }, { status: 500 });
  }

  console.log('AUDIT: Reset message count', {
    timestamp: new Date().toISOString(),
    adminEmail: session.user.email,
    targetUserId: userId,
  });

  return NextResponse.json({ success: true });
}
