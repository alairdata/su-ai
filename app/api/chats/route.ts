import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Load all chats for the user
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: chats, error } = await supabase
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
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .order("created_at", { referencedTable: "messages", ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ chats });
}

// POST - Create a new chat
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { title } = await req.json();

  const { data: chat, error } = await supabase
    .from("chats")
    .insert({
      user_id: session.user.id,
      title: title || "New Chat"
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ chat });
}