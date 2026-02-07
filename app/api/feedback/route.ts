import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { createClient } from "@supabase/supabase-js";
import { feedbackSchema, validateInput } from "@/lib/validations";
import { rateLimit, getClientIP, rateLimitHeaders, getUserIPKey } from "@/lib/rate-limit";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST - Submit feedback for a message
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limiting - 30 feedback submissions per minute
  const clientIP = getClientIP(req);
  const rateLimitKey = getUserIPKey(session.user.id, clientIP, 'feedback');
  const rateLimitResult = rateLimit(rateLimitKey, { limit: 30, windowSeconds: 60 });

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: rateLimitHeaders(rateLimitResult) }
    );
  }

  try {
    const body = await req.json();

    // Schema validation
    const validation = validateInput(feedbackSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { messageId, chatId, feedback } = validation.data;

    // SECURITY: Verify the chat belongs to this user before accepting feedback
    const { data: chat, error: chatError } = await supabase
      .from("chats")
      .select("id")
      .eq("id", chatId)
      .eq("user_id", session.user.id)
      .single();

    if (chatError || !chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    // SECURITY: Verify the message exists in this chat
    const { data: message, error: msgError } = await supabase
      .from("messages")
      .select("id")
      .eq("id", messageId)
      .eq("chat_id", chatId)
      .single();

    if (msgError || !message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Store feedback in database (upsert to handle updates)
    const { error } = await supabase
      .from("message_feedback")
      .upsert({
        user_id: session.user.id,
        message_id: messageId,
        chat_id: chatId,
        feedback_type: feedback,
        created_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,message_id'
      });

    if (error) {
      // If the table doesn't exist, just log it and return success
      // This allows the feature to work even without the database table
      console.log('Feedback received:', {
        userId: session.user.id,
        messageId,
        chatId,
        feedback,
        timestamp: new Date().toISOString()
      });

      // Don't fail if table doesn't exist
      if (error.code !== '42P01') {
        console.error('Error storing feedback:', error);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Feedback error:', error);
    return NextResponse.json(
      { error: "Failed to submit feedback" },
      { status: 500 }
    );
  }
}
