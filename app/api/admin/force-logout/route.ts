import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(email => email.trim().toLowerCase())
  .filter(email => email.length > 0);

function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  if (ADMIN_EMAILS.length === 0) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

// POST - Force logout users (all or single user by userId)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { userId } = body;

  if (userId) {
    // Single user logout
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    const { error } = await supabase
      .from("users")
      .update({ force_logout: true })
      .eq("id", userId);

    if (error) {
      console.error("Failed to force logout user:", error);
      return NextResponse.json({ error: "Failed to force logout user" }, { status: 500 });
    }

    console.log('AUDIT: Force logout user', {
      timestamp: new Date().toISOString(),
      adminEmail: session.user.email,
      targetUserId: userId,
    });

    return NextResponse.json({ success: true });
  }

  // All users logout (exclude admins)
  const { error, count } = await supabase
    .from("users")
    .update({ force_logout: true })
    .not('email', 'in', `(${ADMIN_EMAILS.join(',')})`)
    .select('id', { count: 'exact', head: true });

  if (error) {
    console.error("Failed to force logout:", error);
    return NextResponse.json({ error: "Failed to force logout users" }, { status: 500 });
  }

  console.log('AUDIT: Force logout all users', {
    timestamp: new Date().toISOString(),
    adminEmail: session.user.email,
    usersAffected: count,
  });

  return NextResponse.json({ success: true, usersAffected: count });
}
