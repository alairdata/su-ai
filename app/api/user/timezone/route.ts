import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { createClient } from "@supabase/supabase-js";
import { updateTimezoneSchema, validateInput } from "@/lib/validations";
import { sanitizeErrorForClient } from "@/lib/env";
import { rateLimit, getClientIP, rateLimitHeaders } from "@/lib/rate-limit";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST - Auto-detect and save user's timezone (only if not already set)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // SECURITY: Rate limit to prevent abuse
  const clientIP = getClientIP(req);
  const rateLimitResult = rateLimit(`timezone:${session.user.id}`, { limit: 2, windowSeconds: 60 * 60 * 24 });

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rateLimitResult) }
    );
  }

  const body = await req.json();

  // Schema validation - includes IANA timezone check
  const validation = validateInput(updateTimezoneSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { timezone } = validation.data;

  // SECURITY: Only allow setting timezone if user doesn't already have one
  // This prevents users from changing timezone to manipulate daily resets
  const { data: currentUser } = await supabase
    .from("users")
    .select("timezone, reset_timezone")
    .eq("id", session.user.id)
    .single();

  if (currentUser?.timezone) {
    return NextResponse.json({ success: true, timezone: currentUser.timezone });
  }

  const updateData: Record<string, string> = { timezone, reset_timezone: timezone };

  const { error } = await supabase
    .from("users")
    .update(updateData)
    .eq("id", session.user.id);

  if (error) {
    return NextResponse.json({ error: sanitizeErrorForClient(error) }, { status: 500 });
  }

  return NextResponse.json({ success: true, timezone });
}

// GET - Get user's current timezone
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: user, error } = await supabase
    .from("users")
    .select("timezone")
    .eq("id", session.user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: sanitizeErrorForClient(error) }, { status: 500 });
  }

  return NextResponse.json({ timezone: user?.timezone || "UTC" });
}
