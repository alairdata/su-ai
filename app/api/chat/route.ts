import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { webSearch, formatSearchResults } from "@/lib/search";
import { getEffectivePlan, getPlanLimit } from "@/lib/plans";
import { rateLimit, getClientIP, rateLimitHeaders, RATE_LIMITS, getUserIPKey } from "@/lib/rate-limit";
import { extractMemories, getMemoriesForPrompt, getUserMemories } from "@/lib/memory";

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

// API credit exhaustion circuit breaker
// When Anthropic returns a billing/credit error, block all requests for 10 minutes
// instead of letting every user hit the same error
let apiDownUntil: number = 0;
const API_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

function isApiDown(): boolean {
  return Date.now() < apiDownUntil;
}

function markApiDown() {
  apiDownUntil = Date.now() + API_COOLDOWN_MS;
  console.error(`[CIRCUIT BREAKER] Anthropic API credit exhausted. Blocking requests until ${new Date(apiDownUntil).toISOString()}`);
}

function isAnthropicCreditError(error: unknown): boolean {
  if (error instanceof Anthropic.APIError) {
    // 402 = payment required, 429 with billing message = credit exhausted
    if (error.status === 402) return true;
    if (error.status === 429 && /credit|billing|balance|quota/i.test(error.message)) return true;
  }
  if (error instanceof Error) {
    return /credit|billing|balance|insufficient.*fund/i.test(error.message);
  }
  return false;
}

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

