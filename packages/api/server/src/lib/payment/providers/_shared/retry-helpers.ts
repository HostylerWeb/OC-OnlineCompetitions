import { Order } from "@oc/api-db/models";
import { Types } from "mongoose";
import { finalizeSuccessfulOrder } from "../../finalize-successful-order";

/**
 * Result of a stuck-order retry attempt. Matches the return shape of the
 * 4 `retryStuck*Fulfillment` helpers that previously lived in each adapter.
 */
export type RetryResult = "fulfilled" | "already-finalized" | "in-progress" | "skipped";

/**
 * Provider-agnostic retry of a stuck order. Looks up the order, checks the
 * fulfilment lock, and re-runs `finalizeSuccessfulOrder` if the lock has
 * expired (or doesn't exist).
 */
export async function retryStuckFulfillment(params: {
  orderId: string;
  /** Provider id used for logging + lock metadata. */
  providerId: string;
  /**
   * Resolves the capture id / payment id for `finalizeSuccessfulOrder`. The
   * value varies by provider:
   * - local:   `undefined` (synchronous fulfilment, no capture id)
   * - paytriot: `order.metadata.paytriotTransactionId`
   */
  resolveCaptureId: (order: Record<string, unknown>) => string | undefined;
  /**
   * Optional filter — if it returns false, the retry is skipped.
   * Default: always retry.
   */
  shouldRetry?: (order: Record<string, unknown>) => boolean;
}): Promise<RetryResult> {
  const order = (await Order.findById(params.orderId).lean()) as unknown as
    | (Record<string, unknown> & {
        status?: string;
        userId?: unknown;
        metadata?: Record<string, unknown>;
      })
    | null;
  if (!order) return "skipped";

  if (order.status === "pending") {
    if (!order.providerSessionId) {
      return "skipped";
    }
    await Order.findByIdAndUpdate(params.orderId, { status: "processing" });
    const userId =
      order.userId instanceof Types.ObjectId ? order.userId.toString() : String(order.userId ?? "");
    const captureId = params.resolveCaptureId(order as Record<string, unknown>);
    const result = await finalizeSuccessfulOrder({
      orderId: params.orderId,
      userId,
      captureId,
      source: "capture",
      logPrefix: providerIdLabel(params.providerId),
    });
    if (result === "fulfilled" || result === "already-finalized") {
      return result;
    }
    return "in-progress";
  }

  if (order.status !== "processing") {
    return "skipped";
  }

  if (params.shouldRetry && !params.shouldRetry(order as Record<string, unknown>)) {
    return "skipped";
  }

  const metadata = (order.metadata ?? {}) as Record<string, unknown>;
  const lock = (metadata.fulfillmentLock ?? {}) as Record<string, unknown>;
  const expiresAt = lock.expiresAt ? new Date(String(lock.expiresAt)) : null;

  if (expiresAt && expiresAt.getTime() > Date.now()) {
    return "in-progress";
  }

  await Order.findByIdAndUpdate(params.orderId, {
    $unset: { "metadata.fulfillmentLock": 1 },
  });

  const userId =
    order.userId instanceof Types.ObjectId ? order.userId.toString() : String(order.userId ?? "");
  const captureId = params.resolveCaptureId(order as Record<string, unknown>);

  const result = await finalizeSuccessfulOrder({
    orderId: params.orderId,
    userId,
    captureId,
    source: "capture",
    logPrefix: providerIdLabel(params.providerId),
  });

  if (result === "fulfilled" || result === "already-finalized") {
    return result;
  }
  return "in-progress";
}

function providerIdLabel(id: string): string {
  switch (id) {
    case "paytriot":
      return "Paytriot";
    case "stripe":
      return "Stripe";
    case "local":
      return "Local";
    default:
      return id;
  }
}
