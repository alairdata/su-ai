import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { createClient } from "@supabase/supabase-js";
import { renameChatSchema, validateInput } from "@/lib/validations";
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
  const validation = validateInput(renameChatSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { chatId, title } = validation.data;

  // Verify ownership
  const { data: chat } = await supabase
    .from("chats")
    .select("user_id")
    .eq("id", chatId)
    .single();

  if (!chat || chat.user_id !== session.user.id) {
    return NextResponse.json({ error: "Chat not found" }, { status: 403 });
  }

  const { error } = await supabase
    .from("chats")
    .update({ title })
    .eq("id", chatId);

  if (error) {
    return NextResponse.json({ error: sanitizeErrorForClient(error) }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}