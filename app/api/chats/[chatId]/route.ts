import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Fetch a single chat by ID
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { chatId } = await params;

  if (!chatId) {
    return NextResponse.json({ error: "Chat ID required" }, { status: 400 });
  }

  const { data: chat, error } = await supabase
    .from("chats")
    .select(`
      id,
      title,
      created_at,
      messages (
        id,
        role,
        content,
        created_at
      )
    `)
    .eq("id", chatId)
    .eq("user_id", session.user.id)
    .order("created_at", { referencedTable: "messages", ascending: true })
    .single();

  if (error || !chat) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  return NextResponse.json({ chat });
}
