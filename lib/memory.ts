import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export type MemoryCategory = "personal" | "preference" | "interest" | "context";

export type Memory = {
  id: string;
  content: string;
  category: MemoryCategory;
  source_chat_id: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * SHA-256 hash of normalized memory content for deduplication
 */
export function hashMemory(content: string): string {
  const normalized = content.toLowerCase().trim().replace(/\s+/g, " ");
  return createHash("sha256").update(normalized).digest("hex");
}

/**
 * Extract memories from a user-assistant exchange using Haiku.
 * Runs async after response streaming — zero latency impact.
 * Max 3 memories per exchange, each under 100 chars.
 */
export async function extractMemories(
  userId: string,
  chatId: string,
  userMessage: string,
  assistantResponse: string,
  existingMemories: Memory[]
): Promise<void> {
  try {
    const existingList = existingMemories.length > 0
      ? existingMemories.map((m) => `- ${m.content}`).join("\n")
      : "None yet.";

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: `You are a memory extraction system. Read this conversation and pick out ANY detail about the user worth remembering for future chats. Be aggressive — capture even small things.

ALREADY SAVED (skip these):
${existingList}

USER SAID:
${userMessage.slice(0, 1000)}

AI REPLIED:
${assistantResponse.slice(0, 500)}

WHAT TO CAPTURE:
- Name, nickname, or how they refer to themselves
- Location, country, city, timezone clues
- Job, profession, skills, what they're working on
- Age, gender, family, relationships
- Preferences, opinions, communication style
- Hobbies, interests, things they like or dislike
- Goals, plans, things they're trying to do
- Any personal detail — even if it seems small

WHAT TO SKIP:
- Generic questions with no personal info (e.g. "what's the weather like")
- Things already in the saved list above
- The AI's own statements or opinions

Max 3 memories. Each under 100 characters.

Format: category|fact
Categories: personal, preference, interest, context

Examples:
personal|Name is Pricilla
personal|Lives in Ghana
personal|Works as a developer
preference|Likes direct, blunt advice
interest|Building an AI chat app
context|Preparing for a product launch

Return ONLY memories (one per line) or NONE if truly nothing personal was shared:`
        }
      ],
    });

    console.log("[Memory] Haiku response:", response.content.map((b) => ("text" in b ? b.text : "")).join(""));

    const text = response.content
      .map((block) => ("text" in block ? block.text : ""))
      .join("")
      .trim();

    if (!text || text === "NONE") {
      console.log("[Memory] No memories extracted (NONE or empty)");
      return;
    }

    const lines = text.split("\n").filter((l) => l.includes("|")).slice(0, 3);

    for (const line of lines) {
      const pipeIndex = line.indexOf("|");
      if (pipeIndex === -1) continue;

      const category = line.slice(0, pipeIndex).trim().toLowerCase() as MemoryCategory;
      const content = line.slice(pipeIndex + 1).trim();

      if (!content || content.length > 100) continue;
      if (!["personal", "preference", "interest", "context"].includes(category)) continue;

      const hash = hashMemory(content);

      // Upsert — unique constraint on (user_id, embedding_hash) handles dedup
      const { error: upsertError } = await supabase.from("user_memories").upsert(
        {
          user_id: userId,
          content,
          category,
          source_chat_id: chatId,
          embedding_hash: hash,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,embedding_hash" }
      );
      if (upsertError) {
        console.error("[Memory] Failed to save memory:", upsertError, { content, category });
      } else {
        console.log("[Memory] Saved:", category, "|", content);
      }
    }
  } catch (error) {
    // Non-critical — log and move on, never block the user
    console.error("[Memory] Failed to extract memories:", error);
  }
}

/**
 * Fetch memories and format into a ~500 token block for system prompt injection.
 */
export async function getMemoriesForPrompt(userId: string): Promise<string> {
  try {
    const { data: memories, error } = await supabase
      .from("user_memories")
      .select("content, category")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(50);

    if (error || !memories || memories.length === 0) return "";

    const lines = memories.map((m) => `- ${m.content}`).join("\n");

    return `\n[What you know about this user — reference naturally, don't say "I remember"]:\n${lines}`;
  } catch {
    return "";
  }
}

/**
 * Get all memories for a user (for the settings UI).
 */
export async function getUserMemories(userId: string): Promise<Memory[]> {
  const { data, error } = await supabase
    .from("user_memories")
    .select("id, content, category, source_chat_id, created_at, updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[Memory] Failed to fetch user memories:", error);
    return [];
  }

  return data || [];
}

/**
 * Delete a specific memory.
 */
export async function deleteMemory(
  userId: string,
  memoryId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("user_memories")
    .delete()
    .eq("id", memoryId)
    .eq("user_id", userId); // Security: ensure ownership

  if (error) {
    console.error("[Memory] Failed to delete memory:", error);
    return false;
  }
  return true;
}

/**
 * Clear all memories for a user.
 */
export async function clearAllMemories(userId: string): Promise<boolean> {
  const { error } = await supabase
    .from("user_memories")
    .delete()
    .eq("user_id", userId);

  if (error) {
    console.error("[Memory] Failed to clear memories:", error);
    return false;
  }
  return true;
}
