import { randomUUID } from "node:crypto";
import { releaseReservedSpend } from "@oc/api-compliance/spend-tracking";
import { Competition, InstantPrizeWin, Order, Profile } from "@oc/api-db/models";
import { CH, invalidateByChannelSafe, invalidateUser } from "@oc/api-infra/cache";
import { withMongoTransactionOptional } from "@oc/api-infra/mongo-capabilities";
import { createLogger } from "@oc/api-logger";
import { attachPromoRedemptionOrderId } from "@oc/api-tickets/promo-codes";
import { getItemsFromOrder, processOrderFulfillment } from "@oc/api-payment-core";
import { incrementCounter } from "@oc/api-server/lib/observability/metrics";
import { sendPushNotification } from "@oc/api-server/lib/push";
import { emitCompetitionUpdate } from "@oc/api-server/lib/utils/competition-events";
import { clearCheckoutCartFromMetadata } from "@oc/api-tickets/load-cart";
import { formatOrderNumber } from "@oc/utils";
import { Types } from "mongoose";
import { buildFulfillmentDeps } from "./build-fulfillment-deps";
import { debitSiteCreditForOrder } from "./debit-site-credit-for-order";
import { fireOrderPurchaseConversion } from "./fire-order-conversion";
import { rollbackOrderFulfillment } from "./rollback-order-fulfillment";

// How long a fulfillment lock remains valid before another process can retry.
// Increased to 5 minutes to accommodate complex fulfillment (instant wins,
// referral processing, email delivery) without premature retry.
const FULFILLMENT_LOCK_TTL_MS = 5 * 60 * 1000;
type FulfillmentLogLevel = "info" | "warn" | "error";

function logFulfillmentEvent(
  logPrefix: string,
  event: string,
  payload: Record<string, unknown>,
  level: FulfillmentLogLevel = "info"
): void {
  const entry = {
    event,
    domain: "payment_fulfillment",
    provider: logPrefix,
    timestamp: new Date().toISOString(),
    ...payload,
  };
  if (level === "warn") {
    console.warn(JSON.stringify(entry));
    return;
  }
  if (level === "error") {
    console.error(JSON.stringify(entry));
    return;
  }
  console.log(JSON.stringify(entry));
}

export type FinalizeOrderResult = "fulfilled" | "already-finalized" | "in-progress";

