import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/mobile-auth";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_CHARACTERS_PER_CHAT = 5;

// GET - List characters for a chat
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const chatId = req.nextUrl.searchParams.get("chatId");
  if (!chatId) {
    return NextResponse.json({ error: "chatId required" }, { status: 400 });
  }

  // Verify chat belongs to user
  const { data: chat } = await supabase
    .from("chats")
    .select("id")
    .eq("id", chatId)
    .eq("user_id", session.user.id)
    .single();

  if (!chat) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  const { data: characters, error } = await supabase
    .from("chat_characters")
    .select("*")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch characters" }, { status: 500 });
  }

  return NextResponse.json({ characters: characters || [] });
}

// POST - Create a character
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { chatId, name, personality, color_bg, color_fg, color_border, color_bg_light, color_tag } = body;

  if (!chatId || !name?.trim()) {
    return NextResponse.json({ error: "chatId and name required" }, { status: 400 });
  }

  if (name.trim().length > 16) {
    return NextResponse.json({ error: "Name must be 16 characters or less" }, { status: 400 });
  }

  // Verify chat belongs to user
  const { data: chat } = await supabase
    .from("chats")
    .select("id")
    .eq("id", chatId)
    .eq("user_id", session.user.id)
    .single();

  if (!chat) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  // Check character limit
  const { count } = await supabase
    .from("chat_characters")
    .select("id", { count: "exact", head: true })
    .eq("chat_id", chatId);

  if ((count || 0) >= MAX_CHARACTERS_PER_CHAT) {
    return NextResponse.json({ error: "Maximum 5 characters per chat" }, { status: 400 });
  }

  const { data: character, error } = await supabase
    .from("chat_characters")
    .insert({
      chat_id: chatId,
      user_id: session.user.id,
      name: name.trim(),
      personality: personality?.trim()?.slice(0, 300) || null,
      color_bg: color_bg || "#2D1B4E",
      color_fg: color_fg || "#B388FF",
      color_border: color_border || "rgba(179,136,255,0.2)",
      color_bg_light: color_bg_light || "rgba(179,136,255,0.06)",
      color_tag: color_tag || "rgba(179,136,255,0.15)",
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to create character:", error);
    return NextResponse.json({ error: "Failed to create character" }, { status: 500 });
  }

  return NextResponse.json({ character });
}

// DELETE - Remove a character
export async function DELETE(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const characterId = req.nextUrl.searchParams.get("id");
  if (!characterId) {
    return NextResponse.json({ error: "Character id required" }, { status: 400 });
  }

  // Only delete if user owns it
  const { error } = await supabase
    .from("chat_characters")
    .delete()
    .eq("id", characterId)
    .eq("user_id", session.user.id);

  if (error) {
    return NextResponse.json({ error: "Failed to delete character" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
