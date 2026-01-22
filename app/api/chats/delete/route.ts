import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { createClient } from "@supabase/supabase-js";
import { deleteChatSchema, validateInput } from "@/lib/validations";
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
  const validation = validateInput(deleteChatSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { chatId } = validation.data;

  // Fetch chat with messages before deleting
  const { data: chat } = await supabase
    .from("chats")
    .select(`
      id,
      user_id,
      title,
      messages (id, role, content, created_at)
    `)
    .eq("id", chatId)
    .single();

  if (!chat || chat.user_id !== session.user.id) {
    return NextResponse.json({ error: "Chat not found" }, { status: 403 });
  }

  // Save to deleted_chats table (audit log)
  const { error: archiveError } = await supabase
    .from("deleted_chats")
    .insert({
      original_chat_id: chat.id,
      user_id: chat.user_id,
      title: chat.title,
      messages: chat.messages,
    });

  if (archiveError) {
    console.error("Failed to archive deleted chat:", archiveError);
    // Continue with deletion even if archive fails
  }

  // Delete the chat (messages will cascade delete if set up, or delete separately)
  const { error: deleteError } = await supabase
    .from("chats")
    .delete()
    .eq("id", chatId);

  if (deleteError) {
    return NextResponse.json({ error: sanitizeErrorForClient(deleteError) }, { status: 500 });
  }

  // Cleanup: Remove entries older than 30 days from deleted_chats
  // This runs on each delete to keep the table clean (since cron isn't available)
  await supabase
    .from("deleted_chats")
    .delete()
    .lt("deleted_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  return NextResponse.json({ success: true });
}
