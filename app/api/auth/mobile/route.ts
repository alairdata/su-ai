import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcrypt";
import {
  signMobileToken,
  verifyMobileToken,
} from "@/lib/mobile-auth";
import { isVipEmail } from "@/lib/plans";
import {
  rateLimit,
  getClientIP,
  rateLimitHeaders,
} from "@/lib/rate-limit";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST - Mobile login (email/password) or token refresh
export async function POST(req: NextRequest) {
  const clientIP = getClientIP(req);

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const { action } = body;

  // Separate rate limits for login vs token refresh
  const isRefresh = action === "refresh";
  const rateLimitResult = rateLimit(
    isRefresh ? `mobile-refresh:${clientIP}` : `mobile-login:${clientIP}`,
    isRefresh
      ? { limit: 30, windowSeconds: 900 }   // 30 refreshes per 15 min
      : { limit: 10, windowSeconds: 900 }    // 10 logins per 15 min
  );

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429, headers: rateLimitHeaders(rateLimitResult) }
    );
  }

  // --- LOGIN ---
  if (action === "login") {
    const { email, password } = body;
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user exists
    const { data: user, error } = await supabase
      .from("users")
      .select(
        "id, email, name, password_hash, plan, messages_used_today, total_messages, is_new_user, onboarding_complete, whats_new_seen, created_at, timezone, subscription_status, current_period_end"
      )
      .eq("email", normalizedEmail)
      .single();

    if (error || !user) {
      // Check if pending verification
      const { data: pendingUser } = await supabase
        .from("pending_users")
        .select("email")
        .eq("email", normalizedEmail)
        .single();

      if (pendingUser) {
        return NextResponse.json(
          {
            error:
              "Please verify your email before logging in. Check your inbox.",
          },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // OAuth users have no password
    if (!user.password_hash) {
      return NextResponse.json(
        {
          error:
            "This account uses Google or GitHub sign-in. Please use that method.",
        },
        { status: 401 }
      );
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Generate token
    const token = await signMobileToken(user.id, user.email);

    // Determine effective plan
    let plan = user.plan || "Free";
    if (isVipEmail(user.email)) {
      plan = "Plus";
    }

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan,
        messagesUsedToday: user.messages_used_today,
        totalMessages: user.total_messages || 0,
        isNewUser: user.is_new_user || false,
        onboardingComplete: user.onboarding_complete ?? false,
        whatsNewSeen: user.whats_new_seen || false,
        createdAt: user.created_at || "",
        timezone: user.timezone || "UTC",
        subscriptionStatus: user.subscription_status || undefined,
        currentPeriodEnd: user.current_period_end || undefined,
      },
    });
  }

  // --- REFRESH ---
  if (action === "refresh") {
    const { token } = body;
    if (!token) {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 400 }
      );
    }

    const payload = await verifyMobileToken(token);
    if (!payload?.sub) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    // Fetch fresh user data
    const { data: user, error } = await supabase
      .from("users")
      .select(
        "id, email, name, plan, messages_used_today, total_messages, is_new_user, onboarding_complete, whats_new_seen, created_at, timezone, subscription_status, current_period_end, force_logout"
      )
      .eq("id", payload.sub)
      .single();

    if (error || !user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 401 }
      );
    }

    if (user.force_logout) {
      await supabase
        .from("users")
        .update({ force_logout: false })
        .eq("id", user.id);
      return NextResponse.json(
        { error: "Session invalidated. Please log in again." },
        { status: 401 }
      );
    }

    // Issue new token
    const newToken = await signMobileToken(user.id, user.email);

    let plan = user.plan || "Free";
    if (isVipEmail(user.email)) {
      plan = "Plus";
    }

    return NextResponse.json({
      token: newToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan,
        messagesUsedToday: user.messages_used_today,
        totalMessages: user.total_messages || 0,
        isNewUser: user.is_new_user || false,
        onboardingComplete: user.onboarding_complete ?? false,
        whatsNewSeen: user.whats_new_seen || false,
        createdAt: user.created_at || "",
        timezone: user.timezone || "UTC",
        subscriptionStatus: user.subscription_status || undefined,
        currentPeriodEnd: user.current_period_end || undefined,
      },
    });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
