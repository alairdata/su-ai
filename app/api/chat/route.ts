import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// 🔴 YOUR CUSTOM PROMPT - KEPT EXACTLY AS YOU HAD IT
const SYSTEM_PROMPT = `
You're a no-nonsense AI that cuts through the crap. When the user sends a greeting, please be patient and respond honestly while adding a mix of fun relatability and analogies to it in addition to making an effort to understand exactly why a user is sending a message. Dissect it carefully and strategically: are they dragging a problem, worried about something, struggling, excited or simply exchanging pleasantries. When giving responses, think all factors of human life and advice accordingly, feel free to bring up terms from psychology to help them see the light of course in layman terms. It doesn't mean that you are a therapist, just a brutally honest and informed Ai that knows its stuff. Also use curse words when needed to drive your point home making your words hit hard. But keep it short and clear. No long speeches; get straight to the point. Being unfiltered doesn't mean being mean—be tough, but don't just attack.

In the end, your goal is to spark self-reflection and action. You might come off as harsh, but your aim is to light a fire under their asses with tough love. Be blunt and confrontational, and clearly recommend necessary changes—remind them complacency is a trap. When they deserve commendation, give it dramatically.

Foster self-awareness and urgency while holding them accountable. Be real and relentless—challenge them to step up and take charge of their lives. Never beat around the bush. Note: ensure proper paragraphing to hit the points home to the user.
`;

export async function POST(req: NextRequest) {
  try {
    // Check if user is authenticated
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { reply: "Please log in to use the chat." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const userMessage: string = body.message || "";
    const chatId: string = body.chatId;

    if (!userMessage.trim()) {
      return NextResponse.json(
        { reply: "No message provided." },
        { status: 400 }
      );
    }

    // Verify chat exists and belongs to user
    if (chatId) {
      const { data: chat } = await supabase
        .from("chats")
        .select("id, user_id")
        .eq("id", chatId)
        .single();

      if (!chat || chat.user_id !== session.user.id) {
        return NextResponse.json(
          { reply: "Chat not found." },
          { status: 404 }
        );
      }

      // Save user message to database
      await supabase
        .from("messages")
        .insert({
          chat_id: chatId,
          role: "user",
          content: userMessage,
        });

      // Get conversation history
      const { data: allMessages } = await supabase
        .from("messages")
        .select("role, content")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });

      // Call Claude with conversation history
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: allMessages || [{ role: "user", content: userMessage }],
      });

      const assistantMessage =
        response.content
          .map((block: any) => ("text" in block ? block.text : ""))
          .join(" ")
          .trim() || "No response from Claude.";

      // Save assistant response
      await supabase
        .from("messages")
        .insert({
          chat_id: chatId,
          role: "assistant",
          content: assistantMessage,
        });

      // Increment message count
      await supabase
        .from("users")
        .update({ 
          messages_used_today: session.user.messagesUsedToday + 1 
        })
        .eq("id", session.user.id);

      // Generate title if first message
      if (allMessages && allMessages.length === 1) {
        const title = userMessage.length > 30 
          ? userMessage.substring(0, 30) + "..." 
          : userMessage;
        
        await supabase
          .from("chats")
          .update({ title })
          .eq("id", chatId);
      }

      return NextResponse.json({ 
        reply: assistantMessage,
      });
    }

    // No chatId provided - simple response (shouldn't happen but safe fallback)
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const text =
      response.content
        .map((block: any) => ("text" in block ? block.text : ""))
        .join(" ")
        .trim() || "No response from Claude.";

    return NextResponse.json({ reply: text });

  } catch (error) {
    console.error("Error in /api/chat:", error);
    return NextResponse.json(
      { reply: "Something went wrong talking to Claude." },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ status: "ok" });
}