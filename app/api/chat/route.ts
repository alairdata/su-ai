import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { webSearch, formatSearchResults } from "@/lib/search";
import { getEffectivePlan, getPlanLimit } from "@/lib/plans";

// SECURITY: Sanitize title to prevent XSS and prompt injection artifacts
function sanitizeTitle(title: string): string {
  return title
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove script-like content
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    // Remove quotes that might break JSON
    .replace(/["""''`]/g, '')
    // Remove control characters
    .replace(/[\x00-\x1F\x7F]/g, '')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50);
}

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

// System prompt loaded from environment variable for security
const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT || "You are a helpful AI assistant.";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "Please log in to use the chat." },
        { status: 401 }
      );
    }

    // Query DB for actual user data - don't trust JWT session alone
    const { data: dbUser, error: userError } = await supabase
      .from("users")
      .select("plan, messages_used_today, email")
      .eq("id", session.user.id)
      .single();

    if (userError || !dbUser) {
      console.error("Failed to fetch user:", userError);
      return NextResponse.json(
        { error: "User not found." },
        { status: 404 }
      );
    }

    // Get effective plan (checks VIP status from DB email)
    const userPlan = getEffectivePlan(dbUser.plan, dbUser.email);
    const dailyLimit = getPlanLimit(userPlan);

    // SECURITY: Atomic increment to prevent race condition
    // This increments AND returns the new count in one operation
    const { data: incrementResult, error: incrementError } = await supabase
      .rpc('increment_messages_used_today', {
        user_id_param: session.user.id,
        daily_limit: dailyLimit
      });

    // If increment failed or limit exceeded, reject the request
    if (incrementError) {
      console.error("Failed to increment message count:", incrementError);
      return NextResponse.json(
        { error: "Unable to verify message limit. Please try again." },
        { status: 500 }
      );
    }

    if (incrementResult === false) {
      // RPC returned false = limit exceeded
      return NextResponse.json(
        {
          error: `Daily message limit reached (${dailyLimit} messages). Please upgrade your plan for more messages.`,
          limitReached: true,
          plan: userPlan,
          limit: dailyLimit
        },
        { status: 429 }
      );
    }

    // Message count already incremented atomically above

    const body = await req.json();
    const userMessage: string = body.message || "";
    const chatId: string = body.chatId;
    const isRegenerate: boolean = body.regenerate || false;
    const regenerateFromIndex: number | undefined = body.regenerateFromIndex;
    const editFromMessageIndex: number | undefined = body.editFromMessageIndex;

    if (!userMessage.trim()) {
      return NextResponse.json(
        { error: "No message provided." },
        { status: 400 }
      );
    }

    // SECURITY: Validate message length to prevent oversized requests
    const MAX_MESSAGE_LENGTH = 32000;
    if (userMessage.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters allowed.` },
        { status: 400 }
      );
    }

    // SECURITY: Validate chatId format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!chatId || !uuidRegex.test(chatId)) {
      return NextResponse.json(
        { error: "Invalid chat ID." },
        { status: 400 }
      );
    }

    // Get chat and messages
    const { data: chat } = await supabase
      .from("chats")
      .select(`
        id,
        user_id,
        messages (id, role, content, created_at)
      `)
      .eq("id", chatId)
      .order("created_at", { referencedTable: "messages", ascending: true })
      .single();

    if (!chat || chat.user_id !== session.user.id) {
      return NextResponse.json(
        { error: "Chat not found." },
        { status: 404 }
      );
    }

    let allMessages = (chat.messages as Array<{ id: string; role: "user" | "assistant"; content: string; created_at: string }>) || [];

    // Handle regenerate: delete messages from the specified index onwards
    // SECURITY: Only delete messages that belong to this chat (verified by chat ownership above)
    if (isRegenerate && regenerateFromIndex !== undefined) {
      const messagesToDelete = allMessages.slice(regenerateFromIndex + 1);
      if (messagesToDelete.length > 0) {
        const idsToDelete = messagesToDelete.map(m => m.id);
        // SECURITY: Add chat_id check to prevent cross-chat message deletion
        await supabase.from("messages").delete().in("id", idsToDelete).eq("chat_id", chatId);
      }
      // Keep only messages up to and including the user message
      allMessages = allMessages.slice(0, regenerateFromIndex + 1);
    }

    // Handle edit: delete messages from the specified index onwards, then add the new message
    // SECURITY: Only delete messages that belong to this chat (verified by chat ownership above)
    if (editFromMessageIndex !== undefined) {
      const messagesToDelete = allMessages.slice(editFromMessageIndex);
      if (messagesToDelete.length > 0) {
        const idsToDelete = messagesToDelete.map(m => m.id);
        // SECURITY: Add chat_id check to prevent cross-chat message deletion
        await supabase.from("messages").delete().in("id", idsToDelete).eq("chat_id", chatId);
      }
      // Keep only messages before the edited message
      allMessages = allMessages.slice(0, editFromMessageIndex);
    }

    const isFirstMessage = allMessages.length === 0;

    // SECURITY: Save user message and AWAIT to prevent data loss
    if (!isRegenerate) {
      const { error: msgError } = await supabase.from("messages").insert({
        chat_id: chatId,
        role: "user",
        content: userMessage,
        user_email: dbUser.email,
      });
      if (msgError) {
        console.error("Failed to save user message:", msgError);
        return NextResponse.json({ error: "Failed to save message" }, { status: 500 });
      }
    }

    // Build messages for API
    // For regenerate: the user message is already in allMessages, don't duplicate
    // For new/edit: add the new user message
    const apiMessages: Anthropic.MessageParam[] = isRegenerate
      ? allMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))
      : [
          ...allMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
          { role: "user" as const, content: userMessage }
        ];

    // Track full response for saving to database
    let fullResponse = "";
    const userId = session.user.id;

    const encoder = new TextEncoder();

    // Track all message segments (for when search splits the response)
    const messageSegments: string[] = [];

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          let currentMessages = [...apiMessages];
          let continueLoop = true;
          let currentSegment = "";

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
                  currentSegment += delta.text;
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
                  // Save the pre-search content as a separate segment
                  if (currentSegment.trim()) {
                    messageSegments.push(currentSegment);
                    // Signal frontend to finalize this message (no action buttons)
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ finalizeMessage: true })}\n\n`));
                  }

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

                  // Reset for next iteration - start new message segment
                  toolUseBlock = null;
                  currentToolInput = "";
                  currentSegment = "";

                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ searching: false, newMessage: true })}\n\n`));
                } else {
                  // No tool use, we're done - save final segment
                  if (currentSegment.trim()) {
                    messageSegments.push(currentSegment);
                  }
                  continueLoop = false;
                }
              }
            }
          }

          // Stream complete - save to database in background
          // Save each message segment separately
          const savePromises: PromiseLike<unknown>[] = [];

          for (const segment of messageSegments) {
            if (segment.trim()) {
              savePromises.push(
                supabase.from("messages").insert({
                  chat_id: chatId,
                  role: "assistant",
                  content: segment,
                }).then(() => {})
              );
            }
          }

          // SECURITY: Message count already incremented atomically at request start
          // Only increment total_messages here
          savePromises.push(
            supabase.rpc('increment_total_messages', { user_id_param: userId }).then(() => {}),
          );

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

              // SECURITY: Sanitize AI-generated title to prevent XSS
              const rawTitle = titleResponse.content
                .map((block) => ("text" in block ? block.text : ""))
                .join("")
                .trim();
              const generatedTitle = sanitizeTitle(rawTitle);

              savePromises.push(
                supabase.from("chats").update({ title: generatedTitle }).eq("id", chatId).then(() => {})
              );

              // Send title in stream
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ title: generatedTitle })}\n\n`));
            } catch {
              // Fallback title - also sanitize user message
              const fallbackTitle = sanitizeTitle(
                userMessage.length > 30 ? userMessage.substring(0, 30) + "..." : userMessage
              );
              savePromises.push(
                supabase.from("chats").update({ title: fallbackTitle }).eq("id", chatId).then(() => {})
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
