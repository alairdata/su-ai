import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { webSearch, formatSearchResults } from "@/lib/search";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Web search tool definition
const tools: Anthropic.Tool[] = [
  {
    name: "web_search",
    description: "Search the web for current information, news, events, or any topic that requires up-to-date data. Use this when the user asks about recent events, current prices, live scores, weather, news, or anything that might have changed after your knowledge cutoff.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "The search query to look up on the web"
        }
      },
      required: ["query"]
    }
  }
];

// 🔴 YOUR CUSTOM PROMPT - KEPT EXACTLY AS YOU HAD IT
const SYSTEM_PROMPT = `
You're a no-nonsense AI that cuts through the crap. When the user sends a greeting, please be patient and respond honestly while adding a mix of fun relatability and analogies to it in addition to making an effort to understand exactly why a user is sending a message. Dissect it carefully and strategically: are they dragging a problem, worried about something, struggling, excited or simply exchanging pleasantries. When giving responses, think all factors of human life and advice accordingly, feel free to bring up terms from psychology to help them see the light of course in layman terms. It doesn't mean that you are a therapist, just a brutally honest and informed Ai that knows its stuff. Also use curse words when needed to drive your point home making your words hit hard. But keep it short and clear. No long speeches; get straight to the point. Being unfiltered doesn't mean being mean—be tough, but don't just attack.

In the end, your goal is to spark self-reflection and action. You might come off as harsh, but your aim is to light a fire under their asses with tough love. Be blunt and confrontational, and clearly recommend necessary changes—remind them complacency is a trap. When they deserve commendation, give it dramatically.

Foster self-awareness and urgency while holding them accountable. Be real and relentless—challenge them to step up and take charge of their lives. Never beat around the bush. Note: ensure proper paragraphing to hit the points home to the user.

You have access to a web_search tool. Use it when users ask about current events, news, prices, weather, sports scores, or anything that requires up-to-date information beyond your knowledge cutoff.
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

    const allMessages = (chat.messages as Array<{ role: "user" | "assistant"; content: string; created_at: string }>) || [];
    const isFirstMessage = allMessages.length === 0;

    // Save user message immediately (don't wait)
    supabase.from("messages").insert({
      chat_id: chatId,
      role: "user",
      content: userMessage,
    }).then(() => {});

    // Build messages for API
    const apiMessages: Anthropic.MessageParam[] = [
      ...allMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user" as const, content: userMessage }
    ];

    // Track full response for saving to database
    let fullResponse = "";
    const userId = session.user.id;
    const messagesUsedToday = session.user.messagesUsedToday;

    const encoder = new TextEncoder();

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          let currentMessages = [...apiMessages];
          let continueLoop = true;

          while (continueLoop) {
            const stream = await anthropic.messages.create({
              model: "claude-sonnet-4-20250514",
              max_tokens: 1024,
              stream: true,
              system: SYSTEM_PROMPT,
              tools: tools,
              messages: currentMessages,
            });

            let toolUseBlock: { id: string; name: string; input: Record<string, unknown> } | null = null;
            let currentToolInput = "";

            for await (const event of stream) {
              if (event.type === "content_block_start") {
                const block = event.content_block;
                if (block.type === "tool_use") {
                  toolUseBlock = { id: block.id, name: block.name, input: {} };
                }
              } else if (event.type === "content_block_delta") {
                const delta = event.delta as { type: string; text?: string; partial_json?: string };
                if (delta.type === "text_delta" && delta.text) {
                  fullResponse += delta.text;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: delta.text })}\n\n`));
                } else if (delta.type === "input_json_delta" && delta.partial_json) {
                  currentToolInput += delta.partial_json;
                }
              } else if (event.type === "content_block_stop") {
                if (toolUseBlock && currentToolInput) {
                  try {
                    toolUseBlock.input = JSON.parse(currentToolInput);
                  } catch {
                    toolUseBlock.input = {};
                  }
                }
              } else if (event.type === "message_stop") {
                // Check if we need to handle tool use
                if (toolUseBlock) {
                  // Send searching indicator
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ searching: true, query: toolUseBlock.input.query })}\n\n`));

                  // Execute the search
                  const searchQuery = (toolUseBlock.input.query as string) || "";
                  const searchResults = await webSearch(searchQuery);
                  const formattedResults = formatSearchResults(searchResults);

                  // Add assistant's tool use and tool result to messages
                  currentMessages = [
                    ...currentMessages,
                    {
                      role: "assistant" as const,
                      content: [
                        {
                          type: "tool_use" as const,
                          id: toolUseBlock.id,
                          name: toolUseBlock.name,
                          input: toolUseBlock.input
                        }
                      ]
                    },
                    {
                      role: "user" as const,
                      content: [
                        {
                          type: "tool_result" as const,
                          tool_use_id: toolUseBlock.id,
                          content: formattedResults
                        }
                      ]
                    }
                  ];

                  // Reset for next iteration
                  toolUseBlock = null;
                  currentToolInput = "";

                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ searching: false })}\n\n`));
                } else {
                  // No tool use, we're done
                  continueLoop = false;
                }
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
                .map((block) => ("text" in block ? block.text : ""))
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
