import { Competition, Order, ShopOrder, Ticket } from "@oc/api-db/models";
import dbConnect from "@oc/api-infra/db";
import {
  sendOrderConfirmationEmail,
  type OrderEmailItem,
} from "@oc/api-server/lib/orders";
import { sendShopOrderConfirmationEmail } from "@oc/api-shop/email";

const MAX_ATTEMPTS = 5;
const LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
const BATCH_SIZE = 25;

export type RetryOrderConfirmationEmailsSummary = {
  checkedAt: string;
  candidates: number;
  shopCandidates: number;
  sent: number;
  failed: number;
  skipped: number;
};

async function buildEmailItems(orderId: string): Promise<OrderEmailItem[]> {
  const tickets = await Ticket.find({
    orderId,
    status: "sold",
  })
    .select("competitionId ticketNumber")
    .lean();

  if (tickets.length === 0) return [];

  const compIds = [...new Set(tickets.map((t) => t.competitionId.toString()))];
  const competitions = await Competition.find({ _id: { $in: compIds } })
    .select("title ticketPrice")
    .lean();
  const titleById = new Map(competitions.map((c) => [c._id.toString(), c.title ?? "Competition"]));
  const priceById = new Map(
    competitions.map((c) => [c._id.toString(), Number(c.ticketPrice) || 0])
  );

  const byComp = new Map<string, number[]>();
  for (const t of tickets) {
    const cid = t.competitionId.toString();
    const list = byComp.get(cid) ?? [];
    list.push(t.ticketNumber);
    byComp.set(cid, list);
  }

  const items: OrderEmailItem[] = [];
  for (const [competitionId, numbers] of byComp) {
    const unitPrice = priceById.get(competitionId) ?? 0;
    const qty = numbers.length;
    items.push({
      competitionTitle: titleById.get(competitionId) ?? "Competition",
      quantity: qty,
      unitPrice,
      ticketNumbers: numbers.sort((a, b) => a - b),
      totalPrice: unitPrice * qty,
    });
  }
  return items;
}

export async function runRetryOrderConfirmationEmails(): Promise<RetryOrderConfirmationEmailsSummary> {
  const now = new Date();
  const since = new Date(now.getTime() - LOOKBACK_MS);

  await dbConnect();

  const candidates = await Order.find({
    status: "completed",
    createdAt: { $gte: since },
    "metadata.confirmationEmailSentAt": { $exists: false },
    $or: [
      { "metadata.confirmationEmailAttempts": { $exists: false } },
      { "metadata.confirmationEmailAttempts": { $lt: MAX_ATTEMPTS } },
    ],
  })
    .sort({ createdAt: 1 })
    .limit(BATCH_SIZE)
    .lean();

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const order of candidates) {
    const orderId = order._id.toString();
    const userId = order.userId.toString();
    const metadata = (order.metadata ?? {}) as Record<string, unknown>;
    const payload = metadata.confirmationEmailPayload as
      | {
          items?: OrderEmailItem[];
          subtotal?: number;
          discount?: number;
          total?: number;
          orderNumber?: number;
          orderDate?: string;
          orderEmail?: string;
          isGuest?: boolean;
        }
      | undefined;

    let items = payload?.items;
    if (!items?.length) {
      items = await buildEmailItems(orderId);
    }
    if (!items.length) {
      skipped++;
      continue;
    }

    try {
      await sendOrderConfirmationEmail({
        userId,
        orderId,
        orderNumber: payload?.orderNumber ?? order.orderNumber,
        orderDate:
          payload?.orderDate ??
          order.createdAt.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          }),
        items,
        subtotal: payload?.subtotal ?? order.subtotal,
        discount: payload?.discount ?? order.discountAmount,
        total: payload?.total ?? order.total,
        isGuest: payload?.isGuest ?? order.isGuestCheckout,
        orderEmail: payload?.orderEmail ?? order.orderEmail,
      });
      sent++;
    } catch {
      failed++;
    }
  }

  const shopCandidates = await ShopOrder.find({
    status: "paid",
    createdAt: { $gte: since },
    "metadata.confirmationEmailSentAt": { $exists: false },
    $or: [
      { "metadata.confirmationEmailAttempts": { $exists: false } },
      { "metadata.confirmationEmailAttempts": { $lt: MAX_ATTEMPTS } },
    ],
  })
    .sort({ createdAt: 1 })
    .limit(BATCH_SIZE)
    .lean();

  for (const shopOrder of shopCandidates) {
    try {
      await sendShopOrderConfirmationEmail(shopOrder);
      sent++;
    } catch {
      failed++;
    }
  }

  return {
    checkedAt: now.toISOString(),
    candidates: candidates.length,
    shopCandidates: shopCandidates.length,
    sent,
    failed,
    skipped,
  };
}