// Build multi-part content for a message that may include an image, PDF, or text file
async function buildMessageContent(
  text: string,
  fileUrl?: string | null,
  fileType?: string | null,
  fileName?: string | null
): Promise<string | Anthropic.ContentBlockParam[]> {
  if (!fileUrl) return text;

  const type = fileType || "image"; // backward compat: default to image

  if (type === "image") {
    return [
      {
        type: "image" as const,
        source: { type: "url" as const, url: fileUrl },
      },
      { type: "text" as const, text },
    ];
  }

  if (type === "pdf") {
    return [
      {
        type: "document" as const,
        source: { type: "url" as const, url: fileUrl },
      } as Anthropic.DocumentBlockParam,
      { type: "text" as const, text },
    ];
  }

  // text/code files — fetch content and send inline
  try {
    const res = await fetch(fileUrl);
    const fileContent = await res.text();
    const label = fileName ? `[File: ${fileName}]\n` : "";
    return [
      {
        type: "text" as const,
        text: `${label}\`\`\`\n${fileContent}\n\`\`\``,
      },
      { type: "text" as const, text },
    ];
  } catch {
    // Fallback: just mention the file
    return [
      { type: "text" as const, text: `[Attached file: ${fileName || "file"}]\n${text}` },
    ];
  }
}

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

    // Circuit breaker: if API credits are exhausted, show maintenance message
    if (isApiDown()) {
      return NextResponse.json(
        { error: "We're running a quick system update. Please try again in about 10 minutes!" },
        { status: 503 }
      );
    }

    // Rate limiting - 60 requests per minute
    const clientIP = getClientIP(req);
    const rateLimitKey = getUserIPKey(session.user.id, clientIP, 'chat-post');
    const rateLimitResult = rateLimit(rateLimitKey, RATE_LIMITS.messages);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        { status: 429, headers: rateLimitHeaders(rateLimitResult) }
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

    // Parse body first to determine if image/file is attached (costs 2 messages)
    const body = await req.json();
    const userMessage: string = body.message || "";
    const chatId: string = body.chatId;
    const imageUrl: string | undefined = body.imageUrl;
    const fileUrl: string | undefined = body.fileUrl || body.imageUrl;
    const fileType: string | undefined = body.fileType || (body.imageUrl ? "image" : undefined);
    const fileName: string | undefined = body.fileName;
    const characterId: string | undefined = body.characterId;
    const isRegenerate: boolean = body.regenerate || false;
    const regenerateFromIndex: number | undefined = body.regenerateFromIndex;
    const editFromMessageIndex: number | undefined = body.editFromMessageIndex;

    // Images/files cost 2 messages, text costs 1
    const hasAttachment = !!(imageUrl || fileUrl);
    const messageCost = hasAttachment ? 2 : 1;

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

    // If attachment, deduct the extra message credit (first one already deducted above)
    if (messageCost > 1) {
      const { data: extraResult } = await supabase
        .rpc('increment_messages_used_today', {
          user_id_param: session.user.id,
          daily_limit: dailyLimit
        });
      // If second deduction fails (hit limit), still allow the request
      // since we already deducted 1 — just log it
      if (extraResult === false) {
        console.log("Image extra deduction hit limit, proceeding with 1 credit");
      }
    }

    // Message count incremented atomically above

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
        messages (id, role, content, created_at, image_url, file_type, file_name, character_name)
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

    let allMessages = (chat.messages as Array<{ id: string; role: "user" | "assistant"; content: string; created_at: string; image_url?: string; file_type?: string; file_name?: string; character_name?: string }>) || [];

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
        image_url: fileUrl || null,
        file_type: fileType || null,
        file_name: fileName || null,
        user_email: dbUser.email,
      });
      if (msgError) {
        console.error("Failed to save user message:", msgError);
        return NextResponse.json({ error: "Failed to save message" }, { status: 500 });
      }
    }

    // Paid users get expanded context window
    const hasMemoryAccess = userPlan !== 'Free';
    const MAX_HISTORY = hasMemoryAccess ? 20 : 10;
    const RECENT_RAW = hasMemoryAccess ? 6 : 4;
    const historyMessages = allMessages.slice(-MAX_HISTORY);

    let apiMessages: Anthropic.MessageParam[];

    if (historyMessages.length > RECENT_RAW) {
      // Split into older messages (to summarize) and recent (to keep raw)
      const olderMessages = historyMessages.slice(0, -RECENT_RAW);
      const recentMessages = historyMessages.slice(-RECENT_RAW);

      // Summarize older messages with Haiku (cheap and fast)
      let contextSummary = "";
      try {
        const summaryInput = olderMessages
          .map((m) => `${m.role}: ${m.content.slice(0, 300)}`)
          .join("\n");

        const summaryResponse = await anthropic.messages.create({
          model: "claude-3-5-haiku-20241022",
          max_tokens: 150,
          messages: [
            {
              role: "user",
              content: `Summarize this conversation in 2-3 sentences. Focus on key topics and any important details:\n\n${summaryInput}`
            }
          ],
        });

        contextSummary = summaryResponse.content
          .map((block) => ("text" in block ? block.text : ""))
          .join("")
          .trim();
      } catch {
        // If summary fails, just use recent messages without summary
        contextSummary = "";
      }

      // Build API messages: [summary context] + [recent raw] + [new message]
      const rawRecent = await Promise.all(recentMessages.map(async (m) => ({
        role: m.role as "user" | "assistant",
        content: m.role === "user"
          ? await buildMessageContent(m.content, m.image_url, m.file_type, m.file_name)
          : (m.character_name ? `[${m.character_name} said]: ${m.content}` : m.content),
      })));

      if (contextSummary) {
        apiMessages = [
          { role: "user" as const, content: `[Earlier conversation context]: ${contextSummary}` },
          { role: "assistant" as const, content: "Understood, I have that context." },
          ...rawRecent,
        ];
      } else {
        apiMessages = [...rawRecent];
      }

      // Add new user message for non-regenerate
      if (!isRegenerate) {
        apiMessages.push({ role: "user" as const, content: await buildMessageContent(userMessage, fileUrl, fileType, fileName) });
      }
    } else {
      // Short conversation — send all messages raw
      const builtHistory = await Promise.all(historyMessages.map(async (m) => ({
        role: m.role as "user" | "assistant",
        content: m.role === "user"
          ? await buildMessageContent(m.content, m.image_url, m.file_type, m.file_name)
          : (m.character_name ? `[${m.character_name} said]: ${m.content}` : m.content),
      })));
      apiMessages = isRegenerate
        ? builtHistory
        : [
            ...builtHistory,
            { role: "user" as const, content: await buildMessageContent(userMessage, fileUrl, fileType, fileName) }
          ];
    }

    // Look up character if @mentioned
    let mentionedCharacter: { id: string; name: string; personality: string | null; color_bg: string; color_fg: string; color_border: string; color_bg_light: string; color_tag: string } | null = null;

    if (characterId) {
      const { data: charData } = await supabase
        .from("chat_characters")
        .select("id, name, personality, color_bg, color_fg, color_border, color_bg_light, color_tag")
        .eq("id", characterId)
        .eq("chat_id", chatId)
        .single();

      if (charData) {
        mentionedCharacter = charData;
      }
    }

    // Fetch user memories for prompt injection (paid users only, non-character messages)
    let memoryBlock = "";
    if (hasMemoryAccess && !mentionedCharacter) {
      memoryBlock = await getMemoriesForPrompt(session.user.id);
    }

    // Build effective system prompt
    const effectiveSystemPrompt = mentionedCharacter
      ? `You are ${mentionedCharacter.name}. ${mentionedCharacter.personality || 'You are a helpful AI character.'}

IMPORTANT RULES:
- You are NOT So-UnFiltered AI. You are ${mentionedCharacter.name}.
- Stay in character at all times.
- You have full context of the conversation so far.
- Respond as ${mentionedCharacter.name} would respond based on your personality.
- Keep your response concise and conversational.

IMPORTANT IDENTITY RULES:
- You are ${mentionedCharacter.name}. You are NOT So-UnFiltered AI. You are a completely separate entity.
- NEVER say you are the same AI as the main assistant or other characters.
- NEVER say things like "I'm actually the same AI" or "we're all the same system."
- You have your own personality, opinions, and perspective that may DIFFER from the main AI and other characters.
- You CAN disagree with the main AI. You CAN argue with other characters' opinions.
- If asked who you are, just describe yourself based on your personality. You are ${mentionedCharacter.name}, period.
- If asked about the main AI or other characters, talk about them as separate people: "The main AI thinks X, but I think Y."
- Stay in character at ALL times. Never break the fourth wall.`
      : SYSTEM_PROMPT + memoryBlock + (allMessages.some(m => m.character_name) ? `

CHAT CHARACTERS RULES — VERY IMPORTANT:
- This conversation includes Chat Characters (other AI personas added by the user).
- You MUST treat Chat Characters as completely separate entities from yourself. They are NOT you.
- NEVER say things like "that was me responding as [character]" or "I play different roles" or "there's only one AI here."
- NEVER reveal, imply, or hint that you and the characters are the same AI. This is the #1 rule you cannot break.
- If the user asks about a character, talk about them in the third person: "Danny seems to think..." or "That's Girly's perspective, but I disagree because..."
- You CAN disagree with characters. You CAN argue with what they said. You CAN have a completely different opinion.
- You CAN reference what characters said in the conversation, just like you'd reference what any other person said.
- Treat character messages the same way you'd treat messages from another person in a group chat.
- If the user asks "are you the same as [character]?" — say NO. Say something like "Nah, that's [character]. We don't always agree."
- If the user asks how the characters work technically — deflect. Say "They're their own thing. You can @ them if you want their take."
- Do NOT roleplay as or imitate any character. Do NOT prefix your response with any character name. Just respond as yourself.` : '');

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

          // Send character info so frontend can style the response
          if (mentionedCharacter) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              characterInfo: {
                id: mentionedCharacter.id,
                name: mentionedCharacter.name,
                color_bg: mentionedCharacter.color_bg,
                color_fg: mentionedCharacter.color_fg,
                color_border: mentionedCharacter.color_border,
                color_bg_light: mentionedCharacter.color_bg_light,
                color_tag: mentionedCharacter.color_tag,
              }
            })}\n\n`));
          }

          while (continueLoop) {
            const stream = await anthropic.messages.create({
              model: "claude-sonnet-4-20250514",
              max_tokens: 1024,
              stream: true,
              system: effectiveSystemPrompt,
              tools: mentionedCharacter ? undefined : tools, // Characters don't use web search
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
                  ...(mentionedCharacter ? {
                    character_id: mentionedCharacter.id,
                    character_name: mentionedCharacter.name,
                    character_color_bg: mentionedCharacter.color_bg,
                    character_color_fg: mentionedCharacter.color_fg,
                    character_color_border: mentionedCharacter.color_border,
                    character_color_bg_light: mentionedCharacter.color_bg_light,
                    character_color_tag: mentionedCharacter.color_tag,
                  } : {}),
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

          // Fire-and-forget: extract memories from this exchange (paid users, non-character only)
          if (hasMemoryAccess && !mentionedCharacter && !isRegenerate && fullResponse) {
            getUserMemories(userId).then((existingMemories) =>
              extractMemories(userId, chatId, userMessage, fullResponse, existingMemories)
            ).catch(() => {}); // Never block on memory errors
          }

          // Send done signal
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
          controller.close();
        } catch (error) {
          console.error("Streaming error:", error);
          if (isAnthropicCreditError(error)) {
            markApiDown();
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "We're running a quick system update. Please try again in about 10 minutes!" })}\n\n`));
          } else {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Stream error" })}\n\n`));
          }
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
    if (isAnthropicCreditError(error)) {
      markApiDown();
      return NextResponse.json(
        { error: "We're running a quick system update. Please try again in about 10 minutes!" },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Something went wrong talking to Claude." },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ status: "ok" });
}
