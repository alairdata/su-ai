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

// POST - Update user's timezone
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // SECURITY: Rate limit timezone changes to prevent reset abuse
  // Only allow 2 timezone changes per day
  const clientIP = getClientIP(req);
  const rateLimitResult = rateLimit(`timezone:${session.user.id}`, { limit: 2, windowSeconds: 60 * 60 * 24 });

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: "Too many timezone changes. You can change your timezone twice per day." },
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

  // Get current user data to check if reset_timezone needs to be set
  const { data: currentUser } = await supabase
    .from("users")
    .select("timezone, reset_timezone")
    .eq("id", session.user.id)
    .single();

  // SECURITY: If reset_timezone is not set yet, set it to current timezone
  // This prevents users from changing timezone to trigger early resets
  const updateData: Record<string, string> = { timezone };

  // Only update reset_timezone if it hasn't been set yet
  // This preserves the timezone that was active at last reset
  if (!currentUser?.reset_timezone) {
    updateData.reset_timezone = timezone;
  }

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
