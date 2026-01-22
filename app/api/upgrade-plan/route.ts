import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { createClient } from "@supabase/supabase-js";
import { upgradePlanSchema, validateInput } from "@/lib/validations";
import { sanitizeErrorForClient } from "@/lib/env";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  // Schema validation
  const validation = validateInput(upgradePlanSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { plan } = validation.data;

  const { error } = await supabase
    .from("users")
    .update({ plan })
    .eq("id", session.user.id);

  if (error) {
    return NextResponse.json({ error: sanitizeErrorForClient(error) }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}