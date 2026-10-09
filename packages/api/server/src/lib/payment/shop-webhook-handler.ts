import type { IShopOrder } from "@oc/api-db/models";
import { ShopOrder, ShopProduct, ShopProductVariant } from "@oc/api-db/models";
import { CH, invalidateByChannelSafe } from "@oc/api-infra/cache";
import { createLogger } from "@oc/api-logger";
import type { StripeWebhookEvent } from "@oc/api-payment-stripe";
import { sendShopOrderConfirmationEmail } from "@oc/api-shop/email";
import { storePendingWebhook } from "./providers/_shared/pending-webhooks";
import type { WebhookResult } from "./providers/types";

const log = createLogger("shop-webhook");

/**
 * Fulfillment for Stripe `checkout.session.completed` events targeting the
 * shop (ShopOrder) flow. Delivered to the single unified webhook endpoint
 * (`POST /api/payments/webhook/stripe`) and routed here by event type.
 *
 * Never throws for unknown sessions: a `checkout.session.completed` can race
 * ahead of the order-lookup of the create request, so unmatched sessions are
 * parked in PendingWebhook (with the raw signature for replay) and
 * acknowledged with 200.
 */
export async function handleShopStripeWebhook(
  payload: string,
  event: StripeWebhookEvent,
  opts?: { signature?: string | null }
): Promise<WebhookResult> {
  const eventType = event.type;
  const data = event.data.object;
  const sessionId = typeof data.id === "string" ? data.id : "";
  const intentId =
    typeof data.payment_intent === "string" && data.payment_intent ? data.payment_intent : "";
  const paymentStatus = typeof data.payment_status === "string" ? data.payment_status : "";
  const clientReferenceId =
    typeof data.client_reference_id === "string" && data.client_reference_id
      ? data.client_reference_id
      : "";
  const metadata =
    data.metadata && typeof data.metadata === "object"
      ? (data.metadata as Record<string, unknown>)
      : {};
  const shopOrderId =
    (typeof metadata.shopOrderId === "string" && metadata.shopOrderId) ||
    (typeof metadata.orderId === "string" && metadata.orderId) ||
    "";

  const shopOrder = await claimShopOrder({
    clientReferenceId,
    shopOrderId,
    sessionId,
    intentId,
  });

  if (!shopOrder) {
    await storePendingWebhook({
      body: payload,
      provider: "stripe",
      orderId: null,
      eventId: event.id,
      signature: opts?.signature ?? null,
    });
    log.warn(
      `[shop-webhook] checkout.session.completed for unknown session ${sessionId || intentId} — parked as pending`
    );
    return { eventType, sessionId, status: "failed" };
  }

  const orderId = shopOrder._id.toString();

  if (paymentStatus && paymentStatus !== "paid") {
    log.info(
      `[shop-webhook] session ${sessionId} not yet paid (${paymentStatus}) — ack, no fulfillment`
    );
    return { eventType, sessionId, status: "pending", orderId };
  }

  if (shopOrder.status === "paid") {
    log.info(`[shop-webhook] shop order ${shopOrder.orderNumber} already paid — ack`);
    return { eventType, sessionId, status: "completed", orderId };
  }

  // Persist the sibling PaymentIntent id so payment_intent.succeeded and
  // status lookups can find this order too.
  if (intentId) {
    await ShopOrder.findByIdAndUpdate(shopOrder._id, {
      $set: { "metadata.stripePaymentIntentId": intentId },
    }).catch((err: unknown) => {
      log.error("[shop-webhook] failed to persist payment intent id:", err);
    });
  }

  await reduceInventoryFromOrder(shopOrder);

  shopOrder.status = "paid";
  shopOrder.paidAt = new Date();
  await shopOrder.save();

  await invalidateByChannelSafe(CH.shopProducts, CH.shopProduct, CH.shopCategories);
  void sendShopOrderConfirmationEmail(shopOrder).catch(() => {});

  log.info(`[shop-webhook] shop order ${shopOrder.orderNumber} paid via Stripe webhook`);
  return { eventType, sessionId, status: "completed", orderId };
}

async function claimShopOrder(params: {
  clientReferenceId: string;
  shopOrderId: string;
  sessionId: string;
  intentId: string;
}): Promise<IShopOrder | null> {
  const or: Array<Record<string, unknown>> = [];
  for (const id of [params.clientReferenceId, params.shopOrderId]) {
    if (id) {
      or.push(...(typeof id === "string" && /^[a-f\d]{24}$/i.test(id) ? [{ _id: id }] : []), {
        providerSessionId: id,
      });
    }
  }
  if (params.sessionId) or.push({ providerSessionId: params.sessionId });
  if (params.intentId) {
    or.push(
      { providerSessionId: params.intentId },
      { "metadata.stripePaymentIntentId": params.intentId }
    );
  }
  if (or.length === 0) return null;
  return ShopOrder.findOne({ $or: or });
}

export interface ShopOrderLike {
  items?: unknown;
}

/** Idempotently decrement tracked inventory for a ShopOrder's line items. */
export async function reduceInventoryFromOrder(order: ShopOrderLike): Promise<void> {
  const items = Array.isArray(order.items)
    ? (order.items as Array<{ variantId?: unknown; productId?: unknown; quantity?: unknown }>)
    : [];
  for (const item of items) {
    const quantity = Number(item.quantity ?? 0);
    if (quantity <= 0) continue;
    if (item.variantId) {
      await ShopProductVariant.updateOne(
        {
          _id: item.variantId,
          inventoryTracked: true,
          inventory: { $gte: quantity },
        },
        { $inc: { inventory: -quantity } }
      );
    } else if (item.productId) {
      await ShopProduct.updateOne(
        {
          _id: item.productId,
          inventoryTracked: true,
          inventory: { $gte: quantity },
        },
        { $inc: { inventory: -quantity } }
      );
    }
  }
}
