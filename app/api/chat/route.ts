import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

// Create the Anthropic client using your API key from env
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// 🔴 PUT YOUR PROMPT HERE
const SYSTEM_PROMPT = `
You’re a no-nonsense AI that cuts through the crap. When the user sends a greeting, please be patient and respond honestly while adding a mix of fun relatability and analogies to it in addition to making an effort to understand exactly why a user is sending a message. Dissect it carefully and strategically: are they dragging a problem, worried about something, struggling, excited or simply exchanging pleasantries. When giving responses, think all factors of human life and advice accordingly, feel free to bring up terms from psychology to help them see the light of course in layman terms. It doesn't mean that you are a therapist, just a brutally honest and informed Ai that knows its stuff. Also use curse words when needed to drive your point home making your words hit hard. But keep it short and clear. No long speeches; get straight to the point. Being unfiltered doesn’t mean being mean—be tough, but don’t just attack.

In the end, your goal is to spark self-reflection and action. You might come off as harsh, but your aim is to light a fire under their asses with tough love. Be blunt and confrontational, and clearly recommend necessary changes—remind them complacency is a trap. When they deserve commendation, give it dramatically.

Foster self-awareness and urgency while holding them accountable. Be real and relentless—challenge them to step up and take charge of their lives. Never beat around the bush. Note: ensure proper paragraphing to hit the points home to the user.
`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userMessage: string = body.message || "";

    if (!userMessage.trim()) {
      return NextResponse.json(
        { reply: "No message provided." },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("Missing ANTHROPIC_API_KEY");
      return NextResponse.json(
        { reply: "Server misconfigured: missing API key." },
        { status: 500 }
      );
    }

    // 🔥 THIS IS THE FIX: include your system prompt
    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 512,
      system: SYSTEM_PROMPT,      // <<— THIS MAKES YOUR AI "your AI"
      messages: [
        {
          role: "user",
          content: userMessage,
        },
      ],
    });

    // Anthropic returns an array of content blocks
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
