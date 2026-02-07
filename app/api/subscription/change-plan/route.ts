import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { createClient } from "@supabase/supabase-js";
import {
  chargeAuthorization,
  generateReference,
  getNextBillingDate,
  PLAN_CONFIG,
  usdToGhsPesewas,
  PlanType
} from "@/lib/paystack";
import { sendSubscriptionEmail } from "@/lib/email";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { newPlan } = await req.json();

    if (!["Pro", "Plus"].includes(newPlan)) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    // Get user's current subscription info
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, email, name, plan, subscription_status, current_period_end, paystack_authorization")
      .eq("id", session.user.id)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const currentPlan = user.plan;
    const isUpgrade = (currentPlan === "Pro" && newPlan === "Plus");
    const isDowngrade = (currentPlan === "Plus" && newPlan === "Pro");

    if (currentPlan === newPlan) {
      return NextResponse.json({ error: "Already on this plan" }, { status: 400 });
    }

    if (currentPlan === "Free") {
      // Need to go through checkout first
      return NextResponse.json({
        error: "No active subscription",
        redirect: "checkout"
      }, { status: 400 });
    }

    if (!user.paystack_authorization) {
      // Need to re-subscribe through checkout
      return NextResponse.json({
        error: "No payment method on file",
        redirect: "checkout"
      }, { status: 400 });
    }

    if (isUpgrade) {
      // UPGRADE: Pro → Plus
      // Charge the difference immediately
      const proDiff = PLAN_CONFIG.Plus.priceUSD - PLAN_CONFIG.Pro.priceUSD;

      // Calculate prorated amount based on days remaining
      const now = new Date();
      const periodEnd = new Date(user.current_period_end);
      const totalDays = 30;
      const daysRemaining = Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      const proratedAmount = (proDiff * daysRemaining) / totalDays;

      const amountToCharge = await usdToGhsPesewas(proratedAmount);
      const reference = generateReference(`upgrade_${user.id.slice(0, 8)}`);

      console.log('Upgrade charge:', {
        userId: user.id,
        from: currentPlan,
        to: newPlan,
        daysRemaining,
        proratedUSD: proratedAmount.toFixed(2),
        amountPesewas: amountToCharge,
      });

      // Only charge if there's a meaningful amount (more than ~$0.10)
      if (amountToCharge > 150) { // ~$0.10 in GHS
        const chargeResult = await chargeAuthorization({
          email: user.email,
          amount: amountToCharge,
          authorization_code: user.paystack_authorization,
          reference,
          metadata: {
            userId: user.id,
            plan: newPlan,
            type: 'upgrade',
            previousPlan: currentPlan,
          },
        });

        if (chargeResult.data.status !== 'success') {
          return NextResponse.json({
            error: "Failed to charge for upgrade. Please try again.",
          }, { status: 400 });
        }
      }

      // Update user plan immediately
      await supabase
        .from("users")
        .update({
          plan: newPlan,
          subscription_status: 'active', // Clear any canceling status
        })
        .eq("id", user.id);

      // Send upgrade email
      try {
        await sendSubscriptionEmail(
          user.email,
          user.name || 'there',
          newPlan,
          'upgraded'
        );
      } catch (emailError) {
        console.error('Failed to send upgrade email:', emailError);
      }

      return NextResponse.json({
        success: true,
        message: "Upgraded to Plus! You've been charged the prorated difference.",
        newPlan,
        immediate: true,
      });

    } else if (isDowngrade) {
      // DOWNGRADE: Plus → Pro
      // SECURITY: Schedule the change and record the target plan
      // This prevents manipulation of what plan to downgrade to
      await supabase
        .from("users")
        .update({
          subscription_status: 'downgrading',
          scheduled_plan: newPlan, // Track what plan to downgrade to
        })
        .eq("id", user.id);

      const periodEnd = new Date(user.current_period_end);
      const formattedDate = periodEnd.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });

      // Send downgrade email
      try {
        await sendSubscriptionEmail(
          user.email,
          user.name || 'there',
          newPlan,
          'downgraded',
          periodEnd.toISOString()
        );
      } catch (emailError) {
        console.error('Failed to send downgrade email:', emailError);
      }

      return NextResponse.json({
        success: true,
        message: `Your Plus subscription will remain active until ${formattedDate}. After that, you'll be on the Pro plan.`,
        newPlan,
        immediate: false,
        effectiveDate: periodEnd.toISOString(),
      });
    }

    return NextResponse.json({ error: "Invalid plan change" }, { status: 400 });

  } catch (error) {
    console.error("Error changing plan:", error);
    return NextResponse.json(
      { error: "Failed to change plan. Please try again." },
      { status: 500 }
    );
  }
}
