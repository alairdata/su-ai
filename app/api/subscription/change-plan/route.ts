import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { createClient } from "@supabase/supabase-js";
import { stripe, PLAN_CONFIG } from "@/lib/stripe";

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

    const { newPlan, action } = await req.json();

    if (!["Pro", "Plus"].includes(newPlan)) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    // Get user's current subscription info
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, plan, stripe_subscription_id, stripe_customer_id, current_period_end")
      .eq("id", session.user.id)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // If no active subscription, they need to go through checkout
    if (!user.stripe_subscription_id) {
      return NextResponse.json({
        error: "No active subscription",
        redirect: "checkout"
      }, { status: 400 });
    }

    const currentPlan = user.plan;
    const isUpgrade = (currentPlan === "Pro" && newPlan === "Plus");
    const isDowngrade = (currentPlan === "Plus" && newPlan === "Pro");

    if (currentPlan === newPlan) {
      return NextResponse.json({ error: "Already on this plan" }, { status: 400 });
    }

    // Get the new price ID
    const newPriceId = PLAN_CONFIG[newPlan as keyof typeof PLAN_CONFIG].stripePriceId;
    if (!newPriceId) {
      return NextResponse.json({ error: "Price not configured" }, { status: 500 });
    }

    // Get current subscription
    const subscription = await stripe.subscriptions.retrieve(user.stripe_subscription_id);

    if (isUpgrade) {
      // UPGRADE: Pro → Plus
      // Update subscription immediately with proration
      await stripe.subscriptions.update(
        user.stripe_subscription_id,
        {
          items: [{
            id: subscription.items.data[0].id,
            price: newPriceId,
          }],
          proration_behavior: 'always_invoice', // Charge the difference immediately
          metadata: {
            userId: user.id,
            plan: newPlan,
          },
        }
      );

      // Get updated subscription to get new period end
      const updatedSub = await stripe.subscriptions.retrieve(user.stripe_subscription_id);
      const periodEnd = (updatedSub as { current_period_end?: number }).current_period_end;

      // Update user in database
      await supabase
        .from("users")
        .update({
          plan: newPlan,
          current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        })
        .eq("id", user.id);

      return NextResponse.json({
        success: true,
        message: "Upgraded to Plus! You've been charged the prorated difference.",
        newPlan,
        immediate: true,
      });

    } else if (isDowngrade) {
      // DOWNGRADE: Plus → Pro
      // Schedule the change for end of billing period
      await stripe.subscriptions.update(
        user.stripe_subscription_id,
        {
          items: [{
            id: subscription.items.data[0].id,
            price: newPriceId,
          }],
          proration_behavior: 'none', // Don't prorate, just schedule
          billing_cycle_anchor: 'unchanged', // Change takes effect at next billing
          metadata: {
            userId: user.id,
            plan: newPlan,
            scheduledDowngrade: 'true',
          },
        }
      );

      // Update user to show pending downgrade
      await supabase
        .from("users")
        .update({
          subscription_status: 'downgrading',
        })
        .eq("id", user.id);

      const periodEnd = new Date(subscription.current_period_end * 1000);
      const formattedDate = periodEnd.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });

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