export async function finalizeSuccessfulOrder(params: {
  orderId: string;
  userId: string;
  captureId?: string;
  source: "capture" | "webhook";
  logPrefix: string;
}): Promise<FinalizeOrderResult> {
  // Payment confirmation guard: if called from a capture flow, verify that
  // a capture/payment ID was provided. Webhook-sourced calls are trusted
  // since the webhook itself is the confirmation signal.
  if (params.source === "capture" && !params.captureId) {
    logFulfillmentEvent(
      params.logPrefix,
      "payment.fulfillment_skipped_not_confirmed",
      {
        source: params.source,
        orderId: params.orderId,
        userId: params.userId,
        reason: "captureId is missing — payment may not have been captured",
      },
      "error"
    );
    throw new Error("payment_not_confirmed: captureId is required for capture-sourced fulfillment");
  }

  log.debug(`[finalize.start]`, {
    orderId: params.orderId,
    userId: params.userId,
    provider: params.logPrefix,
    source: params.source,
    captureId: params.captureId ?? "none",
  });

  const { orderId, userId, captureId, logPrefix } = params;
  const lockToken = randomUUID();
  const now = new Date();
  const lockExpiresAt = new Date(now.getTime() + FULFILLMENT_LOCK_TTL_MS);
  log.debug("[finalize] lock params", {
    orderId,
    lockToken,
    now: now.toISOString(),
    lockExpiresAt: lockExpiresAt.toISOString(),
  });

  log.debug(
    `[finalize] idempotency check - looking for order ${orderId} in pending/processing state without valid lock`
  );

  const order = await Order.findOneAndUpdate(
    {
      _id: orderId,
      status: { $in: ["pending", "processing"] },
      $or: [
        { "metadata.fulfillmentLock": { $exists: false } },
        { "metadata.fulfillmentLock.expiresAt": { $lte: now } },
      ],
    },
    {
      $set: {
        status: "processing",
        paidAt: now,
        "metadata.fulfillmentLock": {
          token: lockToken,
          source: params.source,
          acquiredAt: now,
          expiresAt: lockExpiresAt,
        },
      },
    },
    { returnDocument: "after" }
  );

  if (!order) {
    const existing = await Order.findById(orderId).lean();
    if (existing?.status === "completed" || existing?.status === "refunded") {
      logFulfillmentEvent(logPrefix, "payment.fulfillment_skipped_already_finalized", {
        source: params.source,
        orderId,
        userId,
        status: existing.status,
      });
      return "already-finalized";
    }
    if (existing?.status === "processing") {
      logFulfillmentEvent(
        logPrefix,
        "payment.fulfillment_in_progress",
        { source: params.source, orderId, userId, status: existing.status },
        "warn"
      );
      return "in-progress";
    }
    throw new Error("Order not found or not in fulfillable state");
  }

  const metadata = (order.metadata ?? {}) as Record<string, unknown>;
  const items = getItemsFromOrder({ metadata });
  const competitionIds = order.competitionIds?.length
    ? order.competitionIds
    : ((metadata.competitionIds as string) ?? "").split(",").filter(Boolean);
  logFulfillmentEvent(logPrefix, "payment.fulfillment_started", {
    source: params.source,
    orderId,
    userId,
    captureId: captureId ?? null,
    providerOrderId: order.providerSessionId ?? null,
    competitionIds,
    itemCount: items.length,
    lockToken,
    lockExpiresAt: lockExpiresAt.toISOString(),
  });
  const guestProfile = await Profile.findById(userId).lean();
  const deps = buildFulfillmentDeps({
    includeBalance: false,
    isGuest: order.isGuestCheckout ?? guestProfile?.isGuestCheckout,
  });
  const promoCode = metadata.promoCode as string | undefined;
  let profileStatsDelta = { entries: 0, spent: 0 };
  const referralBalanceUsed = order.referralBalanceUsed ?? 0;
  const completedSteps: string[] = [];

  try {
    completedSteps.push("fulfillment_lock_acquired");
    log.debug("[finalize] entering withMongoTransactionOptional", {
      orderId: order._id.toString(),
    });
    const _result = await withMongoTransactionOptional(
      async (txnSession) => {
      const siteCreditApplied = Number(metadata.siteCreditApplied ?? 0);
      if (siteCreditApplied > 0) {
        await debitSiteCreditForOrder({
          userId,
          orderId: order._id.toString(),
          amount: siteCreditApplied,
          session: txnSession ?? undefined,
        });
      }

      log.debug("[finalize] calling processOrderFulfillment", {
        orderId: order._id.toString(),
        competitionIds,
        itemCount: items.length,
        referralBalanceUsed,
        siteCreditApplied,
      });
      const fulfillmentResult = await processOrderFulfillment({
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        userId,
        competitionIds,
        items,
        subtotal: order.subtotal,
        discountAmount: order.discountAmount,
        total: order.total,
        metadata,
        logPrefix,
        deps,
        referralBalanceUsed,
        orderEmail: order.orderEmail,
        shippingAddress: order.shippingAddress as Parameters<
          typeof processOrderFulfillment
        >[0]["shippingAddress"],
        session: txnSession ?? undefined,
      });

      profileStatsDelta = { entries: fulfillmentResult.totalQuantity, spent: order.total };
      if (promoCode) {
        await attachPromoRedemptionOrderId(promoCode, userId, order._id.toString()).catch(() => {});
      }
      log.debug(`[finalize] processOrderFulfillment completed`, {
        orderId: order._id.toString(),
        totalQuantity: fulfillmentResult.totalQuantity,
        ticketCounts:
          (fulfillmentResult as { ticketCounts?: unknown }).ticketCounts ?? "not available",
      });

      const updateQuery = Order.findOneAndUpdate(
        { _id: order._id, "metadata.fulfillmentLock.token": lockToken },
        {
          $set: { status: "completed", fulfillmentStatus: "completed" },
          $unset: { "metadata.fulfillmentLock": 1 },
        }
      );
      await (txnSession ? updateQuery.session(txnSession) : updateQuery);

      logFulfillmentEvent(logPrefix, "payment.fulfillment_completed", {
        source: params.source,
        orderId: order._id.toString(),
        userId,
        competitionIds,
        totalQuantity: fulfillmentResult.totalQuantity,
      });

      return fulfillmentResult;
    },
      { logPrefix: "finalize", strictOnTxFailure: true }
    );

    completedSteps.push("fulfillment_completed");
    if (
      (_result as { allAssignedNumbers?: Array<{ competitionId: string }> })?.allAssignedNumbers
        ?.length
    ) {
      void Promise.all(
        (
          _result as { allAssignedNumbers: Array<{ competitionId: string }> }
        ).allAssignedNumbers.map(async (assigned) => {
          try {
            const comp = await Competition.findById(assigned.competitionId)
              .select("slug ticketsSold ticketsHeld maxTickets")
              .lean();
            if (comp) {
              emitCompetitionUpdate({
                competitionId: String(comp._id),
                slug: comp.slug,
                ticketsSold: comp.ticketsSold ?? 0,
                ticketsHeld: comp.ticketsHeld ?? 0,
                maxTickets: comp.maxTickets,
                available: Math.max(
                  0,
                  comp.maxTickets - (comp.ticketsSold ?? 0) - (comp.ticketsHeld ?? 0)
                ),
              });
            }
          } catch (err) {
            log.warn("[finalize] failed to emit SSE competition update", { error: err });
          }
        })
      ).catch(() => {});
    }
    // Auto-claim instant prizes for guest users (they can't access dashboard)
    if (order.isGuestCheckout) {
      InstantPrizeWin.updateMany(
        { userId: new Types.ObjectId(userId), claimed: false },
        { $set: { claimed: true, claimedAt: new Date() } }
      ).catch((err: unknown) => {
        console.error(`[${logPrefix}] Guest auto-claim failed for order ${orderId}:`, err);
      });
    }
    // Fire-and-forget push notification to the buyer
    void sendPushNotification(
      {
        title: "Order confirmed!",
        body: `Your order ${formatOrderNumber(order.orderNumber)} has been completed successfully.`,
        type: "system",
        url: "/dashboard/orders",
        tag: `order-${order._id.toString()}`,
      },
      { userId }
    ).catch(() => {});
    await clearCheckoutCartFromMetadata(metadata, userId).catch((err: unknown) => {
      log.error(
        `[fulfillment] Cart clearing failed (non-blocking): ${err instanceof Error ? err.message : String(err)}`
      );
    });
    completedSteps.push("cart_cleared");
    // Bust all public and user-scoped caches affected by this purchase
    void invalidateByChannelSafe(
      CH.competitions,
      CH.competitionDetail,
      CH.competitionFeatured,
      CH.landingPage,
      CH.entries,
      CH.stats,
      CH.instantPrizes,
      CH.competitionAvailability,
      CH.competitionBuyingPower,
      CH.competitionsAvailabilityBatch,
      CH.competitionsBuyingPowerBatch
    ).catch((e) => log.warn("invalidation error", e));
    void invalidateUser(userId).catch((e) => log.warn("invalidation error", e));
    await releaseReservedSpend(userId, Number(order.total) || 0).catch((err) =>
      console.error("[fulfillment] releaseReservedSpend failed:", err)
    );

    fireOrderPurchaseConversion({ order, userId, email: order.orderEmail });

    log.debug(`[finalize.complete]`, {
      orderId: order._id.toString(),
      result: "fulfilled",
    });
    incrementCounter("order.fulfilled");
    return "fulfilled";
  } catch (err: unknown) {
    const errMessage = err instanceof Error ? err.message : String(err);
    const errStack = err instanceof Error ? err.stack : undefined;
    const errName = err instanceof Error ? err.name : "UnknownError";
    log.debug(`[finalize.error]`, {
      orderId: order._id.toString(),
      error: errMessage,
      errorName: errName,
    });
    logFulfillmentEvent(
      logPrefix,
      "payment.fulfillment_failed",
      {
        source: params.source,
        orderId: order._id.toString(),
        userId,
        competitionIds,
        errorName: errName,
        errorMessage: errMessage,
        errorStack: errStack?.split("\n").slice(0, 10),
        completedSteps,
        itemCount: items.length,
        itemDetails: items.map((it) => ({
          competitionId: it.competitionId,
          qty: it.quantity,
        })),
        orderMetadataKeys: Object.keys(metadata),
        competitionIdsState: competitionIds,
      },
      "error"
    );
    // CRITICAL: Before rolling back, verify this process still holds the fulfillment lock.
    // If lock expired and another process claimed it, do NOT rollback — the other process's work
    // would be undone.
    const currentOrder = await Order.findById(order._id.toString())
      .select("metadata.fulfillmentLock")
      .lean();
    const currentLock = (currentOrder as any)?.metadata?.fulfillmentLock as
      | { token?: string; expiresAt?: Date }
      | undefined;
    if (currentLock?.token !== lockToken) {
      logFulfillmentEvent(logPrefix, "rollback_skipped_lock_expired", {
        orderId: order._id.toString(),
        reason: "Lock token mismatch — another process may have claimed this lock",
      });
      // Don't rollback, don't release lock (another process owns it)
      return "in-progress";
    }

    try {
      await rollbackOrderFulfillment({
        orderId: order._id.toString(),
        userId,
        profileStatsDelta,
        referralBalanceUsed: referralBalanceUsed > 0 ? referralBalanceUsed : undefined,
        promoCode,
        completedSteps,
      });
    } catch (rollbackErr) {
      console.error(
        `[${logPrefix}] rollbackOrderFulfillment failed for order ${order._id.toString()}:`,
        rollbackErr
      );
    }

    await Order.findOneAndUpdate(
      { _id: order._id, "metadata.fulfillmentLock.token": lockToken },
      {
        $set: {
          status: "failed",
          "metadata.fulfillmentFailedAfterCapture": true,
          "metadata.fulfillmentError": {
            message: errMessage,
            stack: errStack,
            capturedAt: new Date().toISOString(),
          },
          // E3 + Step 2: persist the full fulfillment-failure error context.
          // The category must NOT be SUCCESS (the card was charged but the
          // order never fulfilled). Mark the order with FULFILLMENT_FAILED
          // so downstream consumers (polling, admin tooling, success page
          // URL builder) see accurate state. paytriot.handleWebhook's
          // post-fulfillment metadata write must respect these values and
          // NOT overwrite them with the default SUCCESS category fields.
          // Provider-generic paymentError* keys are written for every
          // provider; the legacy paytriotError* keys are kept alongside for
          // backwards compatibility (client status routes still read them).
          "metadata.paytriotErrorCategory": "FULFILLMENT_FAILED",
          "metadata.paytriotErrorUserMessage": `Order processing failed after payment capture: ${errMessage}`,
          "metadata.paytriotErrorTitle": "Order processing failed",
          "metadata.paytriotErrorRecommendedAction": "contact_support",
          "metadata.paytriotErrorWasCharged": true,
          "metadata.paymentErrorCategory": "FULFILLMENT_FAILED",
          "metadata.paymentErrorUserMessage": `Order processing failed after payment capture: ${errMessage}`,
          "metadata.paymentErrorTitle": "Order processing failed",
          "metadata.paymentErrorRecommendedAction": "contact_support",
          "metadata.paymentErrorWasCharged": true,
        },
        $unset: { "metadata.fulfillmentLock": 1 },
      }
    );
    await releaseReservedSpend(userId, Number(order.total) || 0).catch((err) =>
      console.error("[fulfillment] releaseReservedSpend failed:", err)
    );
    incrementCounter("order.failed");
    // Invalidate caches even on failure — tickets were rolled back, counters changed
    void invalidateByChannelSafe(
      CH.competitionAvailability,
      CH.competitionsAvailabilityBatch,
      CH.competitionBuyingPower,
      CH.competitionsBuyingPowerBatch,
      CH.competitions,
      CH.competitionDetail,
      CH.competitionFeatured,
      CH.entries,
      CH.stats
    ).catch((e) => log.warn("invalidation error", e));
    void invalidateUser(userId).catch((e) => log.warn("invalidation error", e));
    log.debug(`[finalize.failed_after_capture]`, {
      orderId: order._id.toString(),
      error: errMessage,
    });
    return "fulfilled";
  }
}

const log = createLogger("finalize");
