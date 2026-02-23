import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/mobile-auth";
import { getEffectivePlan } from "@/lib/plans";
import { createClient } from "@supabase/supabase-js";
import { clearAllMemories } from "@/lib/memory";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check plan
  const { data: dbUser } = await supabase
    .from("users")
    .select("plan, email")
    .eq("id", session.user.id)
    .single();

  const userPlan = getEffectivePlan(dbUser?.plan, dbUser?.email);
  if (userPlan === "Free") {
    return NextResponse.json({ error: "Upgrade to Pro to manage AI memories" }, { status: 403 });
  }

  const success = await clearAllMemories(session.user.id);
  if (!success) {
    return NextResponse.json({ error: "Failed to clear memories" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
