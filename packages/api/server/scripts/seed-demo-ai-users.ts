/**
 * Creates demo1@oc.com … demo5@oc.com with password Demo123@ and completed orders + tickets.
 * Does NOT run the AI planner.
 *
 * From repo root:
 *   set -a && source apps/admin/.env.local && set +a
 *   export APP_URL="${NEXT_PUBLIC_FRONTEND_URL:-http://localhost:4555}"
 *   cd packages/api/server && bun run scripts/seed-demo-ai-users.ts
 */
import { randomBytes } from "node:crypto";
import { Competition, Order, OrderItem, Profile, Ticket } from "@oc/api-db/models";
import dbConnect from "@oc/api-infra/db";
import { getItemsFromOrder, processOrderFulfillment } from "@oc/api-payment-core";
import { buildFulfillmentDeps } from "@oc/api-server/lib/payment/build-fulfillment-deps";
import { createPendingCheckoutOrder } from "@oc/api-tickets/create-session";
import { countByStatus, provisionTickets } from "@oc/api-tickets/ticket-service";
import { getClientAuth } from "@oc/auth-admin/client-auth";
import { Types } from "mongoose";

const PASSWORD = "Demo123@";
const DEMO_EMAILS = [
  "demo1@oc.com",
  "demo2@oc.com",
  "demo3@oc.com",
  "demo4@oc.com",
  "demo5@oc.com",
];

type PurchaseLine = { competitionId: string; quantity: number };

async function ensureDemoUser(email: string, index: number): Promise<string> {
  const auth = await getClientAuth();
  const ctx = await auth.$context;
  const normalized = email.trim().toLowerCase();

  let existing = await ctx.internalAdapter.findUserByEmail(normalized, { includeAccounts: true });
  let userId = existing?.user?.id;

  if (!userId) {
    const name = `Demo User ${index + 1}`;
    await auth.api.signUpEmail({
      body: {
        email: normalized,
        password: PASSWORD,
        name,
        firstName: `Demo${index + 1}`,
        lastName: "Tester",
      },
    });
    existing = await ctx.internalAdapter.findUserByEmail(normalized, { includeAccounts: true });
    userId = existing?.user?.id;
    if (!userId) throw new Error(`Failed to create user ${normalized}`);
  }

  await ctx.internalAdapter.updateUser(userId, { emailVerified: true });
  await Profile.findByIdAndUpdate(
    userId,
    {
      $set: {
        email: normalized,
        isVerified: true,
        marketingConsent: true,
        isGuestCheckout: false,
        country: "GB",
      },
    },
    { upsert: true }
  );

  const account = existing?.accounts?.find((a) => a.providerId === "credential");
  if (account) {
    const hashed = await ctx.password.hash(PASSWORD);
    await ctx.internalAdapter.updateAccount(account.id, { password: hashed });
  }

  return userId;
}

async function fulfillOrder(userId: string, lines: PurchaseLine[]): Promise<string> {
  if (lines.length === 0) throw new Error("No purchase lines");

  let subtotal = 0;
  const itemPayloads: Array<{
    competitionId: string;
    quantity: number;
    paidQty: number;
    answerIndex: number;
  }> = [];

  for (const line of lines) {
    const comp = await Competition.findById(line.competitionId).lean();
    if (!comp) throw new Error(`Competition ${line.competitionId} not found`);
    subtotal += (comp.ticketPrice ?? 0) * line.quantity;
    const answerIndex =
      comp.question && comp.correctAnswer != null ? comp.correctAnswer : 0;
    itemPayloads.push({
      competitionId: line.competitionId,
      quantity: line.quantity,
      paidQty: line.quantity,
      answerIndex,
    });
  }

  const sessionId = `demo_seed_${randomBytes(12).toString("hex")}`;
  const competitionIds = lines.map((l) => l.competitionId);

  const orderRecord = await createPendingCheckoutOrder({
    userId,
    items: itemPayloads,
    subtotal,
    discount: 0,
    providerSessionId: sessionId,
    provider: "local",
    idempotencyKey: sessionId,
  });

  const orderId = orderRecord._id.toString();
  const metadata = {
    competitionIds: competitionIds.join(","),
    items: JSON.stringify(itemPayloads),
    demoSeed: true,
  };

  await Order.findByIdAndUpdate(orderId, {
    status: "processing",
    paidAt: new Date(),
    metadata,
  });

  const deps = buildFulfillmentDeps({ sendEmails: false });
  await processOrderFulfillment({
    orderId,
    orderNumber: orderRecord.orderNumber,
    userId,
    competitionIds,
    items: getItemsFromOrder({ metadata }),
    subtotal,
    discountAmount: 0,
    total: subtotal,
    metadata,
    logPrefix: "DemoSeed",
    deps,
    referralBalanceUsed: 0,
  });

  await Order.findByIdAndUpdate(orderId, {
    status: "completed",
    fulfillmentStatus: "completed",
  });

  return orderId;
}

