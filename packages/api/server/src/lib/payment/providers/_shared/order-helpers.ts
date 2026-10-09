import { releaseReservedSpend } from "@oc/api-compliance/spend-tracking";
import { Order } from "@oc/api-db/models";
import { releasePromoCodeUsage } from "@oc/api-tickets/promo-codes";
import { Types } from "mongoose";
import type { PaymentSessionStatus } from "../types";

/**
 * Shape of a Mongoose order doc the helpers accept. The full `IOrder` is
 * structurally compatible (these fields are always populated on a hydrated
 * doc), but we keep the helper signature loose to avoid a circular dep on
 * the model type.
 */
export interface OrderLike {
  _id: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  total: number;
  metadata?: Record<string, unknown>;
  status: string;
}

/**
 * Mark an order as failed and release its promo code reservation. No-op if
 * the order is already `completed` or `refunded` (tickets already issued).
 *
 * Used by webhooks on payment failure and by `retryStuckFulfillment`
 * when re-running a stuck order would lose state.
 */
export async function markOrderFailed(order: OrderLike): Promise<void> {
  if (order.status === "completed" || order.status === "refunded") return;

  const metadata = (order.metadata ?? {}) as Record<string, unknown>;
  const promoCode = metadata.promoCode as string | undefined;
  const uid =
    order.userId instanceof Types.ObjectId ? order.userId.toString() : String(order.userId);

  await Order.findByIdAndUpdate(order._id, { $set: { status: "failed" } });

  if (promoCode && uid) {
    await releasePromoCodeUsage(promoCode, uid);
  }

  await releaseReservedSpend(uid, Number(order.total) || 0).catch(() => {});
}

/**
 * Find an order by its `providerSessionId`. Optionally filter by user — pass
 * `userId` for ownership-scoped lookups in the customer-facing routes. Returns
 * a hydrated Mongoose doc.
 */
export async function getOrderBySessionId(sessionId: string, userId?: string) {
  const query: Record<string, unknown> = { providerSessionId: sessionId };
  if (userId) query.userId = new Types.ObjectId(userId);
  return Order.findOne(query).lean();
}

/**
 * Variant that returns a hydrated Mongoose doc (for callers that need to
 * call `save()` or other instance methods).
 */
export async function getHydratedOrderBySessionId(sessionId: string, userId?: string) {
  const query: Record<string, unknown> = { providerSessionId: sessionId };
  if (userId) query.userId = new Types.ObjectId(userId);
  return Order.findOne(query);
}

/**
 * Release a promo code on a failed order. Safe to call with `undefined` (no-op).
 */
export async function releasePromoCodeOnFailure(
  promoCode: string | undefined,
  userId: string
): Promise<void> {
  if (promoCode && userId) {
    await releasePromoCodeUsage(promoCode, userId);
  }
}

/**
 * Resolve a session id to a `PaymentSessionStatus`. The local adapter's
 * synchronous flow means the order status is always "completed" once
 * returned. Other providers' getSessionStatus may have richer mappings.
 */
export async function getSessionStatusFromOrder(sessionId: string): Promise<PaymentSessionStatus> {
  const order = await getOrderBySessionId(sessionId);
  if (!order) {
    return { status: "failed", orderId: undefined };
  }
  return {
    status: (order.status ?? "completed") as PaymentSessionStatus["status"],
    orderId: String(order._id),
  };
}
