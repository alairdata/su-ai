import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { createClient } from "@supabase/supabase-js";
import { updateTimezoneSchema, validateInput } from "@/lib/validations";
import { sanitizeErrorForClient } from "@/lib/env";

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

  const body = await req.json();

  // Schema validation - includes IANA timezone check
  const validation = validateInput(updateTimezoneSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { timezone } = validation.data;

  // Only update the timezone preference - does NOT reset message counts
  const { error } = await supabase
    .from("users")
    .update({ timezone })
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