async function main() {
  await dbConnect();

  const candidates = await Competition.find({
    status: "active",
    drawDate: { $gte: new Date() },
    deletedAt: null,
  })
    .sort({ maxTickets: 1, displayOrder: 1 })
    .limit(15)
    .select("_id title category ticketPrice maxTickets status")
    .lean();

  const c: Array<{ id: string; title: string; category: string; available: number }> = [];
  for (const x of candidates) {
    const id = String(x._id);
    if (x.maxTickets > 0) {
      await provisionTickets(id, x.maxTickets);
    }
    const available = await countByStatus(id, "available", x.maxTickets);
    if (available >= 3) {
      c.push({
        id,
        title: x.title,
        category: x.category ?? "general",
        available,
      });
    }
    if (c.length >= 6) break;
  }

  if (c.length < 2) {
    throw new Error(
      "Need at least 2 active competitions with available tickets (>=3 each). Free up ticket inventory or add competitions."
    );
  }

  const purchasePlans: PurchaseLine[][] = [
    [{ competitionId: c[0]!.id, quantity: Math.min(3, c[0]!.available) }],
    [
      { competitionId: c[0]!.id, quantity: Math.min(2, c[0]!.available) },
      { competitionId: c[1]!.id, quantity: Math.min(3, c[1]!.available) },
    ],
    [{ competitionId: c[1]!.id, quantity: Math.min(3, c[1]!.available) }],
    c[2]
      ? [{ competitionId: c[2].id, quantity: Math.min(3, c[2].available) }]
      : [{ competitionId: c[0]!.id, quantity: 1 }],
    c.length >= 4
      ? [
          { competitionId: c[0]!.id, quantity: 1 },
          { competitionId: c[2]?.id ?? c[1]!.id, quantity: Math.min(2, c[2]?.available ?? c[1]!.available) },
          { competitionId: c[3]!.id, quantity: Math.min(3, c[3]!.available) },
        ]
      : [
          { competitionId: c[0]!.id, quantity: 2 },
          { competitionId: c[1]!.id, quantity: Math.min(3, c[1]!.available) },
        ],
  ];

  const summary: Array<{
    email: string;
    userId: string;
    orderId: string;
    tickets: number;
    orders: number;
    competitions: string[];
  }> = [];

  for (let i = 0; i < DEMO_EMAILS.length; i++) {
    const email = DEMO_EMAILS[i]!;
    const userId = await ensureDemoUser(email, i);
    const orderId = await fulfillOrder(userId, purchasePlans[i]!);

    const ticketCount = await Ticket.countDocuments({
      ownerId: new Types.ObjectId(userId),
      status: "sold",
    });
    const orderCount = await Order.countDocuments({
      userId: new Types.ObjectId(userId),
      status: "completed",
      deletedAt: null,
    });
    const items = await OrderItem.find({ orderId: new Types.ObjectId(orderId), deletedAt: null })
      .select("competitionId quantity ticketNumbers")
      .lean();

    summary.push({
      email,
      userId,
      orderId,
      tickets: ticketCount,
      orders: orderCount,
      competitions: items.map(
        (it) => `${String(it.competitionId)} x${it.quantity} (${it.ticketNumbers?.length ?? 0} nums)`
      ),
    });
  }

  console.log("\n=== Demo AI test users (password: Demo123@) ===\n");
  for (const row of summary) {
    console.log(row.email);
    console.log(`  userId: ${row.userId}`);
    console.log(`  completed orders: ${row.orders}, total tickets: ${row.tickets}`);
    console.log(`  latest order ${row.orderId}:`);
    for (const line of row.competitions) console.log(`    - ${line}`);
    console.log("");
  }

  console.log("Competitions used:");
  for (const comp of c.slice(0, 4)) {
    console.log(`  ${comp.id} | ${comp.category} | ${comp.title}`);
  }
  console.log("\nAI planner was NOT run. Ready for a manual planner run later.\n");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
