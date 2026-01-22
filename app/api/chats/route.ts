import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, getClientIP, rateLimitHeaders, RATE_LIMITS, getUserIPKey } from "@/lib/rate-limit";
import { createChatSchema, validateInput } from "@/lib/validations";
import { sanitizeErrorForClient } from "@/lib/env";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Load all chats for the user
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limiting - 30 requests per minute
  const clientIP = getClientIP(req);
  const rateLimitKey = getUserIPKey(session.user.id, clientIP, 'chats-get');
  const rateLimitResult = rateLimit(rateLimitKey, RATE_LIMITS.chats);

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: rateLimitHeaders(rateLimitResult) }
    );
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
    return NextResponse.json({ error: sanitizeErrorForClient(error) }, { status: 500 });
  }

  return NextResponse.json({ chats });
}

// POST - Create a new chat
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limiting - 30 chat creations per minute
  const clientIP = getClientIP(req);
  const rateLimitKey = getUserIPKey(session.user.id, clientIP, 'chats-post');
  const rateLimitResult = rateLimit(rateLimitKey, RATE_LIMITS.chats);

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: rateLimitHeaders(rateLimitResult) }
    );
  }

  const body = await req.json();

  // Schema validation
  const validation = validateInput(createChatSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { title } = validation.data;

  const { data: chat, error } = await supabase
    .from("chats")
    .insert({
      user_id: session.user.id,
      title
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: sanitizeErrorForClient(error) }, { status: 500 });
  }

  return NextResponse.json({ chat });
}