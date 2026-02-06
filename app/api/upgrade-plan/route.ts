import { NextResponse } from "next/server";

/**
 * SECURITY: This endpoint has been disabled.
 *
 * Plan upgrades should ONLY happen through:
 * 1. Payment webhooks (after successful payment verification)
 * 2. Admin panel (with audit logging)
 *
 * Direct plan upgrades without payment verification are a security risk.
 */
export async function POST() {
  console.error('SECURITY: Blocked attempt to use disabled /api/upgrade-plan endpoint');
  return NextResponse.json(
    { error: "This endpoint has been disabled. Please use the payment flow to upgrade." },
    { status: 403 }
  );
}