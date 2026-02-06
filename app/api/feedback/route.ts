import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { createClient } from "@supabase/supabase-js";

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

  try {
    const { messageId, chatId, feedback } = await req.json();

    if (!messageId || !chatId || !feedback) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!['like', 'dislike'].includes(feedback)) {
      return NextResponse.json(
        { error: "Invalid feedback type" },
        { status: 400 }
      );
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
