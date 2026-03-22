import { NextRequest } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import { createClient } from "@supabase/supabase-js";
import { isVipEmail } from "./plans";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getSecret() {
  return new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);
}

export interface MobileSession {
  user: {
    id: string;
    email: string;
    name: string;
    plan: "Free" | "Pro" | "Plus";
    messagesUsedToday: number;
    isNewUser: boolean;
    onboardingComplete: boolean;
    whatsNewSeen: boolean;
    createdAt: string;
    timezone: string;
    totalMessages: number;
    subscriptionStatus?: string;
    currentPeriodEnd?: string;
    isDeleted?: boolean;
  };
}

/**
 * Sign a mobile JWT token for a user
 */
export async function signMobileToken(
  userId: string,
  email: string
): Promise<string> {
  return new SignJWT({ sub: userId, email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

/**
 * Verify a mobile JWT token
 */
export async function verifyMobileToken(
  token: string
): Promise<{ sub: string; email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.sub || !payload.email) return null;
    return { sub: payload.sub, email: payload.email as string };
  } catch {
    return null;
  }
}

/**
 * Get session from request — tries cookies first (web), falls back to Bearer token (mobile).
 * Drop-in replacement for getServerSession(authOptions).
 */
export async function getSessionFromRequest(
  req: NextRequest
): Promise<MobileSession | null> {
  // 1. Try cookie-based session first (web app)
  // Read NextAuth JWT directly from cookie (works reliably in App Router)
  const sessionToken =
    req.cookies.get("__Secure-next-auth.session-token")?.value ||
    req.cookies.get("next-auth.session-token")?.value;

  if (sessionToken) {
    try {
      const { payload } = await jwtVerify(sessionToken, getSecret(), {
        algorithms: ["HS256"],
      });
      if (payload?.id || payload?.sub) {
        const userId = (payload.id || payload.sub) as string;
        // Fetch fresh user data (same as mobile path below)
        return await fetchUserSession(userId);
      }
    } catch {
      // Invalid/expired cookie — fall through to Bearer token
    }
  }

  // 2. Fall back to Bearer token (mobile app)
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7);
  const payload = await verifyMobileToken(token);
  if (!payload?.sub) {
    return null;
  }

  return await fetchUserSession(payload.sub);
}

/**
 * Fetch fresh user data from database and build session object.
 * Shared by both cookie-based (web) and Bearer token (mobile) auth paths.
 */
async function fetchUserSession(userId: string): Promise<MobileSession | null> {
  const { data: user, error } = await supabase
    .from("users")
    .select(
      "id, email, name, plan, messages_used_today, total_messages, is_new_user, onboarding_complete, whats_new_seen, created_at, timezone, reset_timezone, last_reset_date, subscription_status, current_period_end, force_logout"
    )
    .eq("id", userId)
    .single();

  if (error || !user) {
    return null;
  }

  // Check force logout
  if (user.force_logout) {
    await supabase
      .from("users")
      .update({ force_logout: false })
      .eq("id", user.id);
    return null;
  }

  // Determine effective plan (VIP override)
  let plan = (user.plan || "Free") as "Free" | "Pro" | "Plus";
  if (isVipEmail(user.email)) {
    plan = "Plus";
  }

  // Handle daily message reset
  let messagesUsedToday = user.messages_used_today;
  const resetTimezone = user.reset_timezone || user.timezone || "UTC";
  const now = new Date();

  try {
    const currentDateStr = now.toLocaleDateString("en-CA", {
      timeZone: resetTimezone,
    });
    const lastResetStr = user.last_reset_date
      ? new Date(user.last_reset_date).toLocaleDateString("en-CA", {
          timeZone: resetTimezone,
        })
      : null;

    const isNewDay = !lastResetStr || currentDateStr !== lastResetStr;
    if (isNewDay && messagesUsedToday > 0) {
      await supabase
        .from("users")
        .update({
          messages_used_today: 0,
          last_reset_date: new Date().toISOString(),
        })
        .eq("id", user.id);
      messagesUsedToday = 0;
    }
  } catch {
    // Timezone error — keep existing count
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      plan,
      messagesUsedToday,
      isNewUser: user.is_new_user || false,
      onboardingComplete: user.onboarding_complete ?? false,
      whatsNewSeen: user.whats_new_seen || false,
      createdAt: user.created_at || "",
      timezone: user.timezone || "UTC",
      totalMessages: user.total_messages || 0,
      subscriptionStatus: user.subscription_status || undefined,
      currentPeriodEnd: user.current_period_end || undefined,
    },
  };
}
