import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Admin emails - comma-separated in env var
// SECURITY: Do NOT fallback to VIP_EMAILS - admin access must be explicit
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(email => email.trim().toLowerCase())
  .filter(email => email.length > 0);

function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  if (ADMIN_EMAILS.length === 0) {
    console.error('SECURITY: ADMIN_EMAILS not configured!');
    return false;
  }
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

// POST - Update a user's plan (with audit logging)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    console.error('Admin plan update: Unauthorized attempt by', session?.user?.email || 'unknown');
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId, plan } = await req.json();

  if (!userId || !plan) {
    return NextResponse.json({ error: "Missing userId or plan" }, { status: 400 });
  }

  // SECURITY: Validate userId is a valid UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) {
    return NextResponse.json({ error: "Invalid user ID format" }, { status: 400 });
  }

  if (!["Free", "Pro", "Plus"].includes(plan)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  // Get current user data for audit log
  const { data: targetUser } = await supabase
    .from("users")
    .select("email, plan")
    .eq("id", userId)
    .single();

  const previousPlan = targetUser?.plan || 'Unknown';

  const { error } = await supabase
    .from("users")
    .update({ plan })
    .eq("id", userId);

  if (error) {
    console.error("Failed to update plan:", error);
    return NextResponse.json({ error: "Failed to update plan" }, { status: 500 });
  }

  // AUDIT LOG: Record all admin plan changes
  console.log('AUDIT: Admin plan change', {
    timestamp: new Date().toISOString(),
    adminEmail: session.user.email,
    targetUserId: userId,
    targetUserEmail: targetUser?.email || 'Unknown',
    previousPlan,
    newPlan: plan,
  });

  // SECURITY: Store audit log in database with error handling
  // This is critical for compliance - log errors but don't block the response
  const auditPromise = supabase
    .from("admin_audit_logs")
    .insert({
      admin_email: session.user.email,
      action: 'plan_change',
      target_user_id: userId,
      target_user_email: targetUser?.email,
      details: { previousPlan, newPlan: plan },
    });

  // Don't block response, but log any errors
  auditPromise.then(({ error: auditError }) => {
    if (auditError) {
      // CRITICAL: Audit log failed - this should alert monitoring
      console.error('CRITICAL: Failed to save admin audit log:', {
        error: auditError,
        adminEmail: session.user.email,
        action: 'plan_change',
        targetUserId: userId,
        timestamp: new Date().toISOString(),
      });
    }
  });

  return NextResponse.json({ success: true, plan });
}
