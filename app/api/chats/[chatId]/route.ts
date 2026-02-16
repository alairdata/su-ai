import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, getClientIP, rateLimitHeaders, RATE_LIMITS, getUserIPKey } from "@/lib/rate-limit";

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

  // Rate limiting - 60 requests per minute
  const clientIP = getClientIP(req);
  const rateLimitKey = getUserIPKey(session.user.id, clientIP, 'chat-get');
  const rateLimitResult = rateLimit(rateLimitKey, RATE_LIMITS.chats);

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: rateLimitHeaders(rateLimitResult) }
    );
  }

  const { chatId } = await params;

  // SECURITY: Validate chatId format (UUID)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!chatId || !uuidRegex.test(chatId)) {
    return NextResponse.json({ error: "Invalid chat ID" }, { status: 400 });
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
        created_at,
        image_url,
        file_type,
        file_name,
        character_id,
        character_name,
        character_color_bg,
        character_color_fg,
        character_color_border,
        character_color_bg_light,
        character_color_tag
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
