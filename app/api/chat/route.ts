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
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "Please log in to use the chat." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const userMessage: string = body.message || "";
    const chatId: string = body.chatId;

    if (!userMessage.trim()) {
      return NextResponse.json(
        { error: "No message provided." },
        { status: 400 }
      );
    }

    if (!chatId) {
      return NextResponse.json(
        { error: "No chat ID provided." },
        { status: 400 }
      );
    }

    // Get chat and messages
    const { data: chat } = await supabase
      .from("chats")
      .select(`
        id,
        user_id,
        messages (role, content, created_at)
      `)
      .eq("id", chatId)
      .single();

    if (!chat || chat.user_id !== session.user.id) {
      return NextResponse.json(
        { error: "Chat not found." },
        { status: 404 }
      );
    }

    const allMessages = (chat.messages as any[]) || [];
    const isFirstMessage = allMessages.length === 0;

    // Save user message immediately (don't wait)
    supabase.from("messages").insert({
      chat_id: chatId,
      role: "user",
      content: userMessage,
    }).then(() => {});

    // Create streaming response
    const stream = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      stream: true,
      system: SYSTEM_PROMPT,
      messages: [
        ...allMessages.map((m: any) => ({ role: m.role, content: m.content })),
        { role: "user", content: userMessage }
      ],
    });

    // Track full response for saving to database
    let fullResponse = "";
    const userId = session.user.id;
    const messagesUsedToday = session.user.messagesUsedToday;

    // Create a TransformStream to process the response
    const encoder = new TextEncoder();

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === "content_block_delta") {
              const delta = event.delta as any;
              if (delta.type === "text_delta" && delta.text) {
                fullResponse += delta.text;
                // Send each text chunk as SSE
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: delta.text })}\n\n`));
              }
            }
          }

          // Stream complete - save to database in background
          const savePromises = [
            supabase.from("messages").insert({
              chat_id: chatId,
              role: "assistant",
              content: fullResponse,
            }),
            supabase.from("users").update({
              messages_used_today: messagesUsedToday + 1
            }).eq("id", userId),
          ];

          // Generate title for first message (using Haiku for speed)
          if (isFirstMessage) {
            try {
              const titleResponse = await anthropic.messages.create({
                model: "claude-3-5-haiku-20241022",
                max_tokens: 30,
                messages: [
                  {
                    role: "user",
                    content: `Summarize this in 3-5 words for a chat title. No quotes, no punctuation. Just the title:\n\n"${userMessage}"`
                  }
                ],
              });

              const generatedTitle = titleResponse.content
                .map((block: any) => ("text" in block ? block.text : ""))
                .join("")
                .trim()
                .slice(0, 50);

              savePromises.push(
                supabase.from("chats").update({ title: generatedTitle }).eq("id", chatId)
              );

              // Send title in stream
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ title: generatedTitle })}\n\n`));
            } catch {
              // Fallback title
              const fallbackTitle = userMessage.length > 30
                ? userMessage.substring(0, 30) + "..."
                : userMessage;
              savePromises.push(
                supabase.from("chats").update({ title: fallbackTitle }).eq("id", chatId)
              );
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ title: fallbackTitle })}\n\n`));
            }
          }

          await Promise.all(savePromises);

          // Send done signal
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
          controller.close();
        } catch (error) {
          console.error("Streaming error:", error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Stream error" })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });

  } catch (error) {
    console.error("Error in /api/chat:", error);
    return NextResponse.json(
      { error: "Something went wrong talking to Claude." },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ status: "ok" });
}
