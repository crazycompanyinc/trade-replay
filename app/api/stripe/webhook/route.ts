import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature") || "";
  
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ received: true });
  }
  
  try {
    const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
    const event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        if (userId) {
          await prisma.subscription.upsert({
            where: { userId },
            update: {
              stripeCustomerId: session.customer,
              stripeSubscriptionId: session.subscription,
              status: "active",
            },
            create: {
              userId,
              stripeCustomerId: session.customer,
              stripeSubscriptionId: session.subscription,
              status: "active",
            },
          });
          await prisma.user.update({
            where: { id: userId },
            data: { tier: "STARTER" },
          });
        }
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object;
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: {
            status: sub.status,
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
            cancelAtPeriodEnd: sub.cancel_at_period_end,
          },
        });
        break;
      }
    }
    
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ received: true });
  }
}
