import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { createClient } from "@supabase/supabase-js";
import { updateNameSchema, validateInput } from "@/lib/validations";
import { sanitizeErrorForClient } from "@/lib/env";
import { rateLimit, getClientIP, rateLimitHeaders, getUserIPKey } from "@/lib/rate-limit";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// SECURITY: Rate limit name changes - 5 per hour
const NAME_CHANGE_LIMIT = { limit: 5, windowSeconds: 60 * 60 };

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limiting - prevent name change abuse
  const clientIP = getClientIP(req);
  const rateLimitKey = getUserIPKey(session.user.id, clientIP, 'update-name');
  const rateLimitResult = rateLimit(rateLimitKey, NAME_CHANGE_LIMIT);

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: "Too many name changes. Please try again later." },
      { status: 429, headers: rateLimitHeaders(rateLimitResult) }
    );
  }

  const body = await req.json();

  // Schema validation
  const validation = validateInput(updateNameSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { name } = validation.data;

  const { error } = await supabase
    .from("users")
    .update({ name })
    .eq("id", session.user.id);

  if (error) {
    return NextResponse.json({ error: sanitizeErrorForClient(error) }, { status: 500 });
  }

  return NextResponse.json({ success: true, name });
}
