import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { rateLimit, getClientIP, rateLimitHeaders, RATE_LIMITS, getUserIPKey } from "@/lib/rate-limit";
import { sendMessageSchema, validateInput } from "@/lib/validations";
import { sanitizeErrorForClient } from "@/lib/env";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const PLAN_LIMITS: Record<string, number> = {
  Free: 10,
  Pro: 100,
  Plus: 300,
};

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limiting - 60 messages per minute per user
  const clientIP = getClientIP(req);
  const rateLimitKey = getUserIPKey(session.user.id, clientIP, 'messages');
  const rateLimitResult = rateLimit(rateLimitKey, RATE_LIMITS.messages);

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: rateLimitHeaders(rateLimitResult) }
    );
  }

  const body = await req.json();

  // Schema validation - type checks, length limits, UUID format
  const validation = validateInput(sendMessageSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { chatId, message } = validation.data;

  // Check message limits
  const limit = PLAN_LIMITS[session.user.plan];
  if (session.user.messagesUsedToday >= limit) {
    return NextResponse.json(
      { error: "Daily message limit reached" },
      { status: 429 }
    );
  }

  // Verify chat ownership
  const { data: chat, error: chatError } = await supabase
    .from("chats")
    .select("id")
    .eq("id", chatId)
    .eq("user_id", session.user.id)
    .single();

  if (chatError || !chat) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  // Save user message
  const { error: userMsgError } = await supabase
    .from("messages")
    .insert({
      chat_id: chatId,
      role: "user",
      content: message
    });

  if (userMsgError) {
    return NextResponse.json({ error: sanitizeErrorForClient(userMsgError) }, { status: 500 });
  }

  // Get all messages for context
  const { data: allMessages } = await supabase
    .from("messages")
    .select("role, content")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });

  // Call Claude API
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: allMessages || [{ role: "user", content: message }],
    });

    const assistantMessage = response.content[0].type === "text" 
      ? response.content[0].text 
      : "Sorry, I couldn't generate a response.";

    // Save assistant message
    await supabase
      .from("messages")
      .insert({
        chat_id: chatId,
        role: "assistant",
        content: assistantMessage
      });

    // Increment message count
    await supabase
      .from("users")
      .update({ 
        messages_used_today: session.user.messagesUsedToday + 1 
      })
      .eq("id", session.user.id);

    // Update chat title if it's the first message
    if (allMessages && allMessages.length === 1) {
      const title = await generateChatTitle(message);
      await supabase
        .from("chats")
        .update({ title })
        .eq("id", chatId);
    }

    return NextResponse.json({ 
      reply: assistantMessage,
      messagesUsedToday: session.user.messagesUsedToday + 1
    });
  } catch (error) {
    console.error("Claude API error:", error);
    return NextResponse.json(
      { error: "Failed to get AI response" },
      { status: 500 }
    );
  }
}

// Improved chat title generation using AI
async function generateChatTitle(firstMessage: string): Promise<string> {
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 50,
      messages: [{
        role: "user",
        content: `Generate a short, descriptive title (3-6 words) for a conversation that starts with: "${firstMessage}". 
        Respond with ONLY the title, no quotes or explanation.`
      }],
    });

    const title = response.content[0].type === "text" 
      ? response.content[0].text.trim() 
      : "New Chat";

    return title.length > 50 ? title.substring(0, 50) + "..." : title;
  } catch {
    // Fallback to simple heuristic
    return firstMessage.length > 30 
      ? firstMessage.substring(0, 30) + "..." 
      : firstMessage;
  }
}